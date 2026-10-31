"""Stable publication dates for articles submitted through GitHub issues.

Approval, pull-request merge, and GitHub Pages deployment can occur days
after an article was submitted. The immutable source issue creation time is
the article's original date; later edits belong in last_modified_at.
"""

from datetime import datetime, timezone


def issue_creation_timestamp(issue):
    """Return an issue's original creation moment in UTC ISO 8601 format.

    Never fall back to the current time: doing so silently changes a post's
    date when publication is delayed or retried.
    """
    raw = issue.get("created_at") if isinstance(issue, dict) else None
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("Source issue is missing its original created_at timestamp")
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Source issue has an invalid created_at timestamp") from exc
    if parsed.tzinfo is None:
        raise ValueError("Source issue created_at timestamp must include a timezone")
    return parsed.astimezone(timezone.utc).isoformat(timespec="seconds")
