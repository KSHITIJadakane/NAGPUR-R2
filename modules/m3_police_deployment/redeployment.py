from typing import List, Dict, Tuple
from .models import Candidate, UnitState, AllocationResult
from .optimizer import optimize_deployment

def calculate_redeployment(candidates: List[Candidate], units: List[UnitState]) -> Tuple[AllocationResult, Dict]:
    """
    Orchestrates the redeployment logic.
    Accepts current state and new candidates.
    Runs the optimizer and summarizes the changes.
    """
    
    # Call optimizer
    recommendation = optimize_deployment(candidates, units)
    
    # Identify redeployment changes
    remained_deployed = []
    newly_assigned = []
    need_to_move = []
    
    # Create mapping of current assignments based on UnitState
    current_assignments = {u.unit_id: u.assigned_location for u in units if u.status == "AVAILABLE"}
    
    for alloc in recommendation.allocations:
        current_loc = current_assignments.get(alloc.unit_id)
        if current_loc is None:
            # Was not assigned anywhere previously, or just standing by
            newly_assigned.append(alloc.unit_id)
        elif current_loc == alloc.assigned_to:
            remained_deployed.append(alloc.unit_id)
        else:
            need_to_move.append(alloc.unit_id)
            
    summary = {
        "remained_deployed": remained_deployed,
        "newly_assigned": newly_assigned,
        "need_to_move": need_to_move
    }
    
    return recommendation, summary
