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