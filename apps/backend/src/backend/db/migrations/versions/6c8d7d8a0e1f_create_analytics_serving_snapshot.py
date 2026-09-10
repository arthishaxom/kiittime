"""create PostgreSQL analytics serving snapshot tables

Revision ID: 6c8d7d8a0e1f
Revises: db31445784ed
Create Date: 2026-09-08

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6c8d7d8a0e1f"
down_revision: str | Sequence[str] | None = "db31445784ed"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SCHEMA = "analytics"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "gold_daily_usage",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("dau", sa.Integer(), nullable=False),
        sa.Column("total_api_calls", sa.Integer(), nullable=False),
        sa.Column("timetable_searches", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("date", name="pk_gold_daily_usage"),
        schema=SCHEMA,
    )
    op.create_index("ix_gold_daily_usage_date", "gold_daily_usage", ["date"], schema=SCHEMA)

    op.create_table(
        "gold_endpoint_health",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("endpoint", sa.String(), nullable=False),
        sa.Column("total_calls", sa.Integer(), nullable=False),
        sa.Column("p95_latency_ms", sa.Float(), nullable=False),
        sa.Column("error_rate", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("date", "endpoint", name="pk_gold_endpoint_health"),
        schema=SCHEMA,
    )
    op.create_index("ix_gold_endpoint_health_date", "gold_endpoint_health", ["date"], schema=SCHEMA)

    op.create_table(
        "gold_section_trends",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("section_name", sa.String(), nullable=False),
        sa.Column("section_year", sa.Integer(), nullable=False),
        sa.Column("search_volume", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint(
            "date",
            "section_name",
            "section_year",
            name="pk_gold_section_trends",
        ),
        schema=SCHEMA,
    )
    op.create_index("ix_gold_section_trends_date", "gold_section_trends", ["date"], schema=SCHEMA)

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


def downgrade() -> None:
    op.drop_table("sync_metadata", schema=SCHEMA)
    op.drop_index("ix_gold_section_trends_date", table_name="gold_section_trends", schema=SCHEMA)
    op.drop_table("gold_section_trends", schema=SCHEMA)
    op.drop_index("ix_gold_endpoint_health_date", table_name="gold_endpoint_health", schema=SCHEMA)
    op.drop_table("gold_endpoint_health", schema=SCHEMA)
    op.drop_index("ix_gold_daily_usage_date", table_name="gold_daily_usage", schema=SCHEMA)
    op.drop_table("gold_daily_usage", schema=SCHEMA)
    op.execute(f"DROP SCHEMA IF EXISTS {SCHEMA}")
