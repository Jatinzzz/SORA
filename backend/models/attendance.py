from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    status = Column(String, nullable=False, default="absent")
    marked_by = Column(String, nullable=False)
    face_verified = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("Session")
    student = relationship("Student")