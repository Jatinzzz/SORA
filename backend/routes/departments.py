from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from database import SessionLocal
from models.user import User
from models.department import Department
from models.class_ import Class
from schemas import DepartmentResponse, DepartmentCreate, CourseResponse
from utils.security import require_role

router = APIRouter(prefix="/departments", tags=["Departments"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("", response_model=list[DepartmentResponse])
def list_departments(db: DBSession = Depends(get_db)):
    return db.query(Department).all()

@router.post("/create", response_model=DepartmentResponse)
def create_department(
    payload: DepartmentCreate,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    existing = db.query(Department).filter(Department.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department already exists")

    new_dept = Department(name=payload.name)
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    return new_dept

@router.get("/{department_id}/courses", response_model=list[CourseResponse])
def get_courses_by_department(department_id: int, db: DBSession = Depends(get_db)):
    classes = db.query(Class).filter(Class.department_id == department_id).all()
    result = []
    for c in classes:
        teacher_name = c.teacher.user.name if c.teacher else None
        result.append(CourseResponse(id=c.id, name=c.name, teacher_name=teacher_name))
    return result