"""make course_name nullable

Revision ID: 0dabea0c5b70
Revises: 301dc7c59778
Create Date: 2026-07-12 19:42:51.606445

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0dabea0c5b70'
down_revision: Union[str, Sequence[str], None] = '301dc7c59778'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('courses', 'course_name',
               existing_type=sa.VARCHAR(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('courses', 'course_name',
               existing_type=sa.VARCHAR(),
               nullable=False)
