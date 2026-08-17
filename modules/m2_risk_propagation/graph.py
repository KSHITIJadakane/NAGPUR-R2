"""
M2 — Dynamic Road Graph

Wraps a networkx.DiGraph so the rest of M2 (propagation, risk_shadow) never
touches NetworkX directly. This keeps the graph backend swappable later
(e.g. PostGIS-backed graph) without changing propagation logic.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import networkx as nx

from . import config


@dataclass
class LocationNode:
    location_id: str
    name: str
    lat: float
    lng: float
    police_units: int
    required_units: int


@dataclass
class RoadEdge:
    source: str
    target: str
    connection_strength: float
    travel_time_min: float
    road_type: str = "unknown"


class RoadGraph:
    """Directed road graph for M2. Risk flows source -> target."""

    def __init__(self):
        self._g = nx.DiGraph()

    # --- Construction ---

    @classmethod
    def from_files(
        cls,
        locations_path: Optional[Path] = None,
        roads_path: Optional[Path] = None,
    ) -> "RoadGraph":
        locations_path = locations_path or config.LOCATIONS_FILE
        roads_path = roads_path or config.ROADS_FILE

        with open(locations_path, "r", encoding="utf-8") as f:
            locations_data = json.load(f)["locations"]

        with open(roads_path, "r", encoding="utf-8") as f:
            roads_data = json.load(f)["roads"]

        graph = cls()
        for loc in locations_data:
            graph.add_location(
                LocationNode(
                    location_id=loc["location_id"],
                    name=loc["name"],
                    lat=loc["lat"],
                    lng=loc["lng"],
                    police_units=loc["police_units"],
                    required_units=loc["required_units"],
                )
            )

        for road in roads_data:
            graph.add_road(
                RoadEdge(
                    source=road["source"],
                    target=road["target"],
                    connection_strength=road["connection_strength"],
                    travel_time_min=road["travel_time_min"],
                    road_type=road.get("road_type", "unknown"),
                )
            )

        return graph

    # --- Mutation ---

    def add_location(self, node: LocationNode) -> None:
        self._g.add_node(node.location_id, data=node)

    def add_road(self, edge: RoadEdge) -> None:
        if edge.source not in self._g or edge.target not in self._g:
            raise ValueError(
                f"Road {edge.source} -> {edge.target} references an unknown location. "
                "Add both locations before adding the road."
            )
        self._g.add_edge(edge.source, edge.target, data=edge)

    # --- Access ---

    def node(self, location_id: str) -> LocationNode:
        return self._g.nodes[location_id]["data"]

    def edge(self, source: str, target: str) -> RoadEdge:
        return self._g.edges[source, target]["data"]

    def nodes(self) -> list[str]:
        return list(self._g.nodes)

    def predecessors(self, location_id: str) -> list[str]:
        """Upstream locations whose traffic flows INTO location_id."""
        return list(self._g.predecessors(location_id))

    def successors(self, location_id: str) -> list[str]:
        """Downstream locations that location_id's traffic flows INTO."""
        return list(self._g.successors(location_id))

    def has_edge(self, source: str, target: str) -> bool:
        return self._g.has_edge(source, target)

    def shortest_path(self, source: str, target: str) -> Optional[list[str]]:
        """Used for propagation-path reporting to the frontend."""
        try:
            return nx.shortest_path(self._g, source, target)
        except nx.NetworkXNoPath:
            return None

    def to_edge_list(self) -> list[dict]:
        """Serializable edge list for the /api/risk/propagation response."""
        out = []
        for u, v, d in self._g.edges(data=True):
            edge: RoadEdge = d["data"]
            out.append(
                {
                    "source": edge.source,
                    "target": edge.target,
                    "connection_strength": edge.connection_strength,
                    "travel_time_min": edge.travel_time_min,
                    "road_type": edge.road_type,
                }
            )
        return out
