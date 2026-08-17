import json
from pathlib import Path

import pytest

from modules.m2_risk_propagation.main import run_m2, to_frontend_response, to_deployment_candidates
from modules.m2_risk_propagation.graph import RoadGraph

SCENARIO_PATH = (
    Path(__file__).resolve().parents[3] / "simulations" / "m2_scenario_upstream_pressure.json"
)


@pytest.fixture
def scenario_payload():
    with open(SCENARIO_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_zero_mile_becomes_risk_shadow(scenario_payload):
    """
    MODULES.md success condition: an upstream high-risk state (Wardha Road)
    increases downstream future risk, and an unmanned threshold-crossing
    location (Zero Mile) is flagged.
    """
    output = run_m2(scenario_payload)
    assert "ZERO_MILE" in output["risk_shadows"]

    zero_mile = next(r for r in output["results"] if r["location_id"] == "ZERO_MILE")
    assert zero_mile["future_risk"] >= 70
    assert zero_mile["current_risk"] < 70
    assert "WARDHA_ROAD" in zero_mile["propagation_sources"]


def test_output_shape_matches_design_doc_contract(scenario_payload):
    output = run_m2(scenario_payload)
    required_keys = {
        "location_id", "current_risk", "future_risk", "risk_shadow",
        "police_units", "required_units", "propagation_sources",
        "propagation_pressure", "reason",
    }
    for result in output["results"]:
        assert required_keys.issubset(result.keys())


def test_frontend_response_shape(scenario_payload):
    graph = RoadGraph.from_files()
    output = run_m2(scenario_payload, graph=graph)
    response = to_frontend_response(output, graph)
    assert set(response.keys()) == {"nodes", "edges", "risk_shadows", "propagation_paths"}
    assert len(response["nodes"]) == 6
    assert len(response["edges"]) == 7


def test_deployment_candidates_shape_matches_api_contract(scenario_payload):
    output = run_m2(scenario_payload)
    response = to_deployment_candidates(output)
    assert "candidates" in response
    for c in response["candidates"]:
        assert set(c.keys()) == {"location_id", "priority", "future_risk", "risk_shadow", "required_units"}

    # Risk Shadow location should rank highly since it's flagged
    zero_mile_candidate = next(c for c in response["candidates"] if c["location_id"] == "ZERO_MILE")
    assert zero_mile_candidate["risk_shadow"] is True


def test_candidates_sorted_by_priority_descending(scenario_payload):
    output = run_m2(scenario_payload)
    response = to_deployment_candidates(output)
    priorities = [c["priority"] for c in response["candidates"]]
    assert priorities == sorted(priorities, reverse=True)
