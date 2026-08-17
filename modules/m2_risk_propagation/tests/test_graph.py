from modules.m2_risk_propagation.graph import RoadGraph, LocationNode, RoadEdge


def test_loads_all_pilot_locations():
    graph = RoadGraph.from_files()
    nodes = graph.nodes()
    assert len(nodes) == 6
    assert "WARDHA_ROAD" in nodes
    assert "ZERO_MILE" in nodes


def test_wardha_road_feeds_zero_mile():
    graph = RoadGraph.from_files()
    assert "WARDHA_ROAD" in graph.predecessors("ZERO_MILE")
    assert "ZERO_MILE" in graph.successors("WARDHA_ROAD")


def test_edge_attributes_load_correctly():
    graph = RoadGraph.from_files()
    edge = graph.edge("WARDHA_ROAD", "ZERO_MILE")
    assert edge.connection_strength == 0.75
    assert edge.travel_time_min == 4


def test_shortest_path_exists_for_connected_nodes():
    graph = RoadGraph.from_files()
    path = graph.shortest_path("WARDHA_ROAD", "MAHAL")
    assert path is not None
    assert path[0] == "WARDHA_ROAD"
    assert path[-1] == "MAHAL"


def test_add_road_rejects_unknown_location():
    graph = RoadGraph()
    graph.add_location(
        LocationNode("A", "A", 0.0, 0.0, police_units=0, required_units=1)
    )
    try:
        graph.add_road(RoadEdge(source="A", target="B", connection_strength=0.5, travel_time_min=5))
        assert False, "expected ValueError for unknown target location"
    except ValueError:
        pass
