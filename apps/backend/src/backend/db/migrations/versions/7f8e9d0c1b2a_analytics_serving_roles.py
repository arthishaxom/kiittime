"""document analytics serving credential split

Revision ID: 7f8e9d0c1b2a
Revises: 6c8d7d8a0e1f
Create Date: 2026-09-11

Enforces intent: analytics worker uses ANALYTICS_WRITER_DATABASE_URL
(INSERT/UPDATE/DELETE), FastAPI uses ANALYTICS_DATABASE_URL (SELECT only).
On Aiven Free (single DB user) role separation is via distinct connection
strings in render.yaml; this migration records the contract in-schema.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "7f8e9d0c1b2a"
down_revision: str | Sequence[str] | None = "6c8d7d8a0e1f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "COMMENT ON SCHEMA analytics IS "
        "'Serving snapshot: worker=write via ANALYTICS_WRITER_DATABASE_URL, "
        "FastAPI=read-only via ANALYTICS_DATABASE_URL; shared 20-conn budget'"
    )
    op.execute(
        "COMMENT ON TABLE analytics.sync_metadata IS "
        "'status IN (published,pending,failed); stale = status!=published "
        "OR expected_date>data_as_of'"
    )


def downgrade() -> None:
    op.execute("COMMENT ON TABLE analytics.sync_metadata IS NULL")
    op.execute("COMMENT ON SCHEMA analytics IS NULL")
