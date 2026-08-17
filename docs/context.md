# NAGPUR-R2 — CONTEXT

## Mission
NAGPUR-R2 is an AI decision-support system for Nagpur traffic police. It predicts where traffic risk will emerge next, explains why, and recommends how limited police resources should be positioned.

Core loop:
**Sense → Predict → Propagate → Explain → Allocate → Simulate → Redeploy**

## Problem B
AI-Based Traffic Risk Heatmap and Police Deployment Decision Support for Nagpur City.

The system is NOT primarily a traffic-signal controller.

## Core modules
- **M1:** Risk Prediction — current + 15-minute risk.
- **M2:** Risk Propagation + Risk Shadow — dynamic road graph, network pressure, future risk, unmanned emerging hotspots.
- **M3:** Police Deployment — constrained officer allocation and incident-triggered redeployment.
- **XAI:** Evidence → Reason → Action, plus audit/override logging.
- **Frontend:** command-room map, heatmap, forecast, Risk Shadow, deployment and simulation.

## M2 definition
Risk Shadow = a location where:
- current risk < 70,
- predicted/propagated risk >= 70,
- police coverage < required coverage.

M2 consumes M1 risk output and a directed road graph. It outputs future risk, propagation sources, propagation pressure, Risk Shadow status, and reasons.

## Primary prediction horizon
15 minutes.

## Prototype scope
This is a proof of concept, not a live Nagpur police deployment. Synthetic/open/simulated data is acceptable and must be labeled honestly.

Pilot graph can use a small Nagpur-inspired set such as:
Wardha Road, Zero Mile, Sitabuldi, Mahal, Laxmi Nagar, Manewada.

These names are prototype locations, not an authoritative GIS representation.

## Nagpur-specific context
Model contextual objects such as:
- festival/event crowding,
- waterlogging/flyover drainage,
- hawker congestion,
- pedestrian conflict,
- stray cattle,
- wrong-way movement,
- illegal parking,
- freight/truck spillover,
- diversions/road construction.

## Technical honesty
Use language such as:
“estimated risk propagation through connected road segments.”

Do NOT claim a predictive graph model proves causality.

## Infrastructure-blind behavior
If CCTV/data is unavailable, the system should degrade gracefully and lower confidence instead of pretending the data exists.

## Human-in-the-loop
AI recommends; police remain in command. Overrides record recommendation, operator action, reason, timestamp and outcome when available.

## What not to add
Avoid facial recognition, blockchain, metaverse, autonomous signals, unnecessary audio surveillance, or many unrelated AI models.
