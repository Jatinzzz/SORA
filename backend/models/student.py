from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    roll_number = Column(String, unique=True, nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=True)
    face_encoding = Column(String, nullable=True)

    user = relationship("User")
    class_ = relationship("Class")