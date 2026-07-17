from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from database import SessionLocal
from models.user import User
from models.student import Student
from models.teacher import Teacher
from models.class_ import Class
from models.session import Session as SessionModel
from models.attendance import Attendance
from schemas import StudentAttendanceScore, ClassAttendanceScore
from utils.security import require_role

router = APIRouter(prefix="/analytics", tags=["Analytics"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def calculate_student_score(db: DBSession, student: Student, class_id: int):
    total_sessions = db.query(SessionModel).filter(SessionModel.class_id == class_id).count()

    present_count = db.query(Attendance).join(SessionModel).filter(
        SessionModel.class_id == class_id,
        Attendance.student_id == student.id,
        Attendance.status == "present"
    ).count()

    absent_count = total_sessions - present_count
    percentage = round((present_count / total_sessions) * 100, 2) if total_sessions > 0 else 0.0

    return StudentAttendanceScore(
        student_id=student.id,
        name=student.user.name,
        roll_number=student.roll_number,
        total_sessions=total_sessions,
        present_count=present_count,
        absent_count=absent_count,
        attendance_percentage=percentage
    )

@router.get("/student/{student_id}/class/{class_id}", response_model=StudentAttendanceScore)
def get_student_score(
    student_id: int,
    class_id: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student", "teacher", "admin"]))
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # If the requester is a student, ensure they can only view their own score
    if current_user.role == "student" and student.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this record")

    return calculate_student_score(db, student, class_id)

@router.get("/class/{class_id}", response_model=ClassAttendanceScore)
def get_class_scores(
    class_id: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher", "admin"]))
):
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    if current_user.role == "teacher":
        teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
        if not teacher or class_obj.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="Not authorized for this class")

    total_sessions = db.query(SessionModel).filter(SessionModel.class_id == class_id).count()

    students = db.query(Student).filter(Student.class_id == class_id).all()
    student_scores = [calculate_student_score(db, s, class_id) for s in students]

    return ClassAttendanceScore(
        class_id=class_obj.id,
        class_name=class_obj.name,
        total_sessions=total_sessions,
        students=student_scores
    )

@router.get("/all-classes", response_model=list[ClassAttendanceScore])
def get_all_class_scores(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    classes = db.query(Class).all()
    result = []
    for class_obj in classes:
        total_sessions = db.query(SessionModel).filter(SessionModel.class_id == class_obj.id).count()
        students = db.query(Student).filter(Student.class_id == class_obj.id).all()
        student_scores = [calculate_student_score(db, s, class_obj.id) for s in students]
        result.append(ClassAttendanceScore(
            class_id=class_obj.id,
            class_name=class_obj.name,
            total_sessions=total_sessions,
            students=student_scores
        ))
    return result