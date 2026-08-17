"""
FastAPI routes for scenario simulation.

  GET  /api/simulations              List available scenarios
  POST /api/simulations/run          Load and run a named scenario
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services import simulation_service

router = APIRouter(prefix="/api/simulations", tags=["Simulations"])


class ScenarioRequest(BaseModel):
    scenario: str  # "festival" | "accident" | "rain"


@router.get("")
def list_scenarios():
    """List all available named scenarios."""
    return {"scenarios": simulation_service.list_scenarios()}


@router.post("/run")
def run_scenario(payload: ScenarioRequest):
    """
    Load and run a named scenario.

    Seeds the M2 propagation layer and auto-runs M3 optimization.
    Returns combined propagation + optimization results.
    """
    try:
        result = simulation_service.run_scenario(payload.scenario)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result
