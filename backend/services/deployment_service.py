"""
Service layer for M3 — Police Deployment Optimization.

Manages the police unit registry in memory (hackathon MVP).
Orchestrates the M3 CP-SAT optimizer by pulling candidates from
propagation_service and running the optimization.

This is the ONLY file that should import from modules.m3_police_deployment.
"""

from typing import Optional
from modules.m3_police_deployment.models import (
    Candidate,
    UnitState,
    AllocationResult,
)
from modules.m3_police_deployment.redeployment import calculate_redeployment
from modules.m3_police_deployment.simulation import simulate_what_if

# ── In-memory state ───────────────────────────────────────────────────────
_units: list[UnitState] = []
_latest_recommendation: Optional[AllocationResult] = None
_latest_redeployment_summary: dict = {}
_latest_what_if: dict = {}
_override_log: list[dict] = []

# Synthetic default units covering all 6 pilot locations
_DEFAULT_UNITS = [
    UnitState(unit_id="UNIT-01", current_location="WARDHA_ROAD", status="AVAILABLE"),
    UnitState(unit_id="UNIT-02", current_location="WARDHA_ROAD", status="AVAILABLE"),
    UnitState(unit_id="UNIT-03", current_location="ZERO_MILE", status="AVAILABLE"),
    UnitState(unit_id="UNIT-04", current_location="SITABULDI", status="AVAILABLE"),
    UnitState(unit_id="UNIT-05", current_location="SITABULDI", status="AVAILABLE"),
    UnitState(unit_id="UNIT-06", current_location="MAHAL", status="AVAILABLE"),
    UnitState(unit_id="UNIT-07", current_location="LAXMI_NAGAR", status="AVAILABLE"),
    UnitState(unit_id="UNIT-08", current_location="LAXMI_NAGAR", status="AVAILABLE"),
    UnitState(unit_id="UNIT-09", current_location="MANEWADA", status="AVAILABLE"),
    UnitState(unit_id="UNIT-10", current_location="MANEWADA", status="AVAILABLE"),
]


def seed_default_units() -> None:
    """Pre-populate the unit registry with synthetic demo data."""
    global _units
    if not _units:
        _units = [u.model_copy() for u in _DEFAULT_UNITS]


# ── Unit management ───────────────────────────────────────────────────────

def get_units() -> list[UnitState]:
    return _units


def upsert_units(new_units: list[UnitState]) -> list[UnitState]:
    """Add or update units by unit_id."""
    unit_map = {u.unit_id: u for u in _units}
    for u in new_units:
        unit_map[u.unit_id] = u
    _units[:] = list(unit_map.values())
    return _units


def reset_units() -> list[UnitState]:
    """Reset all unit states back to default available units."""
    global _units, _latest_recommendation, _latest_redeployment_summary, _latest_what_if
    _units = [u.model_copy() for u in _DEFAULT_UNITS]
    _latest_recommendation = None
    _latest_redeployment_summary = {}
    _latest_what_if = {}
    return _units


# ── Optimization ──────────────────────────────────────────────────────────

def optimize(candidates_raw: list[dict]) -> dict:
    """
    Run the M3 CP-SAT optimizer.

    Args:
        candidates_raw: list of dicts matching the DeploymentCandidate schema
                        (returned from propagation_service.get_deployment_candidates())

    Returns:
        dict with recommendation_id, allocations, totals, redeployment_summary, what_if
    """
    global _latest_recommendation, _latest_redeployment_summary, _latest_what_if

    candidates = [
        Candidate(
            location_id=c["location_id"],
            priority=c["priority"],
            future_risk=c["future_risk"],
            risk_shadow=c["risk_shadow"],
            required_units=c["required_units"],
        )
        for c in candidates_raw
    ]

    recommendation, summary = calculate_redeployment(candidates, _units)
    what_if = simulate_what_if(candidates, _units, recommendation.allocations)

    # Update deployed unit states based on allocations
    _apply_allocations(recommendation.allocations)

    _latest_recommendation = recommendation
    _latest_redeployment_summary = summary
    _latest_what_if = what_if

    return _build_response(recommendation, summary, what_if)


def _apply_allocations(allocations) -> None:
    """Update unit states after optimization — mark assigned units."""
    # Reset previously assigned units back to AVAILABLE
    for u in _units:
        if u.status == "ASSIGNED":
            u.status = "AVAILABLE"
            u.assigned_location = None

    allocated_ids = {a.unit_id for a in allocations}
    for u in _units:
        if u.unit_id in allocated_ids:
            alloc = next(a for a in allocations if a.unit_id == u.unit_id)
            u.status = "ASSIGNED"
            u.assigned_location = alloc.assigned_to
            u.current_location = alloc.assigned_to


def get_latest_recommendation() -> Optional[dict]:
    """Return the last optimization result, or None if never run."""
    if _latest_recommendation is None:
        return None
    return _build_response(
        _latest_recommendation, _latest_redeployment_summary, _latest_what_if
    )


def _build_response(recommendation: AllocationResult, summary: dict, what_if: dict) -> dict:
    return {
        "recommendation_id": recommendation.recommendation_id,
        "allocations": [a.model_dump() for a in recommendation.allocations],
        "total_travel_time": recommendation.total_travel_time,
        "uncovered_risk": recommendation.uncovered_risk,
        "coverage_loss": recommendation.coverage_loss,
        "redeployment_summary": summary,
        "what_if": what_if,
    }


# ── Override log ──────────────────────────────────────────────────────────

def record_override(override: dict) -> None:
    """Log a human override decision for audit."""
    import datetime
    _override_log.append({
        **override,
        "logged_at": datetime.datetime.now(datetime.UTC).isoformat(),
    })


def get_override_log() -> list[dict]:
    return _override_log
