"""
M2 — Risk Shadow

Risk Shadow (DESIGN.md / CONTEXT.md):
    current_risk < 70
    AND future_risk >= 70
    AND police_units < required_units

A Risk Shadow is a location that looks fine right now but is about to
become dangerous AND is not covered — the whole point of M2's existence.
"""

from dataclasses import dataclass, field

from . import config
from .graph import RoadGraph
from .propagation import LocationRiskInput, PropagationResult


@dataclass
class RiskShadowResult:
    location_id: str
    current_risk: float
    future_risk: float
    police_units: int
    required_units: int
    risk_shadow: bool
    propagation_sources: list[str]
    propagation_pressure: float
    reason: list[str] = field(default_factory=list)


def _build_reasons(
    has_upstream_pressure: bool,
    crosses_threshold: bool,
    coverage_insufficient: bool,
) -> list[str]:
    reasons = []
    if has_upstream_pressure:
        reasons.append("Upstream risk pressure detected")
    if crosses_threshold:
        reasons.append("Future risk crosses threshold")
    if coverage_insufficient:
        reasons.append("Police coverage is insufficient")
    return reasons


def evaluate(
    graph: RoadGraph,
    risk_inputs: dict[str, LocationRiskInput],
    propagation_results: dict[str, PropagationResult],
) -> dict[str, RiskShadowResult]:
    """Apply the Risk Shadow rule to every propagated node."""
    results: dict[str, RiskShadowResult] = {}

    for location_id, prop in propagation_results.items():
        node = graph.node(location_id)
        risk_input = risk_inputs[location_id]

        current_risk = risk_input.current_risk
        future_risk = prop.future_risk
        units = node.police_units
        required = node.required_units

        below_current_threshold = current_risk < config.SHADOW_CURRENT_RISK_MAX
        crosses_threshold = future_risk >= config.SHADOW_FUTURE_RISK_MIN
        coverage_insufficient = units < required

        is_shadow = below_current_threshold and crosses_threshold and coverage_insufficient

        reasons = _build_reasons(
            has_upstream_pressure=bool(prop.propagation_sources),
            crosses_threshold=crosses_threshold,
            coverage_insufficient=coverage_insufficient,
        )

        results[location_id] = RiskShadowResult(
            location_id=location_id,
            current_risk=current_risk,
            future_risk=future_risk,
            police_units=units,
            required_units=required,
            risk_shadow=is_shadow,
            propagation_sources=prop.propagation_sources,
            propagation_pressure=prop.propagation_pressure,
            reason=reasons,
        )

    return results
