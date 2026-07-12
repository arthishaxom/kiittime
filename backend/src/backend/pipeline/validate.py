from collections import Counter

from backend.pipeline.resolve import ResolvedSession


class ValidationError(Exception):
    """Raised when a batch of ResolvedSessions fails validation before gold upsert."""


def validate_resolved_sessions(sessions: list[ResolvedSession]) -> None:
    """
    Check a batch of ResolvedSessions for conflicts before they're eligible
    for gold upsert. Raises ValidationError with details if any check fails.

    Currently checks:
    - No two sessions claim the same (section_id, day, period_number) slot.
    """
    slot_counts = Counter((s.section_id, s.day, s.period_number) for s in sessions)
    conflicts = [slot for slot, count in slot_counts.items() if count > 1]

    if conflicts:
        details = "; ".join(
            f"section_id={sid}, day={day}, period={period}" for sid, day, period in conflicts
        )
        raise ValidationError(f"Duplicate session slots found: {details}")
