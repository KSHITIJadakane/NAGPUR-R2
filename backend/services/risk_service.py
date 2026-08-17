"""
risk_service.py — Thin validation wrapper around the M1 → M2 input flow.

Responsibilities:
  - Validate and normalise incoming M1 payloads before handing them to
    propagation_service.
  - Log any payload anomalies (missing fields, out-of-range values).
  - Provide a seeding helper for simulation / demo scenarios.

Does NOT own propagation logic — that lives in propagation_service.py.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.models.schemas import RiskUpdateRequest
from backend.services import propagation_service

logger = logging.getLogger(__name__)


def process_m1_payload(payload: RiskUpdateRequest) -> dict[str, Any]:
    """
    Validate and forward a raw M1 risk payload to the propagation service.

    Applies lightweight sanity checks:
    - Clamps risk values to [0, 100]
    - Clamps confidence to [0.0, 1.0]
    - Logs any location with suspiciously high delta (> 40 points jump)

    Returns the propagation service response dict.
    """
    sanitised_locations = []
    for loc in payload.locations:
        d = loc.model_dump()

        # Clamp
        d["current_risk"] = max(0.0, min(100.0, d["current_risk"]))
        d["predicted_risk_15m"] = max(0.0, min(100.0, d["predicted_risk_15m"]))
        d["confidence"] = max(0.0, min(1.0, d.get("confidence", 1.0)))

        # Anomaly log
        delta = abs(d["predicted_risk_15m"] - d["current_risk"])
        if delta > 40:
            logger.warning(
                "Large risk delta at %s: current=%s predicted=%s delta=%.1f",
                d["location_id"], d["current_risk"], d["predicted_risk_15m"], delta,
            )

        sanitised_locations.append(d)

    logger.info(
        "M1 payload received: %d locations at %s",
        len(sanitised_locations),
        payload.timestamp,
    )

    # Re-assemble and forward
    clean_payload = RiskUpdateRequest(
        timestamp=payload.timestamp,
        locations=[type(loc)(**sanitised_locations[i]) for i, loc in enumerate(payload.locations)],
    )
    return propagation_service.update_risk(clean_payload.model_dump())


def seed_from_dict(data: dict[str, Any]) -> dict[str, Any]:
    """
    Seed the propagation service directly from a pre-built dict (e.g. a
    scenario file). Used by simulation_service.
    """
    payload = RiskUpdateRequest(**data)
    return process_m1_payload(payload)
