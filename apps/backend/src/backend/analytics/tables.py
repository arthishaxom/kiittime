"""SQLAlchemy Core definitions for the analytics serving snapshot."""

import sqlalchemy as sa

ANALYTICS_SCHEMA = "analytics"
metadata = sa.MetaData()

gold_daily_usage = sa.Table(
    "gold_daily_usage",
    metadata,
    sa.Column("date", sa.Date, primary_key=True),
    sa.Column("dau", sa.Integer, nullable=False),
    sa.Column("total_api_calls", sa.Integer, nullable=False),
    sa.Column("timetable_searches", sa.Integer, nullable=False),
    schema=ANALYTICS_SCHEMA,
)

gold_endpoint_health = sa.Table(
    "gold_endpoint_health",
    metadata,
    sa.Column("date", sa.Date, primary_key=True),
    sa.Column("endpoint", sa.String, primary_key=True),
    sa.Column("total_calls", sa.Integer, nullable=False),
    sa.Column("p95_latency_ms", sa.Float, nullable=False),
    sa.Column("error_rate", sa.Float, nullable=False),
    schema=ANALYTICS_SCHEMA,
)

gold_section_trends = sa.Table(
    "gold_section_trends",
    metadata,
    sa.Column("date", sa.Date, primary_key=True),
    sa.Column("section_name", sa.String, primary_key=True),
    sa.Column("section_year", sa.Integer, primary_key=True),
    sa.Column("search_volume", sa.Integer, nullable=False),
    schema=ANALYTICS_SCHEMA,
)

sync_metadata = sa.Table(
    "sync_metadata",
    metadata,
    sa.Column("id", sa.SmallInteger, primary_key=True),
    sa.Column("data_as_of", sa.Date, nullable=True),
    sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("expected_date", sa.Date, nullable=True),
    sa.Column("status", sa.String, nullable=False),
    sa.Column("error_message", sa.Text, nullable=True),
    sa.Column(
        "updated_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    ),
    schema=ANALYTICS_SCHEMA,
)


SERVING_TABLES = (gold_daily_usage, gold_endpoint_health, gold_section_trends)
