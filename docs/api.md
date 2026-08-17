# NAGPUR-R2 — API CONTRACT

## M1 → M2
`POST /api/risk/update`

```json
{
  "timestamp": "2026-08-15T18:15:00",
  "locations": [
    {
      "location_id": "WARDHA_ROAD",
      "current_risk": 84,
      "predicted_risk_15m": 89,
      "confidence": 0.91,
      "traffic_pressure": 0.86
    }
  ]
}
```

## M2 → frontend
`GET /api/risk/propagation`

Response contains:
- nodes
- edges
- risk_shadows
- propagation_paths

## M2 → M3
`GET /api/deployment/candidates`

```json
{
  "candidates": [
    {
      "location_id": "ZERO_MILE",
      "priority": 0.92,
      "future_risk": 78,
      "risk_shadow": true,
      "required_units": 1
    }
  ]
}
```

## Incident
`POST /api/incidents`

```json
{
  "location_id": "SITABULDI",
  "type": "ACCIDENT",
  "severity": "HIGH"
}
```

Flow:
incident → risk update → propagation → Risk Shadow update → re-optimization → recommendation.

## Override
`POST /api/deployment/override`

```json
{
  "recommendation_id": "REC-001",
  "action": "OVERRIDE",
  "reason": "GROUND_SITUATION_DIFFERS",
  "operator_note": "Manual control required"
}
```
