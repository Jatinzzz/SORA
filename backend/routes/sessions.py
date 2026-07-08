from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from datetime import datetime, timedelta, timezone
from database import SessionLocal
from models.user import User
from models.teacher import Teacher
from models.session import Session as SessionModel
from schemas import SessionCreate, SessionResponse, QRResponse
from utils.security import require_role, create_access_token, decode_access_token
from jose import JWTError

router = APIRouter(prefix="/sessions", tags=["Sessions"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/create", response_model=SessionResponse)
def create_session(
    payload: SessionCreate,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher"]))
):
    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    new_session = SessionModel(
        class_id=payload.class_id,
        teacher_id=teacher.id,
        date=datetime.utcnow()
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.post("/{session_id}/generate-qr", response_model=QRResponse)
def generate_qr(
    session_id: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher"]))
):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher or session_obj.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not authorized for this session")

    # 120 seconds validity, per your requirement
    token = create_access_token(
        data={"session_id": session_obj.id, "type": "qr"},
        expires_minutes=2  # 120 seconds
    )
    expiry = datetime.now(timezone.utc) + timedelta(seconds=120)

    session_obj.qr_token = token
    session_obj.qr_expiry = expiry
    db.commit()
    db.refresh(session_obj)

    return {"qr_token": token, "qr_expiry": expiry}