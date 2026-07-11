from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from database import SessionLocal
from models.user import User
from models.student import Student
from utils.security import require_role
from models.teacher import Teacher

router = APIRouter(prefix="/classes", tags=["Classes"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/{class_id}/students")
def get_class_students(
    class_id: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher", "admin"]))
):
    students = db.query(Student).filter(Student.class_id == class_id).all()
    result = []
    for s in students:
        result.append({
            "student_id": s.id,
            "roll_number": s.roll_number,
            "name": s.user.name,
            "email": s.user.email
        })
    return result


@router.get("/my-classes")
def get_my_classes(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher"]))
):
    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    from models.class_ import Class
    classes = db.query(Class).filter(Class.teacher_id == teacher.id).all()
    return [{"id": c.id, "name": c.name} for c in classes]