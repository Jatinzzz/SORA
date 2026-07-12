from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from datetime import date

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # "student" or "teacher"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_verified: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"



class SessionCreate(BaseModel):
    class_id: int

class SessionResponse(BaseModel):
    id: int
    class_id: int
    teacher_id: int
    date: datetime
    qr_token: Optional[str] = None
    qr_expiry: Optional[datetime] = None

    class Config:
        from_attributes = True

class QRResponse(BaseModel):
    qr_token: str
    qr_expiry: datetime

class QRValidateRequest(BaseModel):
    qr_token: str

class QRValidateResponse(BaseModel):
    valid: bool
    session_id: int
    class_id: int
    message: str

class FaceVerifyResponse(BaseModel):
    verified: bool
    message: str

class MarkAttendanceResponse(BaseModel):
    status: str
    face_verified: bool
    message: str

class ManualAttendanceRequest(BaseModel):
    session_id: int
    student_id: int
    status: str  # "present" or "absent"
    note: Optional[str] = None


class LeaveRequestCreate(BaseModel):
    reason: str
    date_from: date
    date_to: date

class LeaveRequestResponse(BaseModel):
    id: int
    student_id: int
    reason: str
    date_from: date
    date_to: date
    status: str
    reviewed_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LeaveReviewRequest(BaseModel):
    status: str  # "approved" or "rejected"

class VerifyUserRequest(BaseModel):
    roll_number: Optional[str] = None   # required if role == student
    class_id: Optional[int] = None      # optional, can assign later
    department: Optional[str] = None    # required if role == teacher

class ClassCreate(BaseModel):
    name: str

class ClassResponse(BaseModel):
    id: int
    name: str
    teacher_id: Optional[int] = None

    class Config:
        from_attributes = True