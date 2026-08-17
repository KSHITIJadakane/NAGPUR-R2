"""
simulation_service.py — Load and run named scenarios.

Scenarios are JSON files in the simulations/ directory.
Each scenario is a valid M1 risk payload that can be seeded into the backend.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from backend.services.risk_service import seed_from_dict
from backend.services import propagation_service, deployment_service
from backend.services.propagation_service import NoRiskDataError
from backend.config import SIMULATIONS_DIR

_SCENARIO_ALIASES = {
    "baseline": "baseline_scenario.json",
    "nominal":  "baseline_scenario.json",
    "festival": "festival_scenario.json",
    "accident": "accident_scenario.json",
    "rain":     "rain_scenario.json",
}


def list_scenarios() -> list[str]:
    """Return names of all available scenarios."""
    return list(_SCENARIO_ALIASES.keys())


def run_scenario(name: str) -> dict[str, Any]:
    """
    Load a named scenario and seed the backend.

    Steps:
      1. Load JSON from simulations/<name>_scenario.json
      2. Seed M2 propagation via risk_service
      3. Auto-run M3 optimizer
      4. Return combined result

    Raises FileNotFoundError if the scenario doesn't exist.
    """
    filename = _SCENARIO_ALIASES.get(name.lower())
    if filename is None:
        available = list(_SCENARIO_ALIASES.keys())
        raise ValueError(f"Unknown scenario '{name}'. Available: {available}")

    # Resolve path relative to project root
    base = Path(__file__).resolve().parents[2]  # NAGPUR-R2/
    scenario_path = base / SIMULATIONS_DIR / filename

    if not scenario_path.exists():
        raise FileNotFoundError(f"Scenario file not found: {scenario_path}")

    with open(scenario_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Remove the _description key before seeding (not a schema field)
    data.pop("_description", None)

    # Seed M2
    propagation_result = seed_from_dict(data)

    # Auto-run M3 optimizer
    try:
        candidates_response = propagation_service.get_deployment_candidates()
        candidates = candidates_response.get("candidates", [])
        optimization_result = deployment_service.optimize(candidates) if candidates else None
    except NoRiskDataError:
        optimization_result = None

    return {
        "scenario": name,
        "propagation": propagation_result,
        "optimization": optimization_result,
    }
