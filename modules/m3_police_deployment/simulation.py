from typing import List, Dict
from .models import Candidate, UnitState, Allocation
from .data.synthetic_travel_times import TRAVEL_TIMES

def get_travel_time(origin: str, destination: str) -> int:
    if origin in TRAVEL_TIMES and destination in TRAVEL_TIMES[origin]:
        return TRAVEL_TIMES[origin][destination]
    return 0

def evaluate_scenario(candidates: List[Candidate], units: List[UnitState], allocations: List[Allocation] = None) -> Dict:
    """
    Evaluates a specific assignment scenario to provide metrics for the What-If simulation.
    If allocations is None, it simulates the "Do Nothing" scenario.
    """
    total_travel_time = 0
    total_uncovered_risk = 0
    
    assigned_counts = {c.location_id: 0 for c in candidates}
    
    if allocations:
        # AI Recommended Deployment
        for alloc in allocations:
            assigned_counts[alloc.assigned_to] = assigned_counts.get(alloc.assigned_to, 0) + 1
            unit = next((u for u in units if u.unit_id == alloc.unit_id), None)
            if unit:
                tt = get_travel_time(unit.current_location, alloc.assigned_to)
                total_travel_time += tt
    else:
        # Do Nothing scenario: calculate risk if units stay exactly where they are
        for u in units:
            if u.status == "AVAILABLE" and u.current_location in assigned_counts:
                assigned_counts[u.current_location] += 1
        total_travel_time = 0

    # Calculate uncovered risk
    # PROTOTYPE ASSUMPTION: Risk reduction is a simple deterministic subtraction of required units.
    uncovered_shadows = 0
    for c in candidates:
        assigned = assigned_counts.get(c.location_id, 0)
        uncovered = max(0, c.required_units - assigned)
        total_uncovered_risk += (uncovered * c.future_risk)
        if c.risk_shadow and uncovered > 0:
            uncovered_shadows += 1
        
    return {
        "scenario": "AI RECOMMENDED DEPLOYMENT" if allocations else "DO NOTHING",
        "total_travel_time": int(total_travel_time),
        "total_risk_exposure": float(total_uncovered_risk),
        "uncovered_shadows": uncovered_shadows
    }

def simulate_what_if(candidates: List[Candidate], units: List[UnitState], recommendation_allocations: List[Allocation]) -> Dict:
    # 1. Do Nothing baseline
    baseline_metrics = evaluate_scenario(candidates, units, allocations=None)
    
    # 2. Recommended metrics
    recommended_metrics = evaluate_scenario(candidates, units, allocations=recommendation_allocations)
    
    improvement = 0
    if baseline_metrics["total_risk_exposure"] > 0:
        improvement = ((baseline_metrics["total_risk_exposure"] - recommended_metrics["total_risk_exposure"]) / baseline_metrics["total_risk_exposure"]) * 100
        
    return {
        "baseline": baseline_metrics,
        "recommended": recommended_metrics,
        "improvement_pct": improvement
    }
