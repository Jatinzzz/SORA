from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models.user import User
from schemas import UserResponse
from utils.security import require_role
from models.student import Student
from models.teacher import Teacher
from schemas import VerifyUserRequest, CourseCreateRequest, TeacherReassignRequest, TeacherListItem
from models.student import Student
from models.student_class import StudentClass
from models.class_ import Class
from routes.analytics import calculate_student_score
from models.class_ import Class
from models.department import Department


router = APIRouter(prefix="/admin", tags=["Admin"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/pending-users", response_model=list[UserResponse])
def get_pending_users(db: Session = Depends(get_db), current_user: User = Depends(require_role(["admin"]))):
    return db.query(User).filter(User.is_verified == False, User.role == "teacher").all()



@router.put("/verify-user/{user_id}", response_model=UserResponse)
def verify_user(
    user_id: int,
    payload: VerifyUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role != "teacher":
        raise HTTPException(status_code=400, detail="Only teacher accounts require manual verification")

    user.is_verified = True

    existing = db.query(Teacher).filter(Teacher.user_id == user.id).first()
    if not existing:
        new_teacher = Teacher(
            user_id=user.id,
            department_id=payload.department_id
        )
        db.add(new_teacher)

    db.commit()
    db.refresh(user)
    return user

@router.get("/course/{class_id}/students")
def get_course_students(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    links = db.query(StudentClass).filter(StudentClass.class_id == class_id).all()
    result = []
    for link in links:
        s = link.student
        result.append({
            "student_id": s.id,
            "name": s.user.name,
            "email": s.user.email,
            "roll_number": s.roll_number
        })
    return result


@router.get("/student/{student_id}/full-profile")
def get_student_full_profile(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    links = db.query(StudentClass).filter(StudentClass.student_id == student.id).all()
    course_scores = [calculate_student_score(db, student, link.class_id) for link in links]

    total_sessions = sum(c.total_sessions for c in course_scores)
    total_present = sum(c.present_count for c in course_scores)
    overall_percentage = round((total_present / total_sessions) * 100, 2) if total_sessions > 0 else 0.0

    return {
        "student_id": student.id,
        "name": student.user.name,
        "email": student.user.email,
        "roll_number": student.roll_number,
        "department_name": student.department.name if student.department else None,
        "face_enrolled": bool(student.face_encoding),
        "overall_percentage": overall_percentage,
        "total_sessions": total_sessions,
        "present_count": total_present,
        "courses": course_scores
    }


@router.delete("/course/{class_id}/student/{student_id}")
def remove_student_from_course(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    link = db.query(StudentClass).filter(
        StudentClass.class_id == class_id,
        StudentClass.student_id == student_id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Student is not enrolled in this course")

    db.delete(link)
    db.commit()
    return {"message": "Student removed from course successfully"}

@router.get("/teachers", response_model=list[TeacherListItem])
def list_teachers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    teachers = db.query(Teacher).join(User).filter(User.is_verified == True).all()
    result = []
    for t in teachers:
        result.append(TeacherListItem(
            id=t.id,
            name=t.user.name,
            email=t.user.email,
            department_name=t.department_ref.name if t.department_ref else None
        ))
    return result


@router.post("/departments/{department_id}/courses")
def create_course(
    department_id: int,
    payload: CourseCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    if payload.teacher_id:
        teacher = db.query(Teacher).filter(Teacher.id == payload.teacher_id).first()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")

    new_class = Class(
        name=payload.name,
        department_id=department_id,
        teacher_id=payload.teacher_id
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)

    return {"message": "Course created successfully", "class_id": new_class.id}


@router.put("/courses/{class_id}/reassign-teacher")
def reassign_teacher(
    class_id: int,
    payload: TeacherReassignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Course not found")

    teacher = db.query(Teacher).filter(Teacher.id == payload.teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    class_obj.teacher_id = payload.teacher_id
    db.commit()

    return {"message": f"Teacher reassigned successfully. All existing data for this course remains unchanged."}