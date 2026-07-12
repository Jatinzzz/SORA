from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from database import SessionLocal
from models.user import User
from models.student import Student
from utils.security import require_role
from models.teacher import Teacher
from schemas import ClassCreate, ClassResponse
from models.class_ import Class

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

@router.get("/unassigned-students")
def get_unassigned_students(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher", "admin"]))
):
    students = db.query(Student).filter(Student.class_id.is_(None)).all()
    result = []
    for s in students:
        result.append({
            "student_id": s.id,
            "roll_number": s.roll_number,
            "name": s.user.name,
            "email": s.user.email
        })
    return result


@router.put("/{class_id}/assign-student/{student_id}")
def assign_student_to_class(
    class_id: int,
    student_id: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher", "admin"]))
):
    from models.class_ import Class

    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    # If teacher (not admin), confirm they own this class
    if current_user.role == "teacher":
        teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
        if not teacher or class_obj.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="Not authorized for this class")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.class_id = class_id
    db.commit()
    db.refresh(student)

    return {"message": f"Student assigned to class successfully"}


@router.post("/create", response_model=ClassResponse)
def create_class(
    payload: ClassCreate,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher", "admin"]))
):
    teacher_id = None
    if current_user.role == "teacher":
        teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher profile not found")
        teacher_id = teacher.id

    new_class = Class(name=payload.name, teacher_id=teacher_id)
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return new_class