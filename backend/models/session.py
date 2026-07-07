from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    qr_token = Column(String, nullable=True)
    qr_expiry = Column(DateTime(timezone=True), nullable=True)

    class_ = relationship("Class")
    teacher = relationship("Teacher")