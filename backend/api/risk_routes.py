"""
FastAPI routes for M2 — Risk Propagation + Risk Shadow.

Matches API_CONTRACT.md exactly:
  POST /api/risk/update              (M1 → M2)
  GET  /api/risk/propagation         (M2 → frontend)
  GET  /api/deployment/candidates    (M2 → M3)

Routes are thin — no propagation logic here. Everything real happens in
backend/services/propagation_service.py, which calls modules/m2_risk_propagation.
"""

from fastapi import APIRouter, HTTPException

from backend.models.schemas import (
    RiskUpdateRequest,
    RiskPropagationResponse,
    DeploymentCandidatesResponse,
)
from backend.services import propagation_service
from backend.services.propagation_service import NoRiskDataError
from modules.m2_risk_propagation.main import InvalidM1PayloadError

router = APIRouter(prefix="/api", tags=["M2 — Risk Propagation"])


@router.post("/risk/update")
def post_risk_update(payload: RiskUpdateRequest):
    """
    M1 posts current + 15-min-predicted risk here. Triggers propagation.

    Pydantic rejects malformed requests before this runs. The try/except is
    defense-in-depth for callers that bypass the schema.
    """
    try:
        output = propagation_service.update_risk(payload.model_dump())
    except InvalidM1PayloadError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {
        "status": "ok",
        "risk_shadows": output["risk_shadows"],
        "locations_processed": len(output["results"]),
    }


@router.get("/risk/propagation", response_model=RiskPropagationResponse)
def get_risk_propagation():
    """Frontend polls this for the current graph + risk state."""
    try:
        return propagation_service.get_propagation_response()
    except NoRiskDataError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/deployment/candidates", response_model=DeploymentCandidatesResponse)
def get_deployment_candidates():
    """M3 polls this for prioritized Risk Shadow / high-future-risk locations."""
    try:
        return propagation_service.get_deployment_candidates()
    except NoRiskDataError as e:
        raise HTTPException(status_code=409, detail=str(e))
