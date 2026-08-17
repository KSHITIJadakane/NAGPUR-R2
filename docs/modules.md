# NAGPUR-R2 — MODULE OWNERSHIP

## M1 — Risk Prediction
Input: traffic, historical risk, time, weather, events.
Output: current risk, 15-min risk, confidence, drivers.

## M2 — Risk Propagation + Risk Shadow
Owns:
- directed road graph
- edge attributes
- propagation calculation
- future propagated risk
- propagation path
- Risk Shadow
- M2 reasons

Input: M1 output + road graph + police coverage.
Output: future risk + propagation + Risk Shadow.

Success condition:
An upstream high-risk state increases downstream future risk, and an unmanned threshold-crossing location is flagged.

## M3 — Police Deployment
Owns officer state, travel time, constraints, CP-SAT optimization, redeployment.

## XAI
Owns explanations, recommendation evidence and audit trail.

## Frontend
Owns map, heatmap, forecast, Risk Shadow, officer markers, recommendations, override and what-if UI.

## Backend
Owns API orchestration and service boundaries.
