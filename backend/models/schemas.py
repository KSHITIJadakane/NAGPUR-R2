"""
Pydantic schemas for the entire NAGPUR-R2 API (all modules).

Mirrors API_CONTRACT.md exactly. Organised by data-flow section.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


# ═══════════════════════════════════════════════════════════════════════════
# M1 → M2 : POST /api/risk/update
# ═══════════════════════════════════════════════════════════════════════════

class LocationRiskUpdate(BaseModel):
    location_id: str
    current_risk: float = Field(ge=0, le=100)
    predicted_risk_15m: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    traffic_pressure: float = Field(ge=0, le=1)


class RiskUpdateRequest(BaseModel):
    timestamp: str
    locations: List[LocationRiskUpdate]


# ═══════════════════════════════════════════════════════════════════════════
# M2 → Frontend : GET /api/risk/propagation
# ═══════════════════════════════════════════════════════════════════════════

class CameraConfigSchema(BaseModel):
    url: Optional[str] = None
    enabled: bool = True
    name: Optional[str] = None
    type: str = "IP_STREAM"  # IP_STREAM | WEBCAM | AI_PRESET
    preset_id: Optional[str] = None
    fps: Optional[int] = 30
    resolution: Optional[str] = "1080p FHD"
    status: str = "ONLINE"
    last_updated: Optional[str] = None
    videoStartOffset: Optional[int] = 0  # seconds to seek into video on load


class PropagationNode(BaseModel):
    location_id: str
    name: str
    lat: float
    lng: float
    current_risk: float
    future_risk: float
    risk_shadow: bool
    police_units: int
    required_units: int
    propagation_sources: List[str]
    propagation_pressure: float
    reason: List[str]
    camera: Optional[CameraConfigSchema] = None


class PropagationEdge(BaseModel):
    source: str
    target: str
    connection_strength: float
    travel_time_min: float
    road_type: str


class PropagationPath(BaseModel):
    source: str
    target: str
    path: List[str]


class RiskPropagationResponse(BaseModel):
    nodes: List[PropagationNode]
    edges: List[PropagationEdge]
    risk_shadows: List[str]
    propagation_paths: List[PropagationPath]


# ═══════════════════════════════════════════════════════════════════════════
# M2 → M3 : GET /api/deployment/candidates
# ═══════════════════════════════════════════════════════════════════════════

class DeploymentCandidate(BaseModel):
    location_id: str
    priority: float
    future_risk: float
    risk_shadow: bool
    required_units: int


class DeploymentCandidatesResponse(BaseModel):
    candidates: List[DeploymentCandidate]


# ═══════════════════════════════════════════════════════════════════════════
# Police Unit State  (managed by /api/units)
# ═══════════════════════════════════════════════════════════════════════════

class UnitState(BaseModel):
    unit_id: str
    current_location: Optional[str] = None
    status: str = Field(
        description="AVAILABLE | ASSIGNED | OUT_OF_SERVICE",
        pattern="^(AVAILABLE|ASSIGNED|OUT_OF_SERVICE)$",
    )
    assigned_location: Optional[str] = None


class UnitStateList(BaseModel):
    units: List[UnitState]


# ═══════════════════════════════════════════════════════════════════════════
# M3 Optimizer Output
# ═══════════════════════════════════════════════════════════════════════════

class Allocation(BaseModel):
    unit_id: str
    assigned_to: str
    eta_minutes: int
    reason: str


class WhatIfScenario(BaseModel):
    scenario: str
    total_travel_time: int
    total_uncovered_risk: float


class OptimizationResponse(BaseModel):
    recommendation_id: str
    allocations: List[Allocation]
    total_travel_time: int
    uncovered_risk: float
    coverage_loss: float
    redeployment_summary: dict
    what_if: dict


# ═══════════════════════════════════════════════════════════════════════════
# Incident  (POST /api/incidents)
# ═══════════════════════════════════════════════════════════════════════════

class IncidentRequest(BaseModel):
    location_id: str
    type: str = Field(description="e.g. ACCIDENT, CROWD, PROTEST, FIRE")
    severity: str = Field(
        description="LOW | MEDIUM | HIGH | CRITICAL",
        pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$",
    )


class IncidentResponse(BaseModel):
    status: str
    location_id: str
    risk_bump_applied: float
    new_current_risk: float
    triggered_re_optimization: bool


# ═══════════════════════════════════════════════════════════════════════════
# Override  (POST /api/deployment/override)
# ═══════════════════════════════════════════════════════════════════════════

class OverrideRequest(BaseModel):
    recommendation_id: str
    action: str = Field(
        description="ACCEPT | OVERRIDE | REJECT",
        pattern="^(ACCEPT|OVERRIDE|REJECT)$",
    )
    reason: str
    operator_note: Optional[str] = None


class OverrideResponse(BaseModel):
    status: str
    recommendation_id: str
    action: str
    logged: bool
