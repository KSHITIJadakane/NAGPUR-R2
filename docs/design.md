# NAGPUR-R2 — DESIGN

## Goal
Build one coherent risk-to-response system rather than a collection of disconnected AI features.

## Architecture

```text
Traffic / Weather / Events / Incidents
                 |
                 v
        +------------------+
        | M1 Risk Engine   |
        | Current + 15 min |
        +--------+---------+
                 |
                 v
        +----------------------+
        | M2 Dynamic Road Graph|
        +----------+-----------+
                   |
                   v
        +----------------------+
        | Risk Propagation     |
        +----------+-----------+
                   |
            +------+------+
            |             |
            v             v
       Future Risk    Propagation Path
            |
            v
       Risk Shadow
            |
            v
   +-----------------------+
   | M3 Police Optimizer   |
   | OR-Tools CP-SAT       |
   +-----------+-----------+
               |
        +------+------+
        |             |
        v             v
       XAI       What-if Simulator
        |             |
        +------+------+
               v
        Command Center UI
```

## M1 → M2 contract

```json
{
  "location_id": "ZERO_MILE",
  "current_risk": 54,
  "predicted_risk_15m": 73,
  "confidence": 0.89,
  "traffic_pressure": 0.81
}
```

## M2 propagation

For source i → target j:

`P(i,j) = Risk(i) × TrafficPressure(i) × ConnectionStrength(i,j) × TimeDecay(i,j)`

Then:

`FutureRisk(j) = BaseRisk(j) + alpha × SUM(P(i,j))`

Clamp to 0–100.

Prototype time decay:
- <=3 min: 1.0
- 3–5: 0.8
- 5–8: 0.6
- 8–12: 0.4
- >12: 0.2

These are configurable prototype assumptions.

## Risk Shadow

```text
current_risk < 70
AND future_risk >= 70
AND police_units < required_units
```

## M2 output

```json
{
  "location_id": "ZERO_MILE",
  "current_risk": 54,
  "future_risk": 78,
  "risk_shadow": true,
  "police_units": 0,
  "required_units": 1,
  "propagation_sources": ["WARDHA_ROAD"],
  "propagation_pressure": 24.3,
  "reason": [
    "Upstream risk pressure detected",
    "Future risk crosses threshold",
    "Police coverage is insufficient"
  ]
}
```

## M3 objective
Minimize a weighted combination of:
- response time,
- total risk exposure,
- coverage loss.

Subject to:
- limited officers,
- no duplicate officer assignment,
- minimum coverage,
- response constraints.

## XAI
Display:
**Evidence → Reason → Action**

Example:
“Deploy Unit 04 to Zero Mile because forecast risk is 78, coverage is 0, and upstream pressure from Wardha Road is increasing.”

## Override
UI:
`ACCEPT` / `OVERRIDE`

Override reason examples:
- Ground situation differs
- Officer unavailable
- VIP/event movement
- Other

Log every decision.
