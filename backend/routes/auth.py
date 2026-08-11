from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models.user import User
from schemas import UserRegister, UserResponse, UserLogin, Token
from utils.security import hash_password, verify_password, create_access_token
from utils.security import get_current_user
from models.student import Student
router = APIRouter(prefix="/auth", tags=["Auth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from models.student import Student
from sqlalchemy import func

@router.post("/register", response_model=UserResponse)
def register(user: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    if user.role not in ["student", "teacher"]:
        raise HTTPException(status_code=400, detail="Role must be 'student' or 'teacher'")

    # Students are auto-verified; teachers still require admin approval
    is_verified = True if user.role == "student" else False

    new_user = User(
        name=user.name,
        email=user.email,
        password_hash=hash_password(user.password),
        role=user.role,
        is_verified=is_verified
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if user.role == "student":
        # Auto-generate the next sequential roll number
        all_students = db.query(Student.roll_number).all()
        numeric_rolls = []
        for (roll,) in all_students:
            try:
                numeric_rolls.append(int(roll))
            except (ValueError, TypeError):
                continue
        next_roll = (max(numeric_rolls) if numeric_rolls else 0) + 1

        new_student = Student(
            user_id=new_user.id,
            roll_number=str(next_roll),
            class_id=None
        )
        db.add(new_student)
        db.commit()

    return new_user



@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Account not yet verified by admin")

    access_token = create_access_token(data={"user_id": user.id, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user