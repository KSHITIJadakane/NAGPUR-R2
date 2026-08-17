"""
Centralised configuration for NAGPUR-R2 backend.

All tuneable parameters live here so they can be overridden via environment
variables or a .env file without touching service logic.
"""

import os
from dotenv import load_dotenv

load_dotenv()

def _safe_int(val: str | None, default: int) -> int:
    if not val:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _safe_float(val: str | None, default: float) -> float:
    if not val:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


# ── Server ────────────────────────────────────────────────────────────────
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = _safe_int(os.getenv("PORT"), 8000)
CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")

# ── M1 ────────────────────────────────────────────────────────────────────
M1_POLL_INTERVAL_SECONDS: int = _safe_int(os.getenv("M1_POLL_INTERVAL_SECONDS"), 3)

# ── M2 Risk Propagation ───────────────────────────────────────────────────
RISK_SHADOW_THRESHOLD: float = _safe_float(os.getenv("RISK_SHADOW_THRESHOLD"), 70.0)
PROPAGATION_ALPHA: float = _safe_float(os.getenv("PROPAGATION_ALPHA"), 0.3)

# ── M3 Deployment ─────────────────────────────────────────────────────────
DEPLOYMENT_CANDIDATE_MIN_FUTURE_RISK: float = _safe_float(
    os.getenv("DEPLOYMENT_CANDIDATE_MIN_FUTURE_RISK"), 60.0
)
OPTIMIZER_TIME_LIMIT_SECONDS: int = _safe_int(os.getenv("OPTIMIZER_TIME_LIMIT_SECONDS"), 5)
DEFAULT_UNIT_COUNT: int = _safe_int(os.getenv("DEFAULT_UNIT_COUNT"), 10)

# ── XAI ──────────────────────────────────────────────────────────────────
XAI_AUDIT_LOG_PATH: str = os.getenv("XAI_AUDIT_LOG_PATH", "data/audit_log.json")

# ── Simulation ────────────────────────────────────────────────────────────
SIMULATIONS_DIR: str = os.getenv("SIMULATIONS_DIR", "simulations")

