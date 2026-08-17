"""
M2 — Risk Propagation

Implements, unmodified, the formula specified in DESIGN.md:

    P(i,j) = Risk(i) x TrafficPressure(i) x ConnectionStrength(i,j) x TimeDecay(i,j)
    FutureRisk(j) = BaseRisk(j) + ALPHA x SUM(P(i,j))   [clamped 0-100]

"Risk(i)" uses upstream CURRENT risk (not future) — propagation models risk
already present in the network right now flowing downstream within the
15-minute horizon. Using each node's own predicted_risk_15m as BaseRisk(j)
avoids double-counting M1's own forecast for that location.
"""

from dataclasses import dataclass, field

from . import config
from .graph import RoadGraph


@dataclass
class LocationRiskInput:
    """One entry from the M1 -> M2 contract (DESIGN.md)."""
    location_id: str
    current_risk: float
    predicted_risk_15m: float
    confidence: float
    traffic_pressure: float


@dataclass
class PropagationResult:
    location_id: str
    base_risk: float
    future_risk: float
    propagation_pressure: float
    propagation_sources: list[str] = field(default_factory=list)


def time_decay(travel_time_min: float) -> float:
    """Prototype time-decay lookup from DESIGN.md."""
    for upper_bound, decay in config.TIME_DECAY_BUCKETS:
        if travel_time_min <= upper_bound:
            return decay
    return config.TIME_DECAY_DEFAULT


def _clamp(value: float, lo: float = config.RISK_MIN, hi: float = config.RISK_MAX) -> float:
    return max(lo, min(hi, value))


def compute_pressure(
    upstream: LocationRiskInput,
    connection_strength: float,
    travel_time_min: float,
) -> float:
    """P(i,j) for a single upstream source i feeding into target j."""
    decay = time_decay(travel_time_min)
    return upstream.current_risk * upstream.traffic_pressure * connection_strength * decay


def propagate(
    graph: RoadGraph,
    risk_inputs: dict[str, LocationRiskInput],
    alpha: float = config.ALPHA,
) -> dict[str, PropagationResult]:
    """
    Compute FutureRisk(j) for every node in the graph.

    Nodes with no M1 data are skipped (graceful degradation per CONTEXT.md's
    "infrastructure-blind behavior" — missing data does not crash the pipeline).
    """
    results: dict[str, PropagationResult] = {}

    for target_id in graph.nodes():
        target_input = risk_inputs.get(target_id)
        if target_input is None:
            continue

        base_risk = target_input.predicted_risk_15m
        pressure_sum = 0.0
        sources: list[str] = []

        for source_id in graph.predecessors(target_id):
            source_input = risk_inputs.get(source_id)
            if source_input is None:
                continue

            edge = graph.edge(source_id, target_id)
            p_ij = compute_pressure(
                source_input, edge.connection_strength, edge.travel_time_min
            )

            if p_ij > 0:
                pressure_sum += p_ij
                sources.append(source_id)

        future_risk = _clamp(base_risk + alpha * pressure_sum)

        results[target_id] = PropagationResult(
            location_id=target_id,
            base_risk=base_risk,
            future_risk=future_risk,
            propagation_pressure=round(pressure_sum, 2),
            propagation_sources=sources,
        )

    return results
