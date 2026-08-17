"""
camera_routes.py — IP Camera Management API for NAGPUR-R2 Tactical Command.

Supports per-node IP camera assignment, live stream URL updates,
webcam activation, and AI-simulated CCTV configs.
"""

import datetime
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.models.schemas import CameraConfigSchema

router = APIRouter(prefix="/api/camera", tags=["IP Camera Feeds"])

# In-memory storage for node camera configurations
# Initialized with default CCTV configurations for Nagpur nodes
_NODE_CAMERAS: Dict[str, CameraConfigSchema] = {
    "WARDHA_ROAD": CameraConfigSchema(
        url="/videos/wardha_expressway.mp4",
        enabled=True,
        name="Wardha Expressway - PTZ 01",
        type="AI_PRESET",
        preset_id="wardha_expressway",
        fps=30,
        resolution="4K UltraHD",
        status="ONLINE",
        last_updated=datetime.datetime.now().strftime("%H:%M:%S"),
        videoStartOffset=3,
    ),
    # Zero Mile — uses manewada video at offset 75s (unique scene, confirmed working)
    "ZERO_MILE": CameraConfigSchema(
        url="/videos/manewada_ring_road.mp4",
        enabled=True,
        name="Zero Mile Junction - 360 PTZ",
        type="AI_PRESET",
        preset_id="zero_mile_junction",
        fps=25,
        resolution="4K UltraHD",
        status="ONLINE",
        last_updated=datetime.datetime.now().strftime("%H:%M:%S"),
        videoStartOffset=75,
    ),
    # Sitabuldi — uses laxmi_nagar video at offset 55s (unique scene, confirmed working)
    "SITABULDI": CameraConfigSchema(
        url="/videos/laxmi_nagar.mp4",
        enabled=True,
        name="Sitabuldi Market Corridor - CAM 03",
        type="AI_PRESET",
        preset_id="sitabuldi_market",
        fps=30,
        resolution="1080p FHD",
        status="ONLINE",
        last_updated=datetime.datetime.now().strftime("%H:%M:%S"),
        videoStartOffset=55,
    ),
    "MAHAL": CameraConfigSchema(
        url="/videos/mahal_sector.mp4",
        enabled=True,
        name="Mahal Heritage Sector - CAM 04",
        type="AI_PRESET",
        preset_id="mahal_sector",
        fps=24,
        resolution="720p HD",
        status="ONLINE",
        last_updated=datetime.datetime.now().strftime("%H:%M:%S"),
        videoStartOffset=22,
    ),
    "LAXMI_NAGAR": CameraConfigSchema(
        url="/videos/laxmi_nagar.mp4",
        enabled=True,
        name="Laxmi Nagar Square - CAM 05",
        type="AI_PRESET",
        preset_id="laxmi_nagar",
        fps=30,
        resolution="1080p FHD",
        status="ONLINE",
        last_updated=datetime.datetime.now().strftime("%H:%M:%S"),
        videoStartOffset=5,
    ),
    "MANEWADA": CameraConfigSchema(
        url="/videos/manewada_ring_road.mp4",
        enabled=True,
        name="Manewada Ring Rd - CAM 06",
        type="AI_PRESET",
        preset_id="manewada_ring_road",
        fps=30,
        resolution="1080p FHD",
        status="ONLINE",
        last_updated=datetime.datetime.now().strftime("%H:%M:%S"),
        videoStartOffset=30,
    ),
}



class CameraUpdateRequest(BaseModel):
    url: Optional[str] = None
    enabled: bool = True
    name: Optional[str] = None
    type: str = "IP_STREAM"
    preset_id: Optional[str] = None
    fps: Optional[int] = 30
    resolution: Optional[str] = "1080p FHD"
    status: Optional[str] = "ONLINE"


@router.get("/nodes", response_model=Dict[str, CameraConfigSchema])
def get_all_node_cameras():
    """Retrieve all assigned IP camera feeds per location_id."""
    return _NODE_CAMERAS


@router.get("/{location_id}", response_model=CameraConfigSchema)
def get_node_camera(location_id: str):
    """Retrieve IP camera configuration for a specific node."""
    if location_id not in _NODE_CAMERAS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No IP camera configured for node '{location_id}'.",
        )
    return _NODE_CAMERAS[location_id]


@router.post("/{location_id}", response_model=CameraConfigSchema)
def set_node_camera(location_id: str, payload: CameraUpdateRequest):
    """
    Attach, update, or reconfigure an IP camera feed for a node.
    Supports custom IP URLs (RTSP/HTTP/HTTPS/MJPEG/MP4), WebCam, or AI-Simulated feed.
    """
    config = CameraConfigSchema(
        url=payload.url,
        enabled=payload.enabled,
        name=payload.name or f"CCTV-{location_id}",
        type=payload.type,
        preset_id=payload.preset_id,
        fps=payload.fps or 30,
        resolution=payload.resolution or "1080p FHD",
        status=payload.status or "ONLINE",
        last_updated=datetime.datetime.now().strftime("%H:%M:%S"),
    )
    _NODE_CAMERAS[location_id] = config
    return config


@router.delete("/{location_id}")
def delete_node_camera(location_id: str):
    """Remove IP camera assignment from a node."""
    if location_id in _NODE_CAMERAS:
        del _NODE_CAMERAS[location_id]
        return {"status": "success", "message": f"Camera detached from node {location_id}"}
    return {"status": "success", "message": f"Node {location_id} already had no camera attached"}
