from pydantic import BaseModel
from typing import List, Optional

class Candidate(BaseModel):
    location_id: str
    priority: float
    future_risk: float
    risk_shadow: bool
    required_units: int

class CandidateList(BaseModel):
    candidates: List[Candidate]

class Incident(BaseModel):
    location_id: str
    type: str
    severity: str

class UnitState(BaseModel):
    unit_id: str
    current_location: Optional[str] = None
    status: str # "AVAILABLE", "ASSIGNED", "OUT_OF_SERVICE"
    assigned_location: Optional[str] = None

class Allocation(BaseModel):
    unit_id: str
    assigned_to: str
    eta_minutes: int
    reason: str

class AllocationResult(BaseModel):
    recommendation_id: str
    allocations: List[Allocation]
    total_travel_time: int
    uncovered_risk: float
    coverage_loss: float
