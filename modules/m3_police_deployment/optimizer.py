from ortools.sat.python import cp_model
from typing import List
import uuid

from .models import Candidate, UnitState, Allocation, AllocationResult
from .data.synthetic_travel_times import TRAVEL_TIMES

# Prototype Weights and Constraints
WEIGHT_RESPONSE_TIME = 1
WEIGHT_RISK_EXPOSURE = 5
WEIGHT_COVERAGE_LOSS = 3

MAX_RESPONSE_TIME_MINUTES = 15

def get_travel_time(origin: str, destination: str) -> int:
    if origin in TRAVEL_TIMES and destination in TRAVEL_TIMES[origin]:
        return TRAVEL_TIMES[origin][destination]
    return 999

def optimize_deployment(candidates: List[Candidate], units: List[UnitState]) -> AllocationResult:
    model = cp_model.CpModel()
    
    # Filter for only available units
    available_units = [u for u in units if u.status == "AVAILABLE"]
    
    # Precompute candidate map for coverage loss
    candidate_risk_map = {c.location_id: c.future_risk for c in candidates}
    
    # 1. Variables
    assign = {}
    for u in available_units:
        for c in candidates:
            assign[(u.unit_id, c.location_id)] = model.NewBoolVar(f'assign_{u.unit_id}_{c.location_id}')
            
    # 2. Constraints
    # Each unit can be assigned to at most 1 candidate
    for u in available_units:
        model.AddAtMostOne(assign[(u.unit_id, c.location_id)] for c in candidates)
        
    # Each candidate receives at most its required_units
    for c in candidates:
        model.Add(sum(assign[(u.unit_id, c.location_id)] for u in available_units) <= c.required_units)
        
    # Max response time constraint
    for u in available_units:
        for c in candidates:
            tt = get_travel_time(u.current_location, c.location_id)
            if tt > MAX_RESPONSE_TIME_MINUTES:
                # Cannot assign if ETA exceeds max allowed
                model.Add(assign[(u.unit_id, c.location_id)] == 0)

    # 3. Objectives
    # Calculate travel time
    travel_time_terms = []
    for u in available_units:
        for c in candidates:
            tt = get_travel_time(u.current_location, c.location_id)
            travel_time_terms.append(assign[(u.unit_id, c.location_id)] * tt)
            
    total_travel_time_var = model.NewIntVar(0, 10000, 'total_travel_time')
    model.Add(total_travel_time_var == sum(travel_time_terms))
    
    # Calculate uncovered risk
    uncovered_risk_terms = []
    for c in candidates:
        assigned_units_var = model.NewIntVar(0, c.required_units, f'assigned_{c.location_id}')
        model.Add(assigned_units_var == sum(assign[(u.unit_id, c.location_id)] for u in available_units))
        
        uncovered_units_var = model.NewIntVar(0, c.required_units, f'uncovered_{c.location_id}')
        model.Add(uncovered_units_var == c.required_units - assigned_units_var)
        
        risk_penalty = int(c.future_risk)
        uncovered_risk_terms.append(uncovered_units_var * risk_penalty)
        
    total_uncovered_risk_var = model.NewIntVar(0, 100000, 'total_uncovered_risk')
    model.Add(total_uncovered_risk_var == sum(uncovered_risk_terms))
    
    # Calculate coverage loss
    # If a unit is currently at a location that needs units (in candidates), 
    # but is assigned somewhere else, we incur a penalty of that location's risk.
    coverage_loss_terms = []
    for u in available_units:
        curr_loc = u.current_location
        if curr_loc in candidate_risk_map:
            # It's at a hotspot. Did it move?
            # It moved if it is assigned to any candidate c != curr_loc
            moved_vars = []
            for c in candidates:
                if c.location_id != curr_loc:
                    moved_vars.append(assign[(u.unit_id, c.location_id)])
            
            is_moved = model.NewBoolVar(f'is_moved_{u.unit_id}')
            # is_moved is 1 if it moved to any other candidate
            model.Add(sum(moved_vars) > 0).OnlyEnforceIf(is_moved)
            model.Add(sum(moved_vars) == 0).OnlyEnforceIf(is_moved.Not())
            
            coverage_loss_terms.append(is_moved * int(candidate_risk_map[curr_loc]))
            
    total_coverage_loss_var = model.NewIntVar(0, 100000, 'total_coverage_loss')
    if coverage_loss_terms:
        model.Add(total_coverage_loss_var == sum(coverage_loss_terms))
    else:
        model.Add(total_coverage_loss_var == 0)

    # Define objective
    model.Minimize(
        (total_travel_time_var * WEIGHT_RESPONSE_TIME) + 
        (total_uncovered_risk_var * WEIGHT_RISK_EXPOSURE) +
        (total_coverage_loss_var * WEIGHT_COVERAGE_LOSS)
    )
    
    # 4. Solve
    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    
    allocations = []
    total_tt = 0
    total_ur = 0
    total_cl = 0
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        total_tt = solver.Value(total_travel_time_var)
        total_ur = solver.Value(total_uncovered_risk_var)
        total_cl = solver.Value(total_coverage_loss_var)
        
        for u in available_units:
            for c in candidates:
                if solver.Value(assign[(u.unit_id, c.location_id)]) == 1:
                    tt = get_travel_time(u.current_location, c.location_id)
                    allocations.append(Allocation(
                        unit_id=u.unit_id,
                        assigned_to=c.location_id,
                        eta_minutes=tt,
                        reason=f"Assigned to mitigate risk of {c.future_risk}."
                    ))
                    
    return AllocationResult(
        recommendation_id=f"REC-{uuid.uuid4().hex[:6].upper()}",
        allocations=allocations,
        total_travel_time=total_tt,
        uncovered_risk=total_ur,
        coverage_loss=total_cl
    )
