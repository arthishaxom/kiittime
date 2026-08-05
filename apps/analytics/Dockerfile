FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV UV_HTTP_TIMEOUT=100

WORKDIR /app

COPY pyproject.toml uv.lock* README.md ./

RUN uv sync --no-install-project

COPY src/ ./src/

RUN uv sync

FROM python:3.12-slim AS runtime

RUN useradd --create-home appuser
USER appuser

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "analytics.flows.nightly_etl"]
