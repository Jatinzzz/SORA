from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session as DBSession
from database import SessionLocal
from models.user import User
from models.student import Student
from utils.security import require_role
from schemas import FaceVerifyResponse
from deepface import DeepFace
import numpy as np
import cv2
import json

router = APIRouter(prefix="/face", tags=["Face Verification"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def read_image_from_upload(file: UploadFile):
    file_bytes = np.frombuffer(file.file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
    return img

@router.post("/enroll")
def enroll_face(
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student"]))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    img = read_image_from_upload(file)

    try:
        embedding_result = DeepFace.represent(
            img, model_name="Facenet", enforce_detection=True, detector_backend="mtcnn"
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="No face detected in the image. Please try again with a clearer photo.")

    embedding = embedding_result[0]["embedding"]
    student.face_encoding = json.dumps(embedding)
    db.commit()

    return {"message": "Face enrolled successfully"}

@router.post("/verify", response_model=FaceVerifyResponse)
def verify_face(
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student"]))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    if not student.face_encoding:
        raise HTTPException(status_code=400, detail="No enrolled face found. Please enroll your face first.")

    img = read_image_from_upload(file)

    try:
        live_embedding_result = DeepFace.represent(
            img, model_name="Facenet", enforce_detection=True, detector_backend="mtcnn"
        )
    except ValueError:
        return {"verified": False, "message": "No face detected. Please try again."}

    live_embedding = np.array(live_embedding_result[0]["embedding"])
    stored_embedding = np.array(json.loads(student.face_encoding))

    similarity = np.dot(live_embedding, stored_embedding) / (
        np.linalg.norm(live_embedding) * np.linalg.norm(stored_embedding)
    )

    threshold = 0.6
    is_match = similarity >= threshold

    return {
        "verified": bool(is_match),
        "message": "Face verified successfully" if is_match else "Face does not match enrolled record"
    }