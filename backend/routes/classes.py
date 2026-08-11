from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from database import SessionLocal
from models.user import User
from models.student import Student
from utils.security import require_role
from models.teacher import Teacher
from schemas import ClassCreate, ClassResponse, StudentOnboardRequest
from models.class_ import Class
from models.department import Department
from models.student_class import StudentClass
from routes.analytics import calculate_student_score

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
    links = db.query(StudentClass).filter(StudentClass.class_id == class_id).all()
    result = []
    for link in links:
        s = link.student
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

@router.get("/my-student-info")
def get_my_student_info(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student"]))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    class_name = student.class_.name if student.class_ else None
    return {"student_id": student.id, "class_id": student.class_id, "class_name": class_name}

@router.post("/onboard")
def onboard_student(
    payload: StudentOnboardRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student"]))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    if student.department_id is not None:
        raise HTTPException(status_code=400, detail="Department already set. Contact your teacher or admin to change it.")

    department = db.query(Department).filter(Department.id == payload.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    class_obj = db.query(Class).filter(Class.id == payload.class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    if class_obj.department_id != payload.department_id:
        raise HTTPException(status_code=400, detail="This course does not belong to the selected department")

    student.department_id = payload.department_id

    new_link = StudentClass(student_id=student.id, class_id=payload.class_id)
    db.add(new_link)
    db.commit()

    return {"message": "Onboarding completed successfully"}

@router.post("/enroll-additional")
def enroll_additional_course(
    class_id: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student"]))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    if student.department_id is None:
        raise HTTPException(status_code=400, detail="Please complete onboarding first")

    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    if class_obj.department_id != student.department_id:
        raise HTTPException(status_code=403, detail="You can only enroll in courses within your own department")

    existing = db.query(StudentClass).filter(
        StudentClass.student_id == student.id,
        StudentClass.class_id == class_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")

    new_link = StudentClass(student_id=student.id, class_id=class_id)
    db.add(new_link)
    db.commit()

    return {"message": f"Enrolled in {class_obj.name} successfully"}

@router.get("/my-courses")
def get_my_courses(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["student"]))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    links = db.query(StudentClass).filter(StudentClass.student_id == student.id).all()
    courses = []
    for link in links:
        c = link.class_
        teacher_name = c.teacher.user.name if c.teacher else None
        courses.append({"class_id": c.id, "name": c.name, "teacher_name": teacher_name})

    department_name = student.department.name if student.department else None

    return {
        "student_id": student.id,
        "name": student.user.name,
        "email": student.user.email,
        "roll_number": student.roll_number,
        "department_id": student.department_id,
        "department_name": department_name,
        "face_enrolled": bool(student.face_encoding),
        "courses": courses
    }

@router.delete("/{class_id}/student/{student_id}")
def remove_student_from_my_course(
    class_id: int,
    student_id: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher"]))
):
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher or class_obj.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not authorized for this class")

    link = db.query(StudentClass).filter(
        StudentClass.class_id == class_id,
        StudentClass.student_id == student_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Student is not enrolled in this course")

    db.delete(link)
    db.commit()
    return {"message": "Student removed from course successfully"}


@router.get("/{class_id}/student/{student_id}/profile")
def get_student_profile_for_teacher(
    class_id: int,
    student_id: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["teacher"]))
):
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher or class_obj.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not authorized for this class")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    enrollment = db.query(StudentClass).filter(
        StudentClass.class_id == class_id,
        StudentClass.student_id == student_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Student is not enrolled in this course")

    links = db.query(StudentClass).filter(StudentClass.student_id == student.id).all()
    course_scores = [calculate_student_score(db, student, l.class_id) for l in links]

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