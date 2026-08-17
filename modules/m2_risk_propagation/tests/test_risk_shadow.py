from modules.m2_risk_propagation.graph import RoadGraph, LocationNode
from modules.m2_risk_propagation.propagation import LocationRiskInput, PropagationResult
from modules.m2_risk_propagation.risk_shadow import evaluate


def _graph_with_node(police_units, required_units):
    graph = RoadGraph()
    graph.add_location(
        LocationNode("X", "X", 0.0, 0.0, police_units=police_units, required_units=required_units)
    )
    return graph


def _run(current_risk, future_risk, police_units, required_units, sources=None):
    graph = _graph_with_node(police_units, required_units)
    risk_inputs = {
        "X": LocationRiskInput("X", current_risk=current_risk, predicted_risk_15m=future_risk, confidence=0.9, traffic_pressure=0.5)
    }
    propagation_results = {
        "X": PropagationResult(
            location_id="X", base_risk=future_risk, future_risk=future_risk,
            propagation_pressure=10.0, propagation_sources=sources or [],
        )
    }
    return evaluate(graph, risk_inputs, propagation_results)["X"]


def test_all_three_conditions_true_is_shadow():
    result = _run(current_risk=54, future_risk=75, police_units=0, required_units=1, sources=["UPSTREAM"])
    assert result.risk_shadow is True
    assert "Upstream risk pressure detected" in result.reason
    assert "Future risk crosses threshold" in result.reason
    assert "Police coverage is insufficient" in result.reason


def test_current_risk_already_high_is_not_shadow():
    # current_risk >= 70 fails the "currently looks fine" condition
    result = _run(current_risk=75, future_risk=85, police_units=0, required_units=1)
    assert result.risk_shadow is False


def test_future_risk_below_threshold_is_not_shadow():
    result = _run(current_risk=54, future_risk=65, police_units=0, required_units=1)
    assert result.risk_shadow is False
    assert "Future risk crosses threshold" not in result.reason


def test_sufficient_coverage_is_not_shadow():
    result = _run(current_risk=54, future_risk=75, police_units=2, required_units=1)
    assert result.risk_shadow is False
    assert "Police coverage is insufficient" not in result.reason


def test_reason_list_empty_when_nothing_flagged():
    result = _run(current_risk=20, future_risk=25, police_units=1, required_units=1)
    assert result.risk_shadow is False
    assert result.reason == []
