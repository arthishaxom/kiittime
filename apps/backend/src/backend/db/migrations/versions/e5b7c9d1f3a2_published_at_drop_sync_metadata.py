"""add serving published_at and drop sync_metadata

Revision ID: e5b7c9d1f3a2
Revises: c3f0a1b2d4e5
Create Date: 2026-09-15

Freshness is derived at read time: `data_as_of` is the newest accounted-for
date (Gold row or Gap Ledger row) and `synced_at` is the newest `published_at`
on the serving snapshot. The stored `sync_metadata` pointer is dropped; the
`publish()` transaction is the atomic publication boundary.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e5b7c9d1f3a2"
down_revision: str | Sequence[str] | None = "c3f0a1b2d4e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SCHEMA = "analytics"
SERVING_TABLES = ("gold_daily_usage", "gold_endpoint_health", "gold_section_trends")


def upgrade() -> None:
    for table in SERVING_TABLES:
        op.add_column(
            table,
            sa.Column(
                "published_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            schema=SCHEMA,
        )
    for table in SERVING_TABLES:
        op.alter_column(table, "published_at", server_default=None, schema=SCHEMA)

    op.drop_table("sync_metadata", schema=SCHEMA)


def downgrade() -> None:
    op.create_table(
        "sync_metadata",
        sa.Column("id", sa.SmallInteger(), nullable=False),
        sa.Column("data_as_of", sa.Date(), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expected_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_analytics_sync_metadata"),
        sa.CheckConstraint(
            "status IN ('published', 'pending', 'failed')",
            name="ck_analytics_sync_metadata_status",
        ),
        schema=SCHEMA,
    )
    for table in SERVING_TABLES:
        op.drop_column(table, "published_at", schema=SCHEMA)
