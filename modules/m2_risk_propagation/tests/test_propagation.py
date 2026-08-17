import pytest

from modules.m2_risk_propagation.propagation import (
    LocationRiskInput,
    compute_pressure,
    time_decay,
    propagate,
)
from modules.m2_risk_propagation.graph import RoadGraph, LocationNode, RoadEdge


# --- time_decay bucket boundaries ---

@pytest.mark.parametrize(
    "travel_time_min,expected_decay",
    [
        (1, 1.0),
        (3, 1.0),      # boundary: <=3
        (3.1, 0.8),
        (5, 0.8),      # boundary: <=5
        (5.1, 0.6),
        (8, 0.6),      # boundary: <=8
        (8.1, 0.4),
        (12, 0.4),     # boundary: <=12
        (12.1, 0.2),
        (30, 0.2),
    ],
)
def test_time_decay_buckets(travel_time_min, expected_decay):
    assert time_decay(travel_time_min) == expected_decay


# --- compute_pressure formula ---

def test_compute_pressure_matches_formula():
    upstream = LocationRiskInput(
        location_id="X", current_risk=84, predicted_risk_15m=89,
        confidence=0.91, traffic_pressure=0.86,
    )
    # travel_time=4 -> decay 0.8; connection_strength=0.75
    pressure = compute_pressure(upstream, connection_strength=0.75, travel_time_min=4)
    expected = 84 * 0.86 * 0.75 * 0.8
    assert pressure == pytest.approx(expected)


def test_compute_pressure_zero_when_current_risk_zero():
    upstream = LocationRiskInput(
        location_id="X", current_risk=0, predicted_risk_15m=10,
        confidence=0.9, traffic_pressure=0.5,
    )
    pressure = compute_pressure(upstream, connection_strength=0.5, travel_time_min=3)
    assert pressure == 0


# --- propagate() end-to-end on a minimal 2-node graph ---

def _two_node_graph(connection_strength=0.75, travel_time_min=4):
    graph = RoadGraph()
    graph.add_location(LocationNode("A", "A", 0.0, 0.0, police_units=1, required_units=1))
    graph.add_location(LocationNode("B", "B", 0.0, 0.0, police_units=0, required_units=1))
    graph.add_road(
        RoadEdge(source="A", target="B", connection_strength=connection_strength, travel_time_min=travel_time_min)
    )
    return graph


def test_propagate_increases_downstream_future_risk():
    graph = _two_node_graph()
    risk_inputs = {
        "A": LocationRiskInput("A", current_risk=84, predicted_risk_15m=89, confidence=0.9, traffic_pressure=0.86),
        "B": LocationRiskInput("B", current_risk=54, predicted_risk_15m=58, confidence=0.85, traffic_pressure=0.5),
    }
    results = propagate(graph, risk_inputs, alpha=0.3)

    assert results["B"].future_risk > results["B"].base_risk
    assert "A" in results["B"].propagation_sources
    # hand-computed: base(58) + 0.3 * (84*0.86*0.75*0.8) = 58 + 0.3*43.344 = 71.0032
    assert results["B"].future_risk == pytest.approx(71.0, abs=0.01)


def test_propagate_clamps_at_100():
    graph = _two_node_graph(connection_strength=1.0, travel_time_min=1)
    risk_inputs = {
        "A": LocationRiskInput("A", current_risk=100, predicted_risk_15m=100, confidence=0.99, traffic_pressure=1.0),
        "B": LocationRiskInput("B", current_risk=95, predicted_risk_15m=98, confidence=0.9, traffic_pressure=0.9),
    }
    results = propagate(graph, risk_inputs, alpha=5.0)  # deliberately extreme alpha
    assert results["B"].future_risk == 100


def test_propagate_skips_nodes_missing_m1_data():
    graph = _two_node_graph()
    risk_inputs = {
        "B": LocationRiskInput("B", current_risk=54, predicted_risk_15m=58, confidence=0.85, traffic_pressure=0.5),
    }
    results = propagate(graph, risk_inputs, alpha=0.3)
    assert "A" not in results
    assert results["B"].propagation_sources == []
    assert results["B"].future_risk == 58  # no upstream data -> no pressure added
