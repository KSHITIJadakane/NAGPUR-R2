# M2 — Risk Propagation + Risk Shadow

Owns: dynamic road graph, propagation math, future risk, Risk Shadow, reasons.
Does NOT own: M1's prediction, M3's optimizer, frontend rendering.

## Quick start

```bash
pip install networkx
python3 -m modules.m2_risk_propagation.main
```

Runs the bundled demo scenario (`simulations/m2_scenario_upstream_pressure.json`)
and prints the M2 output. Expected result: `ZERO_MILE` is flagged as a Risk
Shadow because of upstream pressure from `WARDHA_ROAD`.

## Integration point

Everything else in this module is an implementation detail. Import one function:

```python
from modules.m2_risk_propagation.main import run_m2, to_frontend_response, to_deployment_candidates

output = run_m2(m1_payload)                      # m1_payload = API_CONTRACT.md's M1->M2 shape
frontend_json = to_frontend_response(output, graph)   # GET /api/risk/propagation
m3_json = to_deployment_candidates(output)             # GET /api/deployment/candidates
```

`run_m2` loads the road graph from `data/locations.json` + `data/roads.json`
by default. Pass a pre-built `RoadGraph` if the backend wants to cache it
across requests instead of reloading from disk every call.

## Files

- `graph.py` — `RoadGraph` wraps a `networkx.DiGraph`. Nothing else in this
  module touches NetworkX directly.
- `propagation.py` — `P(i,j)` and `FutureRisk(j)` per `DESIGN.md`. Pure functions,
  no I/O.
- `risk_shadow.py` — applies the 3-condition Risk Shadow rule and builds reason strings.
- `config.py` — every tunable constant (alpha, time-decay buckets, thresholds).
  Tune here, not inside the logic files.
- `main.py` — orchestrator. `run_m2()` is the only function teammates should import.
- `data/locations.json`, `data/roads.json` — prototype pilot graph (6 Nagpur-inspired
  locations). Synthetic, not real GIS data.
- `tests/` — pytest suite covering time-decay boundaries, the propagation formula,
  each Risk Shadow condition individually, and a full end-to-end run against the
  demo scenario.

## Running tests

```bash
pip install pytest
python3 -m pytest modules/m2_risk_propagation/tests/ -v
```

## Known simplifications (documented per CONTEXT.md's honesty requirement)

- `connection_strength` and `travel_time_min` are hand-assigned prototype values,
  not measured traffic data.
- `alpha` (propagation weight) is a single tuned constant, not learned.
- The `priority` field in `/api/deployment/candidates` is a placeholder heuristic
  for M3 — M3 owns real prioritization and may ignore or override it.
- Road graph is a fixed 6-node prototype topology, not authoritative Nagpur GIS.
