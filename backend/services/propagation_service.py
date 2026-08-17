"""
Service layer for M2 — Risk Propagation.

Holds the latest M1 payload and the road graph in memory (hackathon MVP —
no DB per ARCHITECTURE.md's simplicity constraint). The graph is loaded lazily
on first use. POST /api/risk/update replaces the latest risk snapshot, and
GET requests recompute propagation from whatever was last posted.

This is the ONLY file that should import from modules.m2_risk_propagation.
Everything else in backend/ talks to M2 through this service.
"""

from modules.m2_risk_propagation.graph import RoadGraph
from modules.m2_risk_propagation.main import (
    run_m2,
    to_frontend_response,
    to_deployment_candidates,
)

_graph: RoadGraph | None = None
_latest_m1_payload: dict | None = None
_latest_output: dict | None = None

# ── Incident overrides applied on top of M1 payloads ─────────────────────
# Maps location_id -> extra risk bump to add before propagation.
# Reset to 0 after they are consumed (one-shot injection per incident post).
_incident_bumps: dict[str, float] = {}


def _get_graph() -> RoadGraph:
    global _graph
    if _graph is None:
        _graph = RoadGraph.from_files()
    return _graph


def update_risk(m1_payload: dict) -> dict:
    """Called by POST /api/risk/update. Recomputes propagation immediately."""
    global _latest_m1_payload, _latest_output
    # Apply any pending incident bumps
    if _incident_bumps:
        patched = _apply_incident_bumps(m1_payload)
    else:
        patched = m1_payload

    _latest_m1_payload = patched
    _latest_output = run_m2(patched, graph=_get_graph())
    return _latest_output


def _apply_incident_bumps(payload: dict) -> dict:
    """Merge incident risk bumps into the M1 payload before propagation."""
    import copy
    patched = copy.deepcopy(payload)
    for loc in patched.get("locations", []):
        bump = _incident_bumps.get(loc["location_id"], 0.0)
        if bump:
            loc["current_risk"] = min(100.0, loc["current_risk"] + bump)
            loc["predicted_risk_15m"] = min(100.0, loc["predicted_risk_15m"] + bump)
    # Incident bumps are one-shot — clear after application
    _incident_bumps.clear()
    return patched


def inject_incident(location_id: str, risk_bump: float) -> float:
    """
    Queue a risk bump for a location. Applied on the next risk update cycle.
    If risk data already exists, triggers immediate re-propagation.
    Returns the new effective current_risk for the location (or bump value if no data yet).
    """
    _incident_bumps[location_id] = risk_bump

    if _latest_m1_payload is None:
        return risk_bump  # No data yet; bump will apply on first update

    # Immediate re-propagation with the bump applied
    result = update_risk(_latest_m1_payload)
    for loc in result["results"]:
        if loc["location_id"] == location_id:
            return loc["current_risk"]
    return risk_bump


def get_propagation_response() -> dict:
    """Called by GET /api/risk/propagation. Uses the last posted M1 snapshot."""
    _ensure_data_available()
    return to_frontend_response(_latest_output, _get_graph())


def get_deployment_candidates() -> dict:
    """Called by GET /api/deployment/candidates. Uses the last posted M1 snapshot."""
    _ensure_data_available()
    return to_deployment_candidates(_latest_output)


def _ensure_data_available() -> None:
    if _latest_output is None:
        raise NoRiskDataError(
            "No risk data has been posted yet. Call POST /api/risk/update first."
        )


class NoRiskDataError(Exception):
    """Raised when a GET endpoint is called before any M1 data has arrived."""
