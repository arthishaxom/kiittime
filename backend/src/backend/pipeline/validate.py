from collections import Counter

from backend.pipeline.resolve import ResolvedSession
from backend.pipeline.schemas import SessionRow


class ValidationError(Exception):
    """Raised when a batch of ResolvedSessions fails validation before gold upsert."""


def validate_resolved_sessions(
    sessions: list[ResolvedSession],
    rows: list[SessionRow] | None = None,
) -> None:
    """
    Check a batch of ResolvedSessions for conflicts before they're eligible
    for gold upsert. Raises ValidationError with details if any check fails.

    Currently checks:
    - No two sessions claim the same (section_id, day, period_number) slot.

    If the original ``rows`` are provided (same-index correspondence assumed),
    the error message is enriched with diagnostic hints to distinguish
    genuine data conflicts from year/semester mismatches.
    """
    slot_counts = Counter((s.section_id, s.day, s.period_number) for s in sessions)
    conflicts = [slot for slot, count in slot_counts.items() if count > 1]

    if conflicts:
        details = "; ".join(
            f"section_id={sid}, day={day}, period={period}" for sid, day, period in conflicts
        )
        parts: list[str] = [f"Duplicate session slots found: {details}"]

        if rows is not None:
            _append_year_hint(sessions, rows, conflicts, parts)

        raise ValidationError("".join(parts))


def _append_year_hint(
    sessions: list[ResolvedSession],
    rows: list[SessionRow],
    conflicts: list[tuple[int, str, int]],
    parts: list[str],
) -> None:
    """Append a year/semester-mismatch hint to *parts* if the colliding rows
    carry different course/faculty/room content (as opposed to being
    near-identical duplicate rows)."""
    has_different_content = False
    for conflict_sid, conflict_day, conflict_period in conflicts:
        distinct: set[tuple[str, str, str]] = set()
        for i, s in enumerate(sessions):
            if (
                s.section_id == conflict_sid
                and s.day == conflict_day
                and s.period_number == conflict_period
                and i < len(rows)
            ):
                r = rows[i]
                distinct.add((r.course_code, r.faculty_name, r.room_number))
        if len(distinct) > 1:
            has_different_content = True
            break

    if has_different_content:
        parts.append(
            " This may indicate the uploaded file contains multiple"
            " years/semesters of data, or the wrong 'year' was specified"
            " — verify the source file covers a single year before re-uploading."
        )
