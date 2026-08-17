"""
M2 — Risk Propagation + Risk Shadow
Centralized configuration.

All numbers here are prototype assumptions (per CONTEXT.md's "technical
honesty" requirement) — they are not fitted to real traffic data. Keeping
them in one file means tuning during demo rehearsal never requires touching
propagation/risk_shadow logic.
"""

from pathlib import Path

# --- Paths ---
MODULE_DIR = Path(__file__).resolve().parent
LOCATIONS_FILE = MODULE_DIR / "data" / "locations.json"
ROADS_FILE = MODULE_DIR / "data" / "roads.json"

# --- Propagation formula ---
# FutureRisk(j) = BaseRisk(j) + ALPHA * SUM(P(i,j))
# Start conservative; raise if propagation effects look too weak in demo,
# lower if future_risk keeps saturating at 100.
ALPHA = 0.3

# Prototype time-decay lookup (DESIGN.md). Keys are the upper bound (minutes)
# of each bucket; decay applies if travel_time_min <= key.
TIME_DECAY_BUCKETS = [
    (3, 1.0),
    (5, 0.8),
    (8, 0.6),
    (12, 0.4),
]
TIME_DECAY_DEFAULT = 0.2  # > 12 min

# --- Risk clamp ---
RISK_MIN = 0
RISK_MAX = 100

# --- Risk Shadow thresholds (DESIGN.md) ---
SHADOW_CURRENT_RISK_MAX = 70   # current_risk must be BELOW this
SHADOW_FUTURE_RISK_MIN = 70    # future_risk must be AT/ABOVE this

# --- Deployment candidate priority heuristic (placeholder for M3) ---
# Not part of the core propagation contract — M3 owns real prioritization.
# This just gives /api/deployment/candidates a non-trivial ordering.
PRIORITY_SHADOW_MULTIPLIER = 1.0
PRIORITY_NON_SHADOW_MULTIPLIER = 0.6
