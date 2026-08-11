from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    department = Column(String, nullable=True)  # deprecated, kept for compatibility
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)

    user = relationship("User")
    department_ref = relationship("Department")