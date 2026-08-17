"""
FastAPI routes for incident injection.

  POST /api/incidents

Per API_CONTRACT.md flow:
  incident → risk update → propagation → Risk Shadow update → re-optimization → recommendation

The endpoint:
  1. Validates the incident
  2. Calculates a risk bump based on severity
  3. Applies the bump to the propagation service immediately
  4. Triggers M3 re-optimization if a previous run exists
  5. Returns the new risk level and whether re-optimization ran
"""

from fastapi import APIRouter, HTTPException

from backend.models.schemas import IncidentRequest, IncidentResponse
from backend.services import propagation_service, deployment_service
from backend.services.propagation_service import NoRiskDataError

router = APIRouter(prefix="/api", tags=["Incidents"])

# Severity → risk bump mapping (prototype values — tune for demo)
_SEVERITY_BUMP = {
    "LOW": 10.0,
    "MEDIUM": 20.0,
    "HIGH": 35.0,
    "CRITICAL": 50.0,
}


@router.post("/incidents", response_model=IncidentResponse)
def post_incident(payload: IncidentRequest):
    """
    Inject an incident at a specific location.

    Bumps its current_risk and predicted_risk_15m by a severity-scaled amount,
    re-runs M2 propagation, and (if a previous optimization exists) triggers
    M3 re-optimization automatically.
    """
    bump = _SEVERITY_BUMP.get(payload.severity.upper(), 20.0)

    try:
        new_risk = propagation_service.inject_incident(payload.location_id, bump)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inject incident: {e}")

    # Attempt re-optimization if we have prior results
    re_optimized = False
    if deployment_service.get_latest_recommendation() is not None:
        try:
            candidates_response = propagation_service.get_deployment_candidates()
            candidates = candidates_response.get("candidates", [])
            if candidates:
                deployment_service.optimize(candidates)
                re_optimized = True
        except NoRiskDataError:
            pass  # No data yet; will run on next optimize call

    return IncidentResponse(
        status="incident injected",
        location_id=payload.location_id,
        risk_bump_applied=bump,
        new_current_risk=new_risk,
        triggered_re_optimization=re_optimized,
    )
