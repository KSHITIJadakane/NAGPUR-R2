"""
M2 — Orchestrator

Single entrypoint the backend (and teammates) call. Everything else in this
module is an implementation detail behind run_m2().

    M1 payload + road graph + coverage  --run_m2()-->  M2 output contract

This is the one function M3/backend/frontend integration should import.
"""

from . import config
from .graph import RoadGraph
from .propagation import LocationRiskInput, propagate
from .risk_shadow import evaluate


class InvalidM1PayloadError(ValueError):
    """Raised when the M1 -> M2 payload is missing required fields.

    Kept as a distinct exception (rather than a bare ValueError) so backend
    routes can catch it specifically and return a clean 400/422 instead of
    a raw 500 with a stack trace during a live demo.
    """


REQUIRED_LOCATION_FIELDS = (
    "location_id",
    "current_risk",
    "predicted_risk_15m",
    "confidence",
    "traffic_pressure",
)


def _parse_m1_payload(m1_payload: dict) -> dict[str, LocationRiskInput]:
    """Parse the M1 -> M2 contract (API_CONTRACT.md: POST /api/risk/update).

    Fails loudly and specifically on malformed input rather than raising a
    bare KeyError, so a teammate's typo in the M1 payload surfaces as a
    clear message instead of a confusing crash mid-demo.
    """
    if "locations" not in m1_payload:
        raise InvalidM1PayloadError("M1 payload is missing the required 'locations' key")

    locations = m1_payload["locations"]
    if not isinstance(locations, list) or len(locations) == 0:
        raise InvalidM1PayloadError("'locations' must be a non-empty list")

    risk_inputs = {}
    for i, loc in enumerate(locations):
        missing = [f for f in REQUIRED_LOCATION_FIELDS if f not in loc]
        if missing:
            raise InvalidM1PayloadError(
                f"locations[{i}] is missing required field(s): {missing}"
            )
        risk_inputs[loc["location_id"]] = LocationRiskInput(
            location_id=loc["location_id"],
            current_risk=loc["current_risk"],
            predicted_risk_15m=loc["predicted_risk_15m"],
            confidence=loc["confidence"],
            traffic_pressure=loc["traffic_pressure"],
        )
    return risk_inputs


def run_m2(m1_payload: dict, graph: RoadGraph | None = None) -> dict:
    """
    Run the full M2 pipeline: propagation -> Risk Shadow.

    Args:
        m1_payload: dict matching API_CONTRACT.md's M1 -> M2 shape
                    ({"timestamp": ..., "locations": [...]})
        graph: a pre-built RoadGraph, or None to load from the default
               data files (data/locations.json, data/roads.json)

    Returns:
        dict with:
          - "results": list of per-location M2 output objects (DESIGN.md shape)
          - "risk_shadows": list of location_ids currently flagged
          - "propagation_paths": list of {source, target, path} for the frontend
    """
    graph = graph or RoadGraph.from_files()

    risk_inputs = _parse_m1_payload(m1_payload)
    propagation_results = propagate(graph, risk_inputs, alpha=config.ALPHA)
    shadow_results = evaluate(graph, risk_inputs, propagation_results)

    results = []
    risk_shadow_ids = []
    for location_id, shadow in shadow_results.items():
        results.append(
            {
                "location_id": shadow.location_id,
                "current_risk": shadow.current_risk,
                "future_risk": round(shadow.future_risk, 1),
                "risk_shadow": shadow.risk_shadow,
                "police_units": shadow.police_units,
                "required_units": shadow.required_units,
                "propagation_sources": shadow.propagation_sources,
                "propagation_pressure": shadow.propagation_pressure,
                "reason": shadow.reason,
            }
        )
        if shadow.risk_shadow:
            risk_shadow_ids.append(location_id)

    propagation_paths = []
    for r in results:
        for source in r["propagation_sources"]:
            path = graph.shortest_path(source, r["location_id"])
            if path:
                propagation_paths.append(
                    {"source": source, "target": r["location_id"], "path": path}
                )

    return {
        "results": results,
        "risk_shadows": risk_shadow_ids,
        "propagation_paths": propagation_paths,
    }


def to_frontend_response(m2_output: dict, graph: RoadGraph) -> dict:
    """Shape for GET /api/risk/propagation (API_CONTRACT.md)."""
    nodes = []
    for r in m2_output["results"]:
        node = graph.node(r["location_id"])
        nodes.append({**r, "name": node.name, "lat": node.lat, "lng": node.lng})

    return {
        "nodes": nodes,
        "edges": graph.to_edge_list(),
        "risk_shadows": m2_output["risk_shadows"],
        "propagation_paths": m2_output["propagation_paths"],
    }


def to_deployment_candidates(m2_output: dict) -> dict:
    """
    Shape for GET /api/deployment/candidates (API_CONTRACT.md).

    NOTE: "priority" is a simple placeholder heuristic for M3 to consume or
    override — it is NOT part of the core propagation contract. M3 owns real
    prioritization logic.
    """
    candidates = []
    for r in m2_output["results"]:
        multiplier = (
            config.PRIORITY_SHADOW_MULTIPLIER
            if r["risk_shadow"]
            else config.PRIORITY_NON_SHADOW_MULTIPLIER
        )
        priority = round((r["future_risk"] / 100) * multiplier, 2)
        candidates.append(
            {
                "location_id": r["location_id"],
                "priority": priority,
                "future_risk": r["future_risk"],
                "risk_shadow": r["risk_shadow"],
                "required_units": r["required_units"],
            }
        )

    candidates.sort(key=lambda c: c["priority"], reverse=True)
    return {"candidates": candidates}


if __name__ == "__main__":
    import json
    from pathlib import Path

    scenario_path = (
        Path(__file__).resolve().parents[2]
        / "simulations"
        / "m2_scenario_upstream_pressure.json"
    )
    with open(scenario_path, "r", encoding="utf-8") as f:
        m1_payload = json.load(f)

    output = run_m2(m1_payload)
    print(json.dumps(output, indent=2))
