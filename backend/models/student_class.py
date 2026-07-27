from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base

class StudentClass(Base):
    __tablename__ = "student_classes"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)

    student = relationship("Student")
    class_ = relationship("Class")

    __table_args__ = (
        UniqueConstraint("student_id", "class_id", name="uq_student_class"),
    )