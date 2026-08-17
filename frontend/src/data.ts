import { RiskNode, Edge, DeploymentCandidate, AuditLogEntry } from './types';

export interface CameraPreset {
  id: string;
  name: string;
  url: string;
  fallbackUrl?: string;
  resolution: string;
  fps: number;
  desc: string;
  videoStartOffset?: number; // seconds into the video to start looping from
}

export const PRESET_CAMERAS: CameraPreset[] = [
  {
    id: 'wardha_expressway',
    name: 'Wardha Rd Expressway Flyover',
    url: '/videos/wardha_expressway.mp4',
    fallbackUrl: 'https://assets.mixkit.co/videos/preview/mixkit-highway-traffic-in-the-evening-42848-large.mp4',
    resolution: '1080p FHD',
    fps: 30,
    desc: 'High-speed 4-lane corridor with real-time AI object tracking'
  },
  {
    id: 'zero_mile_junction',
    name: 'Zero Mile Heritage Interchange',
    url: '/videos/zero_mile_junction.mp4',
    fallbackUrl: 'https://assets.mixkit.co/videos/preview/mixkit-traffic-at-a-busy-intersection-43093-large.mp4',
    resolution: '4K UltraHD',
    fps: 25,
    desc: 'Central junction metro transit line with optical flow'
  },
  {
    id: 'sitabuldi_market',
    name: 'Sitabuldi Commercial Corridor',
    url: '/videos/sitabuldi_market.mp4',
    fallbackUrl: 'https://assets.mixkit.co/videos/preview/mixkit-cars-moving-in-a-busy-city-avenue-42866-large.mp4',
    resolution: '1080p FHD',
    fps: 30,
    desc: 'High pedestrian density and vehicle retail corridor'
  },
  {
    id: 'mahal_sector',
    name: 'Mahal Heritage Sector',
    url: '/videos/mahal_sector.mp4',
    fallbackUrl: 'https://assets.mixkit.co/videos/preview/mixkit-traffic-in-a-street-in-an-aerial-view-42843-large.mp4',
    resolution: '720p HD',
    fps: 24,
    desc: 'Heritage cultural market arterial transit flow'
  },
  {
    id: 'laxmi_nagar',
    name: 'Laxmi Nagar Square',
    url: '/videos/laxmi_nagar.mp4',
    fallbackUrl: 'https://assets.mixkit.co/videos/preview/mixkit-cars-on-a-highway-at-night-43003-large.mp4',
    resolution: '1080p FHD',
    fps: 30,
    desc: 'Residential-commercial arterial vehicle flow'
  },
  {
    id: 'manewada_ring_road',
    name: 'Manewada Ring Road Axis',
    url: '/videos/manewada_ring_road.mp4',
    fallbackUrl: 'https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-city-traffic-at-night-42861-large.mp4',
    resolution: '1080p FHD',
    fps: 30,
    desc: 'Outer ring multi-lane logistics & freight transit'
  }
];

export const MOCK_NODES: RiskNode[] = [
  {
    location_id: 'WARDHA_ROAD',
    name: 'Wardha Road',
    lat: 21.1189,
    lng: 79.0664,
    current_risk: 34,
    future_risk: 38,
    risk_shadow: false,
    police_units: 0,
    required_units: 1,
    propagation_sources: [],
    propagation_pressure: 0,
    reason: ['Moderate corridor traffic', 'Nominal flow rate'],
    trend: 'STABLE', history: Array.from({length: 12}, () => Math.floor(Math.random() * 10) + 30),
    camera: {
      enabled: true,
      name: 'Wardha Expressway - PTZ 01',
      type: 'AI_PRESET',
      url: '/videos/wardha_expressway.mp4',
      preset_id: 'wardha_expressway',
      fps: 30,
      resolution: '4K UltraHD',
      status: 'ONLINE',
      last_updated: '18:24:00',
      videoStartOffset: 3   // skip first 3s, jump to flowing traffic
    }
  },
  {
    location_id: 'ZERO_MILE',
    name: 'Zero Mile',
    lat: 21.1488,
    lng: 79.0882,
    current_risk: 54,
    future_risk: 78,
    risk_shadow: true,
    police_units: 0,
    required_units: 1,
    propagation_sources: ['WARDHA_ROAD'],
    propagation_pressure: 24.3,
    reason: [
      'Upstream risk pressure detected from Wardha Road',
      'Future risk crosses critical threshold',
      'Police coverage is insufficient'
    ],
    trend: 'UP', history: Array.from({length: 12}, () => Math.floor(Math.random() * 40) + 40),
    camera: {
      enabled: true,
      name: 'Zero Mile Junction - 360 PTZ',
      type: 'AI_PRESET',
      url: '/videos/manewada_ring_road.mp4',
      preset_id: 'zero_mile_junction',
      fps: 25,
      resolution: '4K UltraHD',
      status: 'ONLINE',
      last_updated: '18:24:00',
      videoStartOffset: 75  // unique scene from manewada video
    }
  },
  {
    location_id: 'SITABULDI',
    name: 'Sitabuldi',
    lat: 21.1465,
    lng: 79.0825,
    current_risk: 36,
    future_risk: 40,
    risk_shadow: false,
    police_units: 0,
    required_units: 1,
    propagation_sources: [],
    propagation_pressure: 0,
    reason: ['Commercial area traffic nominal', 'Normal pedestrian activity'],
    trend: 'STABLE', history: Array.from({length: 12}, () => Math.floor(Math.random() * 10) + 30),
    camera: {
      enabled: true,
      name: 'Sitabuldi Market Corridor - CAM 03',
      type: 'AI_PRESET',
      url: '/videos/laxmi_nagar.mp4',
      preset_id: 'sitabuldi_market',
      fps: 30,
      resolution: '1080p FHD',
      status: 'ONLINE',
      last_updated: '18:24:00',
      videoStartOffset: 55  // unique scene from laxmi_nagar video
    }
  },
  {
    location_id: 'MAHAL',
    name: 'Mahal',
    lat: 21.1442,
    lng: 79.1098,
    current_risk: 30,
    future_risk: 73,
    risk_shadow: true,
    police_units: 0,
    required_units: 1,
    propagation_sources: ['SITABULDI'],
    propagation_pressure: 15.2,
    reason: ['Festival crowding building up', 'No active units in sector'],
    trend: 'UP', history: Array.from({length: 12}, () => Math.floor(Math.random() * 40) + 40),
    camera: {
      enabled: true,
      name: 'Mahal Heritage Sector - CAM 04',
      type: 'AI_PRESET',
      url: '/videos/mahal_sector.mp4',
      preset_id: 'mahal_sector',
      fps: 24,
      resolution: '720p HD',
      status: 'ONLINE',
      last_updated: '18:00:00',
      videoStartOffset: 22
    }
  },
  {
    location_id: 'LAXMI_NAGAR',
    name: 'Laxmi Nagar',
    lat: 21.1235,
    lng: 79.0663,
    current_risk: 35,
    future_risk: 38,
    risk_shadow: false,
    police_units: 0,
    required_units: 1,
    propagation_sources: [],
    propagation_pressure: 0,
    reason: ['Traffic flow nominal'],
    trend: 'STABLE', history: Array.from({length: 12}, () => Math.floor(Math.random() * 40) + 40),
    camera: {
      enabled: true,
      name: 'Laxmi Nagar Square - CAM 05',
      type: 'AI_PRESET',
      url: '/videos/laxmi_nagar.mp4',
      preset_id: 'laxmi_nagar',
      fps: 30,
      resolution: '1080p FHD',
      status: 'ONLINE',
      last_updated: '18:24:00',
      videoStartOffset: 5
    }
  },
  {
    location_id: 'MANEWADA',
    name: 'Manewada',
    lat: 21.1070,
    lng: 79.0970,
    current_risk: 20,
    future_risk: 22,
    risk_shadow: false,
    police_units: 0,
    required_units: 1,
    propagation_sources: [],
    propagation_pressure: 0,
    reason: ['Clear roads', 'Low historical risk'],
    trend: 'STABLE', history: Array.from({length: 12}, () => Math.floor(Math.random() * 40) + 40),
    camera: {
      enabled: true,
      name: 'Manewada Ring Rd - CAM 06',
      type: 'AI_PRESET',
      url: '/videos/manewada_ring_road.mp4',
      preset_id: 'manewada_ring_road',
      fps: 30,
      resolution: '1080p FHD',
      status: 'ONLINE',
      last_updated: '18:24:00',
      videoStartOffset: 30
    }
  }
];

export const MOCK_EDGES: Edge[] = [
  { source: 'WARDHA_ROAD', target: 'ZERO_MILE', connection_strength: 0.75, travel_time_min: 4 },
  { source: 'ZERO_MILE', target: 'SITABULDI', connection_strength: 0.85, travel_time_min: 3 },
  { source: 'SITABULDI', target: 'MAHAL', connection_strength: 0.60, travel_time_min: 5 },
  { source: 'WARDHA_ROAD', target: 'LAXMI_NAGAR', connection_strength: 0.40, travel_time_min: 6 },
];

export const MOCK_CANDIDATES: DeploymentCandidate[] = [
  {
    location_id: 'ZERO_MILE',
    priority: 92,
    future_risk: 78,
    risk_shadow: true,
    required_units: 1,
    eta_minutes: 8
  },
  {
    location_id: 'MAHAL',
    priority: 68,
    future_risk: 73,
    risk_shadow: true,
    required_units: 1,
    eta_minutes: 14
  }
];

export const MOCK_AUDIT_LOG: AuditLogEntry[] = [
  { id: '1', timestamp: '18:15:00', action: 'Override', location: 'Zero Mile', reason: 'Marcus Chen (Ops) - VIP transit ongoing' },
  { id: '2', timestamp: '18:10:00', action: 'Deploy', location: 'Mahal', reason: 'Automated Dispatch' },
  { id: '3', timestamp: '18:05:00', action: 'Reject', location: 'Sitabuldi', reason: 'Sarah Jenkins (Shift Lead) - Unit 4 already on site' },
];
