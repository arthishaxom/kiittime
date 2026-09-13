"""create PostgreSQL analytics gap ledger

Revision ID: c3f0a1b2d4e5
Revises: 7f8e9d0c1b2a
Create Date: 2026-09-13

The Gap Ledger is the only durable record of Terminal Gap decisions: one
terminal decision per (date, source). The unique key makes concurrent,
idempotent upserts safe, replacing the R2 whole-object read-modify-write.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3f0a1b2d4e5"
down_revision: str | Sequence[str] | None = "7f8e9d0c1b2a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SCHEMA = "analytics"


def upgrade() -> None:
    op.create_table(
        "pipeline_gaps",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("date", "source", name="pk_analytics_pipeline_gaps"),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("pipeline_gaps", schema=SCHEMA)
