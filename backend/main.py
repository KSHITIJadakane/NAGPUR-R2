"""
NAGPUR-R2 — Unified FastAPI Backend
====================================
Modules:
  M1  Risk Prediction (external process → POST /api/risk/update)
  M2  Risk Propagation + Risk Shadow
  M3  Police Deployment Optimizer (CP-SAT)
  XAI Explainability + Audit Trail
"""

import sys
import os

# ── Python path: allow "from modules.xxx import ..." from project root ────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import CORS_ORIGINS
from backend.api import risk_routes, deployment_routes, incident_routes
from backend.api import simulation_routes, xai_routes, camera_routes
from backend.services import deployment_service, simulation_service

# ── Lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Seed police unit registry and default scenario on startup."""
    deployment_service.seed_default_units()
    # Seed default nominal baseline scenario to avoid 409 errors on fresh start
    try:
        simulation_service.run_scenario("baseline")
    except Exception as e:
        print(f"Warning: Failed to load default scenario: {e}")
    yield


# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NAGPUR-R2 Tactical Command API",
    description=(
        "Unified backend for M1 (risk prediction), M2 (risk propagation), "
        "M3 (police deployment optimizer), XAI, IP camera feeds, and simulation scenarios."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────
app.include_router(risk_routes.router)
app.include_router(deployment_routes.router)
app.include_router(incident_routes.router)
app.include_router(simulation_routes.router)
app.include_router(xai_routes.router)
app.include_router(camera_routes.router)


# ── Health / Root ──────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/", tags=["System"])
def root():
    return {
        "system": "NAGPUR-R2 Tactical Command",
        "version": "1.0.0",
        "modules": ["M1-risk-prediction", "M2-risk-propagation", "M3-police-deployment", "XAI"],
        "docs": "/docs",
        "health": "/health",
    }
