"""
XAI API routes.

  GET /api/xai/explain/{location_id}   Explain a single node
  GET /api/xai/explain                  Explain all nodes (sorted by priority)
  GET /api/xai/audit                    Read persistent override audit log
"""

from fastapi import APIRouter, HTTPException

from backend.services import propagation_service
from backend.services.propagation_service import NoRiskDataError
from modules.xai import explanations as xai

router = APIRouter(prefix="/api/xai", tags=["XAI"])


@router.get("/explain")
def explain_all():
    """
    Generate XAI explanations for all nodes.
    Returns explanations sorted by priority (highest first).
    """
    try:
        graph_data = propagation_service.get_propagation_response()
    except NoRiskDataError as e:
        raise HTTPException(status_code=409, detail=str(e))

    nodes = graph_data.get("nodes", [])
    return {"explanations": xai.explain_all(nodes)}


@router.get("/explain/{location_id}")
def explain_node(location_id: str):
    """Generate an XAI explanation for a specific location."""
    try:
        graph_data = propagation_service.get_propagation_response()
    except NoRiskDataError as e:
        raise HTTPException(status_code=409, detail=str(e))

    nodes = graph_data.get("nodes", [])
    node = next((n for n in nodes if n.get("location_id") == location_id), None)

    if node is None:
        raise HTTPException(
            status_code=404,
            detail=f"Location '{location_id}' not found in current risk graph."
        )

    return xai.explain_node(node)


@router.get("/audit")
def get_audit_log(limit: int = 50):
    """
    Read the persistent override audit log.
    Returns the most recent `limit` entries (default 50).
    """
    from modules.xai import audit
    return {"log": audit.read_log(limit=limit), "limit": limit}
