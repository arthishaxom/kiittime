"""add bronze_snapshots table, explicit schema qualification on FKs

Revision ID: 301dc7c59778
Revises: 53f4fae4babb
Create Date: 2026-07-12 19:06:03.898826

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "301dc7c59778"
down_revision: str | Sequence[str] | None = "53f4fae4babb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "bronze_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.String(), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("source_filename", sa.String(), nullable=False),
        sa.Column("storage_path", sa.String(), nullable=True),
        sa.Column(
            "scope_section_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "parsed_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "approved",
                "rejected",
                name="snapshot_status",
                schema="kiittime",
            ),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="kiittime",
    )

    # explicit schema-qualify the 4 FKs on class_sessions (was implicit via MetaData default)
    op.drop_constraint(
        "class_sessions_course_id_fkey",
        "class_sessions",
        schema="kiittime",
        type_="foreignkey",
    )
    op.drop_constraint(
        "class_sessions_faculty_id_fkey",
        "class_sessions",
        schema="kiittime",
        type_="foreignkey",
    )
    op.drop_constraint(
        "class_sessions_room_id_fkey",
        "class_sessions",
        schema="kiittime",
        type_="foreignkey",
    )
    op.drop_constraint(
        "class_sessions_section_id_fkey",
        "class_sessions",
        schema="kiittime",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "class_sessions_course_id_fkey",
        "class_sessions",
        "courses",
        ["course_id"],
        ["id"],
        source_schema="kiittime",
        referent_schema="kiittime",
    )
    op.create_foreign_key(
        "class_sessions_faculty_id_fkey",
        "class_sessions",
        "faculty",
        ["faculty_id"],
        ["id"],
        source_schema="kiittime",
        referent_schema="kiittime",
    )
    op.create_foreign_key(
        "class_sessions_room_id_fkey",
        "class_sessions",
        "rooms",
        ["room_id"],
        ["id"],
        source_schema="kiittime",
        referent_schema="kiittime",
    )
    op.create_foreign_key(
        "class_sessions_section_id_fkey",
        "class_sessions",
        "sections",
        ["section_id"],
        ["id"],
        source_schema="kiittime",
        referent_schema="kiittime",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "class_sessions_course_id_fkey",
        "class_sessions",
        schema="kiittime",
        type_="foreignkey",
    )
    op.drop_constraint(
        "class_sessions_faculty_id_fkey",
        "class_sessions",
        schema="kiittime",
        type_="foreignkey",
    )
    op.drop_constraint(
        "class_sessions_room_id_fkey",
        "class_sessions",
        schema="kiittime",
        type_="foreignkey",
    )
    op.drop_constraint(
        "class_sessions_section_id_fkey",
        "class_sessions",
        schema="kiittime",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "class_sessions_course_id_fkey",
        "class_sessions",
        "courses",
        ["course_id"],
        ["id"],
    )
    op.create_foreign_key(
        "class_sessions_faculty_id_fkey",
        "class_sessions",
        "faculty",
        ["faculty_id"],
        ["id"],
    )
    op.create_foreign_key(
        "class_sessions_room_id_fkey",
        "class_sessions",
        "rooms",
        ["room_id"],
        ["id"],
    )
    op.create_foreign_key(
        "class_sessions_section_id_fkey",
        "class_sessions",
        "sections",
        ["section_id"],
        ["id"],
    )

    op.drop_table("bronze_snapshots", schema="kiittime")
