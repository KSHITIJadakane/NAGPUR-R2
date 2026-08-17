/**
 * api.ts — Typed fetch wrappers for the NAGPUR-R2 backend.
 *
 * All functions return typed data or throw on non-2xx responses.
 * Falls back gracefully: callers should catch errors and use mock data
 * in offline / demo mode.
 */

const BASE_URL = ((import.meta as any).env?.VITE_API_URL as string) || 'http://localhost:8000';

// ── Generic helper ────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types mirroring backend schemas ──────────────────────────────────────

import { CameraConfig } from '../types';

export interface ApiNode {
  location_id: string;
  name?: string;
  lat: number;
  lng: number;
  current_risk: number;
  future_risk: number;
  risk_shadow: boolean;
  police_units: number;
  required_units: number;
  propagation_sources: string[];
  propagation_pressure: number;
  reason: string[];
  trend?: 'UP' | 'DOWN' | 'STABLE';
  camera?: CameraConfig;
}

export interface ApiEdge {
  source: string;
  target: string;
  connection_strength: number;
  travel_time_min: number;
}

export interface PropagationResponse {
  nodes: ApiNode[];
  edges: ApiEdge[];
  risk_shadows: string[];
  propagation_paths: Record<string, string[]>;
  timestamp: string;
}

export interface DeploymentCandidate {
  location_id: string;
  priority: number;
  future_risk: number;
  risk_shadow: boolean;
  required_units: number;
  eta_minutes: number;
}

export interface CandidatesResponse {
  candidates: DeploymentCandidate[];
}

export interface ApiUnit {
  unit_id: string;
  current_location: string;
  status: 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE';
  assigned_location: string | null;
}

export interface UnitsResponse {
  units: ApiUnit[];
}

export interface Allocation {
  unit_id: string;
  from_location: string;
  to_location: string;
  travel_time_min: number;
}

export interface OptimizationResponse {
  recommendation_id: string;
  allocations: Allocation[];
  what_if: {
    baseline: { total_risk_exposure: number; uncovered_shadows: number };
    recommended: { total_risk_exposure: number; uncovered_shadows: number };
    improvement_pct: number;
  };
  solver_status: string;
  timestamp: string;
}

export interface XaiExplanation {
  location_id: string;
  evidence: string[];
  reason: string[];
  action: string;
  urgency: string;
  priority: number;
  summary: string;
}

// ── M2 Risk ───────────────────────────────────────────────────────────────

export const fetchPropagation = (): Promise<PropagationResponse> =>
  apiFetch<PropagationResponse>('/api/risk/propagation');

export const fetchCandidates = (): Promise<CandidatesResponse> =>
  apiFetch<CandidatesResponse>('/api/deployment/candidates');

// ── M3 Deployment ─────────────────────────────────────────────────────────

export const fetchUnits = (): Promise<UnitsResponse> =>
  apiFetch<UnitsResponse>('/api/units');

export const fetchRecommendation = (): Promise<OptimizationResponse> =>
  apiFetch<OptimizationResponse>('/api/deployment/recommendation');

export const postOptimize = (): Promise<OptimizationResponse> =>
  apiFetch<OptimizationResponse>('/api/deployment/optimize', { method: 'POST' });

export const postOverride = (payload: {
  recommendation_id: string;
  action: string;
  reason: string;
  operator_note?: string;
}) => apiFetch('/api/deployment/override', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const resetDeployment = (): Promise<{ status: string; message: string }> =>
  apiFetch('/api/deployment/reset', { method: 'POST' });

// ── Incidents ─────────────────────────────────────────────────────────────

export const postIncident = (payload: {
  location_id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}) => apiFetch('/api/incidents', {
  method: 'POST',
  body: JSON.stringify(payload),
});

// ── Simulations & Risk Updates ───────────────────────────────────────────

export const BASELINE_LOCATIONS = [
  { location_id: "WARDHA_ROAD", current_risk: 34, predicted_risk_15m: 38, confidence: 0.92, traffic_pressure: 0.45 },
  { location_id: "ZERO_MILE", current_risk: 38, predicted_risk_15m: 42, confidence: 0.88, traffic_pressure: 0.50 },
  { location_id: "SITABULDI", current_risk: 36, predicted_risk_15m: 40, confidence: 0.90, traffic_pressure: 0.48 },
  { location_id: "MAHAL", current_risk: 32, predicted_risk_15m: 35, confidence: 0.85, traffic_pressure: 0.42 },
  { location_id: "LAXMI_NAGAR", current_risk: 28, predicted_risk_15m: 32, confidence: 0.80, traffic_pressure: 0.38 },
  { location_id: "MANEWADA", current_risk: 20, predicted_risk_15m: 24, confidence: 0.78, traffic_pressure: 0.25 },
];

export const postRiskUpdate = (locations = BASELINE_LOCATIONS) =>
  apiFetch('/api/risk/update', {
    method: 'POST',
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      locations,
    }),
  });

export const fetchScenarios = (): Promise<{ scenarios: string[] }> =>
  apiFetch('/api/simulations');

export const runScenario = (scenario: string) =>
  apiFetch('/api/simulations/run', {
    method: 'POST',
    body: JSON.stringify({ scenario }),
  });

export const resetToBaseline = async () => {
  try {
    return await runScenario('baseline');
  } catch {
    // If backend doesn't have the new 'baseline' scenario alias yet, directly push baseline payload
    return await postRiskUpdate(BASELINE_LOCATIONS);
  }
};

// ── XAI ──────────────────────────────────────────────────────────────────

export const fetchExplanations = (): Promise<{ explanations: XaiExplanation[] }> =>
  apiFetch('/api/xai/explain');

export const fetchNodeExplanation = (location_id: string): Promise<XaiExplanation> =>
  apiFetch(`/api/xai/explain/${location_id}`);

// ── IP Cameras ────────────────────────────────────────────────────────────

export const fetchCameraConfigs = (): Promise<Record<string, CameraConfig>> =>
  apiFetch<Record<string, CameraConfig>>('/api/camera/nodes');

export const saveNodeCamera = (
  location_id: string,
  payload: Partial<CameraConfig>
): Promise<CameraConfig> =>
  apiFetch<CameraConfig>(`/api/camera/${location_id}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteNodeCamera = (location_id: string) =>
  apiFetch(`/api/camera/${location_id}`, { method: 'DELETE' });

// ── Health check ──────────────────────────────────────────────────────────

export const checkHealth = (): Promise<{ status: string }> =>
  apiFetch('/health');
