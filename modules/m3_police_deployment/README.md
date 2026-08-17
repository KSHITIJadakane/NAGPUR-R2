# M3 Police Deployment

This module implements the police deployment optimization and redeployment logic for the NAGPUR-R2 project using OR-Tools CP-SAT.

## Responsibilities
- `optimizer.py`: Handles CP-SAT allocation balancing response time, risk exposure, and coverage loss.
- `redeployment.py`: Identifies unit movement state when emergency candidates arise.
- `simulation.py`: Provides the What-If comparative analysis between "Do Nothing" and "AI Recommended Deployment".

## Prototype Assumptions
- **Data**: All location names and travel times in `data/` are synthetic prototype data, not real Nagpur Police or GPS data.
- **Response Time**: `MAX_RESPONSE_TIME_MINUTES = 15`. This is a configurable prototype constraint and not a real police SLA.
- **Weights**: The objective weights (Response Time=1, Risk Exposure=5, Coverage Loss=3) are illustrative and not learned from live traffic data.
- **Risk Reduction**: The `simulation.py` model uses a deterministic subtraction for risk mitigation, which is a simplified prototype assumption.

## M3 Integration Contract

> [!WARNING]
> This M3 output contract is a prototype integration contract pending team/backend approval.

### M2 → M3 Input Fields
M3 expects a list of candidates from M2 containing the following fields:
- `location_id` (string)
- `priority` (float)
- `future_risk` (float)
- `risk_shadow` (boolean)
- `required_units` (integer)

**Example JSON Request:**
```json
{
  "candidates": [
    {
      "location_id": "ZERO_MILE",
      "priority": 0.92,
      "future_risk": 78.0,
      "risk_shadow": true,
      "required_units": 1
    }
  ]
}
```

### M3 → Backend Output Fields
M3 outputs an `AllocationResult` with the following structure:
- `recommendation_id` (string)
- `allocations` (array of objects):
  - `unit_id` (string)
  - `assigned_to` (string)
  - `eta_minutes` (integer)
  - `reason` (string)
- `total_travel_time` (integer)
- `uncovered_risk` (float)
- `coverage_loss` (float)

**Example JSON Response:**
```json
{
  "recommendation_id": "REC-9564AC",
  "allocations": [
    {
      "unit_id": "UNIT-01",
      "assigned_to": "ZERO_MILE",
      "eta_minutes": 5,
      "reason": "Assigned to mitigate risk of 78.0."
    }
  ],
  "total_travel_time": 5,
  "uncovered_risk": 0.0,
  "coverage_loss": 0.0
}
```
