from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from database import SessionLocal
from models.user import User
from models.student import Student
from models.teacher import Teacher
from models.leave_request import LeaveRequest
from models.class_ import Class
from schemas import LeaveRequestCreate, LeaveRequestResponse, LeaveReviewRequest
from utils.security import require_role

router = APIRouter(prefix="/leave", tags=["Leave Management"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/apply", response_model=LeaveRequestResponse)
def apply_leave(
    payload: LeaveRequestCreate,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student"]))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    if payload.date_from > payload.date_to:
        raise HTTPException(status_code=400, detail="date_from cannot be after date_to")

    new_request = LeaveRequest(
        student_id=student.id,
        reason=payload.reason,
        date_from=payload.date_from,
        date_to=payload.date_to,
        status="pending"
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    return new_request

@router.get("/my-requests", response_model=list[LeaveRequestResponse])
def get_my_requests(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student"]))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    return db.query(LeaveRequest).filter(LeaveRequest.student_id == student.id).order_by(LeaveRequest.created_at.desc()).all()

@router.get("/pending", response_model=list[LeaveRequestResponse])
def get_pending_requests(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher"]))
):
    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    # Get all class IDs this teacher teaches
    class_ids = [c.id for c in db.query(Class).filter(Class.teacher_id == teacher.id).all()]

    # Get all students in those classes
    student_ids = [s.id for s in db.query(Student).filter(Student.class_id.in_(class_ids)).all()]

    return db.query(LeaveRequest).filter(
        LeaveRequest.student_id.in_(student_ids),
        LeaveRequest.status == "pending"
    ).order_by(LeaveRequest.created_at.desc()).all()

@router.put("/{leave_id}/review", response_model=LeaveRequestResponse)
def review_leave(
    leave_id: int,
    payload: LeaveReviewRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher"]))
):
    if payload.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    leave_request = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave_request:
        raise HTTPException(status_code=404, detail="Leave request not found")

    leave_request.status = payload.status
    leave_request.reviewed_by = teacher.id
    db.commit()
    db.refresh(leave_request)
    return leave_request