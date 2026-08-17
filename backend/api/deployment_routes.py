"""
FastAPI routes for M3 — Police Deployment Optimization.

Endpoints:
  POST /api/deployment/optimize          Run CP-SAT optimizer now
  GET  /api/deployment/recommendation    Fetch latest optimization result
  POST /api/deployment/override          Log a human override decision
  GET  /api/units                        List all police units
  POST /api/units                        Add / update unit states
"""

from fastapi import APIRouter, HTTPException

from backend.models.schemas import (
    UnitState,
    UnitStateList,
    OptimizationResponse,
    OverrideRequest,
    OverrideResponse,
)
from backend.services import propagation_service, deployment_service
from backend.services.propagation_service import NoRiskDataError

router = APIRouter(prefix="/api", tags=["M3 — Police Deployment"])


# ── Police Unit Registry ──────────────────────────────────────────────────

@router.get("/units", response_model=UnitStateList)
def get_units():
    """Return all registered police units and their current status."""
    return {"units": deployment_service.get_units()}


@router.post("/units", response_model=UnitStateList)
def upsert_units(payload: UnitStateList):
    """Add or update police units (upsert by unit_id)."""
    updated = deployment_service.upsert_units(payload.units)
    return {"units": updated}


@router.post("/deployment/reset")
def post_reset_deployment():
    """Reset all unit states and clear active allocations."""
    units = deployment_service.reset_units()
    return {"status": "ok", "message": "All units reset to available baseline", "units": [u.model_dump() for u in units]}


# ── Optimization ──────────────────────────────────────────────────────────

@router.post("/deployment/optimize", response_model=OptimizationResponse)
def post_optimize():
    """
    Trigger the M3 CP-SAT optimizer immediately.

    Pulls the latest deployment candidates from M2 propagation and runs
    the optimizer against the current unit registry. Updates unit states
    in-memory to reflect the new allocation.

    Returns 409 if no risk data has been posted yet (M1 hasn't started).
    """
    try:
        candidates_response = propagation_service.get_deployment_candidates()
    except NoRiskDataError as e:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot optimize: {e}. Call POST /api/risk/update first.",
        )

    candidates = candidates_response["candidates"]
    if not candidates:
        raise HTTPException(
            status_code=409,
            detail="No deployment candidates available from M2. No high-risk locations detected.",
        )

    result = deployment_service.optimize(candidates)
    return result


@router.get("/deployment/recommendation")
def get_recommendation():
    """
    Fetch the latest optimization recommendation (read-only, no re-run).

    Returns 409 if optimization has never been triggered.
    """
    rec = deployment_service.get_latest_recommendation()
    if rec is None:
        raise HTTPException(
            status_code=409,
            detail="No optimization has been run yet. Call POST /api/deployment/optimize first.",
        )
    return rec


# ── Human Override ────────────────────────────────────────────────────────

@router.post("/deployment/override", response_model=OverrideResponse)
def post_override(payload: OverrideRequest):
    """
    Log a human operator override decision for audit trail.

    This records the override but does NOT automatically re-run optimization.
    The operator is expected to manually adjust unit states if needed.
    """
    deployment_service.record_override(payload.model_dump())
    return OverrideResponse(
        status="override logged",
        recommendation_id=payload.recommendation_id,
        action=payload.action,
        logged=True,
    )


@router.get("/deployment/override/log")
def get_override_log():
    """Return the full audit log of human override decisions."""
    return {"overrides": deployment_service.get_override_log()}
