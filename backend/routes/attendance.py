from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from datetime import datetime, timezone
from database import SessionLocal
from models.user import User
from models.student import Student
from models.session import Session as SessionModel
from schemas import QRValidateRequest, QRValidateResponse
from utils.security import require_role, decode_access_token
from jose import JWTError
from fastapi import UploadFile, File, Form
from models.student import Student
from models.attendance import Attendance
from deepface import DeepFace
import numpy as np
import cv2
import json
from schemas import MarkAttendanceResponse
from models.teacher import Teacher

router = APIRouter(prefix="/attendance", tags=["Attendance"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/validate-qr", response_model=QRValidateResponse)
def validate_qr(
    payload: QRValidateRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student"]))
):
    # Decode the scanned token
    try:
        token_data = decode_access_token(payload.qr_token)
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired QR code")

    if token_data.get("type") != "qr":
        raise HTTPException(status_code=400, detail="This is not a valid attendance QR code")

    session_id = token_data.get("session_id")
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    # Confirm this token matches the CURRENT active token for this session
    # (protects against reused/old screenshots of a previous QR)
    if session_obj.qr_token != payload.qr_token:
        raise HTTPException(status_code=400, detail="This QR code has expired, please scan the current one")

    # Double-check expiry against DB timestamp too (not just JWT's own exp)
    if session_obj.qr_expiry is None or datetime.now(timezone.utc) > session_obj.qr_expiry:
        raise HTTPException(status_code=400, detail="This QR code has expired")

    # Confirm the student belongs to the class this session is for
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    if student.class_id != session_obj.class_id:
        raise HTTPException(status_code=403, detail="This QR code is not for your class")

    return {
        "valid": True,
        "session_id": session_obj.id,
        "class_id": session_obj.class_id,
        "message": "QR verified. Proceed to face verification."
    }

def read_image_from_upload(file: UploadFile):
    file_bytes = np.frombuffer(file.file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
    return img


@router.post("/mark", response_model=MarkAttendanceResponse)
def mark_attendance(
    qr_token: str = Form(...),
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student"]))
):
    # ── Step 1: Validate the QR token (same logic as validate-qr) ──
    try:
        token_data = decode_access_token(qr_token)
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired QR code")

    if token_data.get("type") != "qr":
        raise HTTPException(status_code=400, detail="This is not a valid attendance QR code")

    session_id = token_data.get("session_id")
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    if session_obj.qr_token != qr_token:
        raise HTTPException(status_code=400, detail="This QR code has expired, please scan the current one")

    if session_obj.qr_expiry is None or datetime.now(timezone.utc) > session_obj.qr_expiry:
        raise HTTPException(status_code=400, detail="This QR code has expired")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    if student.class_id != session_obj.class_id:
        raise HTTPException(status_code=403, detail="This QR code is not for your class")

    # ── Step 2: Check for existing attendance (avoid duplicate marking) ──
    existing = db.query(Attendance).filter(
        Attendance.session_id == session_obj.id,
        Attendance.student_id == student.id
    ).first()

    if existing and existing.status == "present":
        raise HTTPException(status_code=400, detail="Attendance already marked for this session")

    # ── Step 3: Face verification ──
    if not student.face_encoding:
        raise HTTPException(status_code=400, detail="No enrolled face found. Please enroll your face first.")

    img = read_image_from_upload(file)

    try:
        live_embedding_result = DeepFace.represent(
            img, model_name="Facenet", enforce_detection=True, detector_backend="mtcnn"
        )
    except ValueError:
        return {"status": "absent", "face_verified": False, "message": "No face detected. Please try again."}

    live_embedding = np.array(live_embedding_result[0]["embedding"])
    stored_embedding = np.array(json.loads(student.face_encoding))

    similarity = np.dot(live_embedding, stored_embedding) / (
        np.linalg.norm(live_embedding) * np.linalg.norm(stored_embedding)
    )
    threshold = 0.6
    is_match = bool(similarity >= threshold)

    if not is_match:
        return {"status": "absent", "face_verified": False, "message": "Face does not match enrolled record. Attendance not marked."}

    # ── Step 4: Mark attendance (create or update) ──
    if existing:
        existing.status = "present"
        existing.marked_by = "student_scan"
        existing.face_verified = True
        existing.timestamp = datetime.now(timezone.utc)
    else:
        new_attendance = Attendance(
            session_id=session_obj.id,
            student_id=student.id,
            status="present",
            marked_by="student_scan",
            face_verified=True
        )
        db.add(new_attendance)

    db.commit()

    return {"status": "present", "face_verified": True, "message": "Attendance marked successfully"}

@router.post("/manual-mark")
def manual_mark_attendance(
    payload: ManualAttendanceRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher"]))
):
    session_obj = db.query(SessionModel).filter(SessionModel.id == payload.session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher or session_obj.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not authorized for this session")

    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if payload.status not in ["present", "absent"]:
        raise HTTPException(status_code=400, detail="Status must be 'present' or 'absent'")

    existing = db.query(Attendance).filter(
        Attendance.session_id == payload.session_id,
        Attendance.student_id == payload.student_id
    ).first()

    if existing:
        existing.status = payload.status
        existing.marked_by = "teacher_manual"
        existing.face_verified = False
        existing.timestamp = datetime.now(timezone.utc)
    else:
        new_attendance = Attendance(
            session_id=payload.session_id,
            student_id=payload.student_id,
            status=payload.status,
            marked_by="teacher_manual",
            face_verified=False
        )
        db.add(new_attendance)

    db.commit()
    return {"message": f"Attendance manually marked as {payload.status}"}