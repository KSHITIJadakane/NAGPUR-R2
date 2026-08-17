"""
XAI explanations — Evidence → Reason → Action natural language generation.

Takes a processed M2 node and generates a human-readable explanation
following the NAGPUR-R2 design principle:

  "Evidence → Reason → Action"

Example output:
  "Deploy a unit to Zero Mile. Forecast risk will reach 78 in 15 minutes.
   Upstream pressure from Wardha Road is 24.3. The location is currently
   unmanned (0 of 1 required units). Risk Shadow threshold crossed."
"""

from __future__ import annotations

from typing import Any


# ── Severity helpers ──────────────────────────────────────────────────────

def _risk_label(risk: float) -> str:
    if risk >= 81: return "critical"
    if risk >= 61: return "high"
    if risk >= 31: return "moderate"
    return "low"


def _urgency(priority: float) -> str:
    if priority >= 85: return "Immediate action required"
    if priority >= 65: return "Action recommended"
    return "Monitor closely"


# ── Core explainer ────────────────────────────────────────────────────────

def explain_node(node: dict[str, Any]) -> dict[str, Any]:
    """
    Generate a structured XAI explanation for a single M2 node.

    Args:
        node: A dict matching the M2 node output schema:
              location_id, current_risk, future_risk, risk_shadow,
              police_units, required_units, propagation_sources,
              propagation_pressure, reason (list[str])

    Returns:
        {
          "location_id": str,
          "evidence": list[str],   # raw data bullets
          "reason": list[str],     # M2 reasons
          "action": str,           # recommended action sentence
          "urgency": str,
          "summary": str,          # one-line human-readable
        }
    """
    loc     = node.get("location_id", "Unknown")
    cur     = node.get("current_risk", 0)
    fut     = node.get("future_risk", cur)
    shadow  = node.get("risk_shadow", False)
    units   = node.get("police_units", 0)
    req     = node.get("required_units", 1)
    sources = node.get("propagation_sources", [])
    pressure = node.get("propagation_pressure", 0.0)
    reasons  = node.get("reason", [])

    # ── Evidence bullets ─────────────────────────────────────────────────
    evidence: list[str] = [
        f"Current risk: {cur:.0f}/100 ({_risk_label(cur)})",
        f"Forecast risk (15 min): {fut:.0f}/100 ({_risk_label(fut)})",
    ]

    if sources:
        src_str = ", ".join(s.replace("_", " ") for s in sources)
        evidence.append(
            f"Upstream pressure from {src_str}: {pressure:.1f} units"
        )

    coverage_pct = int((units / req) * 100) if req else 100
    evidence.append(
        f"Police coverage: {units}/{req} required units ({coverage_pct}%)"
    )

    if shadow:
        evidence.append("⚠ Risk Shadow: location is currently unmanned and forecast to cross threshold")

    # ── Action sentence ──────────────────────────────────────────────────
    loc_display = loc.replace("_", " ").title()

    if shadow and units < req:
        needed = req - units
        action = (
            f"Deploy {needed} unit{'s' if needed > 1 else ''} to {loc_display}. "
            f"Forecast risk will reach {fut:.0f} — coverage gap must be closed before threshold crossing."
        )
    elif fut >= 70 and units < req:
        action = (
            f"Reinforce {loc_display} with {req - units} additional unit(s). "
            f"High forecast risk of {fut:.0f} with insufficient coverage."
        )
    elif cur >= 80:
        action = (
            f"Maintain or increase presence at {loc_display}. "
            f"Current risk is already critical at {cur:.0f}."
        )
    else:
        action = f"Continue monitoring {loc_display}. Current risk level is {_risk_label(cur)}."

    # ── Priority score ───────────────────────────────────────────────────
    priority = min(100, fut * 0.6 + pressure * 0.4 + (30 if shadow else 0))

    # ── One-line summary ─────────────────────────────────────────────────
    if shadow:
        summary = (
            f"{loc_display} is a Risk Shadow — forecast risk {fut:.0f}, "
            f"unmanned ({units}/{req} units), upstream pressure {pressure:.1f}."
        )
    elif fut >= 70:
        summary = (
            f"{loc_display}: forecast risk {fut:.0f} in 15 min "
            f"({'from ' + ', '.join(s.replace('_', ' ') for s in sources) if sources else 'organic'})."
        )
    else:
        summary = f"{loc_display}: risk {cur:.0f} (current), {fut:.0f} (forecast). Stable."

    return {
        "location_id": loc,
        "evidence": evidence,
        "reason": reasons,
        "action": action,
        "urgency": _urgency(priority),
        "priority": round(priority, 1),
        "summary": summary,
    }


def explain_all(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Generate XAI explanations for all nodes, sorted by priority (desc)."""
    explanations = [explain_node(n) for n in nodes]
    return sorted(explanations, key=lambda x: x["priority"], reverse=True)
