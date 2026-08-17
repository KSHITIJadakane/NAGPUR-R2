export type CameraType = 'AI_PRESET' | 'IP_STREAM' | 'WEBCAM' | 'SIMULATED_AI' | 'PRESET';
export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING';

export interface CameraConfig {
  url?: string;
  enabled: boolean;
  name?: string;
  type: CameraType;
  preset_id?: string;
  fps?: number;
  resolution?: string;
  status: CameraStatus;
  last_updated?: string;
  videoStartOffset?: number; // seconds - start the looped video at this offset
}

export interface RiskNode {
  location_id: string;
  name: string;
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
  trend: 'UP' | 'DOWN' | 'STABLE';
  history: number[];
  camera?: CameraConfig;
}

export interface Unit {
  id: string;
  lat: number;
  lng: number;
  target_id: string | null;
  status: 'IDLE' | 'EN_ROUTE' | 'ON_SCENE';
}

export interface Edge {
  source: string;
  target: string;
  connection_strength: number;
  travel_time_min: number;
}

export interface DeploymentCandidate {
  location_id: string;
  priority: number;
  future_risk: number;
  risk_shadow: boolean;
  required_units: number;
  eta_minutes: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'Deploy' | 'Override' | 'Reject';
  location: string;
  reason: string;
}

// ── XAI ──────────────────────────────────────────────────────────────────

export interface XaiExplanation {
  location_id: string;
  evidence: string[];
  reason: string[];
  action: string;
  urgency: string;
  priority: number;
  summary: string;
}

// ── Optimization result ───────────────────────────────────────────────────

export interface Allocation {
  unit_id: string;
  from_location: string;
  to_location: string;
  travel_time_min: number;
}

export interface WhatIf {
  baseline: { total_risk_exposure: number; uncovered_shadows: number };
  recommended: { total_risk_exposure: number; uncovered_shadows: number };
  improvement_pct: number;
}

export interface OptimizationResult {
  recommendation_id: string;
  allocations: Allocation[];
  what_if: WhatIf;
  solver_status: string;
  timestamp: string;
}

// ── Connection state ──────────────────────────────────────────────────────

export type ConnectionStatus = 'connected' | 'offline' | 'connecting';
