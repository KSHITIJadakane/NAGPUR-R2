"""
XAI audit.py — Persistent override audit trail.

Writes every human override decision to a JSON-lines file so it survives
server restarts (unlike the in-memory list in deployment_service).

Format (one JSON object per line):
  {"logged_at": "...", "recommendation_id": "...", "action": "...",
   "reason": "...", "operator_note": "..."}
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from backend.config import XAI_AUDIT_LOG_PATH


def _log_path() -> Path:
    p = Path(XAI_AUDIT_LOG_PATH)
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def append_override(record: dict[str, Any]) -> None:
    """Append a single override record to the audit log file."""
    entry = {
        "logged_at": datetime.now(UTC).isoformat(),
        **record,
    }
    with open(_log_path(), "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def read_log(limit: int = 100) -> list[dict[str, Any]]:
    """Read the last `limit` entries from the audit log (most recent first)."""
    path = _log_path()
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]
    entries = [json.loads(l) for l in lines]
    return list(reversed(entries[-limit:]))


def clear_log() -> None:
    """Clear the audit log file (for testing only)."""
    path = _log_path()
    if path.exists():
        path.unlink()
