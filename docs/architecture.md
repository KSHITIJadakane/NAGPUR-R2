# NAGPUR-R2 — ARCHITECTURE

## System architecture

```text
                 DATA / SIMULATION
                        |
       +----------------+----------------+
       |                |                |
    Traffic          Weather           Events
       |                |                |
       +----------------+----------------+
                        |
                        v
                M1 Risk Prediction
                        |
                        v
              M2 Dynamic Road Graph
                        |
                        v
               Risk Propagation
                        |
             +----------+----------+
             |                     |
             v                     v
        Future Risk           Risk Shadow
             |                     |
             +----------+----------+
                        |
                        v
                M3 Deployment
                  CP-SAT
                        |
             +----------+----------+
             |                     |
             v                     v
            XAI             What-if Simulator
             |                     |
             +----------+----------+
                        |
                        v
                Command Center
```

## Stack
Backend: Python, FastAPI, Pydantic
Data: JSON/CSV for MVP; PostgreSQL/PostGIS later
M1: pandas, scikit-learn, LightGBM/XGBoost if practical
M2: NetworkX, NumPy; later DCRNN/Graph WaveNet only with adequate data
M3: OR-Tools CP-SAT
Frontend: React, Tailwind, Leaflet/OpenStreetMap
Optional CV: OpenCV/YOLO

## Module boundaries
M1 owns prediction.
M2 owns graph, propagation, Risk Shadow.
M3 owns allocation/redeployment.
XAI owns explanations/audit.
Frontend owns visualization/interaction.
Backend owns API orchestration.

Modules communicate through explicit JSON/Pydantic contracts.
