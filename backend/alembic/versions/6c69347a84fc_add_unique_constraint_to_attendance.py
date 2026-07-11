"""add unique constraint to attendance

Revision ID: 6c69347a84fc
Revises: 69faa86a7ac5
Create Date: 2026-07-11 18:25:55.480689

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6c69347a84fc'
down_revision: Union[str, Sequence[str], None] = '69faa86a7ac5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_attendance_session_student",
        "attendance",
        ["session_id", "student_id"]
    )

def downgrade() -> None:
    op.drop_constraint("uq_attendance_session_student", "attendance", type_="unique")
