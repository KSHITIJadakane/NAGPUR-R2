import { useState, useEffect, useCallback } from 'react';
import { MOCK_NODES, MOCK_EDGES, MOCK_CANDIDATES, MOCK_AUDIT_LOG } from './data';
import { RiskMap } from './components/RiskMap';
import { RiskOverview } from './components/RiskOverview';
import { DeploymentPanel } from './components/DeploymentPanel';
import { SimulationModal } from './components/SimulationModal';
import { CameraModal } from './components/CameraModal';
import { CameraWallModal } from './components/CameraWallModal';
import { Moon, Sun, Wifi, WifiOff, Loader2, Video, Zap } from 'lucide-react';
import { RiskNode, Edge, AuditLogEntry, Unit, DeploymentCandidate, XaiExplanation, OptimizationResult, ConnectionStatus, CameraConfig } from './types';
import * as api from './services/api';

const POLL_INTERVAL_MS = 3000;
const STORAGE_CAMERAS_KEY = 'nagpur_node_cameras_v2';

// Location name map (backend uses IDs without spaces)
const LOCATION_NAMES: Record<string, string> = {
  WARDHA_ROAD: 'Wardha Road',
  ZERO_MILE: 'Zero Mile',
  SITABULDI: 'Sitabuldi',
  MAHAL: 'Mahal',
  LAXMI_NAGAR: 'Laxmi Nagar',
  MANEWADA: 'Manewada',
};

function enrichNode(n: api.ApiNode, prev?: RiskNode, savedCameras?: Record<string, CameraConfig>, forceBackendRisk: boolean = false): RiskNode {
  // Use live AI camera risk if available, unless explicit backend sync/scenario trigger
  const effectiveRisk = (prev && !forceBackendRisk) ? prev.current_risk : n.current_risk;
  const effectiveUnits = forceBackendRisk ? n.police_units : (prev?.police_units ?? n.police_units ?? 0);
  const isShadow = (effectiveUnits >= n.required_units) ? false : (prev?.risk_shadow ?? n.risk_shadow);

  const prevHistory = prev?.history ?? Array(12).fill(effectiveRisk);
  const newHistory = [...prevHistory.slice(1), effectiveRisk];
  const prevRisk = prevHistory[prevHistory.length - 1] ?? effectiveRisk;
  const trend: 'UP' | 'DOWN' | 'STABLE' =
    effectiveRisk > prevRisk ? 'UP' : effectiveRisk < prevRisk ? 'DOWN' : 'STABLE';
  
  const camera = savedCameras?.[n.location_id] ?? n.camera ?? prev?.camera;

  return {
    ...n,
    current_risk: effectiveRisk,
    police_units: effectiveUnits,
    risk_shadow: isShadow,
    name: n.name ?? LOCATION_NAMES[n.location_id] ?? n.location_id,
    trend,
    history: newHistory,
    camera,
  };
}

export default function App() {
  const [currentTime, setCurrentTime] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isNightMode, setIsNightMode] = useState(false);

  // ── Camera Modal & Wall & Simulation state ──────────────────────────────
  const [cameraModalNode, setCameraModalNode] = useState<RiskNode | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isCameraWallOpen, setIsCameraWallOpen] = useState(false);
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);
  const [simulationActive, setSimulationActive] = useState(false);
  const [activeScenarioName, setActiveScenarioName] = useState<string | null>(null);

  // ── Data state ──────────────────────────────────────────────────────────
  const [nodes, setNodes]             = useState<RiskNode[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_CAMERAS_KEY);
      if (cached) {
        const camMap: Record<string, CameraConfig> = JSON.parse(cached);
        return MOCK_NODES.map(node => ({
          ...node,
          camera: camMap[node.location_id] ?? node.camera,
        }));
      }
    } catch { /* use default mock nodes */ }
    return MOCK_NODES;
  });
  const [edges, setEdges]             = useState<Edge[]>(MOCK_EDGES);
  const [candidates, setCandidates]   = useState<DeploymentCandidate[]>(MOCK_CANDIDATES);
  const [units, setUnits]             = useState<Unit[]>([]);
  const [auditLogs, setAuditLogs]     = useState<AuditLogEntry[]>(MOCK_AUDIT_LOG);
  const [explanations, setExplanations] = useState<XaiExplanation[]>([]);
  const [recommendation, setRecommendation] = useState<OptimizationResult | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isLiveMode, setIsLiveMode]   = useState(true);

  // ── Time ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Live API polling ────────────────────────────────────────────────────
  const fetchLiveData = useCallback(async (forceBackendRisk: boolean = false) => {
    try {
      // Health check first
      await api.checkHealth();

      const [propResult, candResult, xaiResult, backendCameras] = await Promise.all([
        api.fetchPropagation(),
        api.fetchCandidates(),
        api.fetchExplanations().catch(() => ({ explanations: [] })),
        api.fetchCameraConfigs().catch(() => ({} as Record<string, CameraConfig>)),
      ]);

      // Merge local storage cameras and backend cameras
      let localCameras: Record<string, CameraConfig> = {};
      try {
        const cached = localStorage.getItem(STORAGE_CAMERAS_KEY);
        if (cached) localCameras = JSON.parse(cached);
      } catch { /* ignore */ }

      const mergedCameras = { ...backendCameras, ...localCameras };

      setNodes(prev => {
        const prevMap = Object.fromEntries(prev.map(n => [n.location_id, n]));
        return propResult.nodes.map(n => enrichNode(n, prevMap[n.location_id], mergedCameras, forceBackendRisk));
      });

      setEdges(propResult.edges.map(e => ({
        source: e.source,
        target: e.target,
        connection_strength: e.connection_strength,
        travel_time_min: e.travel_time_min,
      })));

      setCandidates(candResult.candidates.map(c => ({
        ...c,
        eta_minutes: c.eta_minutes ?? 10,
      })));

      setExplanations(xaiResult.explanations ?? []);
      setConnectionStatus('connected');
    } catch {
      setConnectionStatus('offline');
      // Stay on current data (mock or last live)
    }
  }, []);

  useEffect(() => {
    if (!isLiveMode) return;
    fetchLiveData();
    const id = setInterval(() => fetchLiveData(false), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchLiveData, isLiveMode]);

  // ── Camera Handlers ─────────────────────────────────────────────────────
  const handleOpenConfigureCamera = useCallback((node: RiskNode) => {
    setCameraModalNode(node);
    setIsCameraModalOpen(true);
  }, []);

  const handleSaveCamera = useCallback(async (location_id: string, config: CameraConfig) => {
    setNodes(prev => prev.map(n => {
      if (n.location_id === location_id) {
        return { ...n, camera: config };
      }
      return n;
    }));

    // If user is on dashboard, keep node analysis open for this node
    setSelectedNodeId(prev => prev ?? location_id);

    // Persist to localStorage
    try {
      const cached = localStorage.getItem(STORAGE_CAMERAS_KEY);
      const camMap = cached ? JSON.parse(cached) : {};
      camMap[location_id] = config;
      localStorage.setItem(STORAGE_CAMERAS_KEY, JSON.stringify(camMap));
    } catch { /* ignore */ }

    // Sync to backend if possible
    try {
      await api.saveNodeCamera(location_id, config);
    } catch { /* silent fallback */ }
  }, []);

  const handleDeleteCamera = useCallback(async (location_id: string) => {
    setNodes(prev => prev.map(n => {
      if (n.location_id === location_id) {
        const { camera, ...rest } = n;
        return rest as RiskNode;
      }
      return n;
    }));

    // Update localStorage
    try {
      const cached = localStorage.getItem(STORAGE_CAMERAS_KEY);
      if (cached) {
        const camMap = JSON.parse(cached);
        delete camMap[location_id];
        localStorage.setItem(STORAGE_CAMERAS_KEY, JSON.stringify(camMap));
      }
    } catch { /* ignore */ }

    // Sync to backend if possible
    try {
      await api.deleteNodeCamera(location_id);
    } catch { /* silent fallback */ }
  }, []);

  // ── Night mode ──────────────────────────────────────────────────────────
  const toggleNightMode = () => {
    setIsNightMode(v => {
      const next = !v;
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };

  // ── AI Camera Risk Update ────────────────────────────────────────────────
  const lastRiskUpdateTimeRef = useRef<Record<string, number>>({});

  const handleRiskUpdate = useCallback((locationId: string, vehicleCount: number) => {
    const now = Date.now();
    const last = lastRiskUpdateTimeRef.current[locationId] || 0;
    if (now - last < 600) return; // Throttle to smooth 600ms pacing
    lastRiskUpdateTimeRef.current[locationId] = now;

    setNodes(prev => prev.map(n => {
      if (n.location_id !== locationId) return n;

      const target = Math.max(10, Math.min(95, Math.round(12 + vehicleCount * 3.5)));

      // Smooth integer step towards target
      const diff = target - n.current_risk;
      const step = Math.sign(diff) * Math.min(2, Math.ceil(Math.abs(diff) * 0.3));
      const clamped = Math.max(5, Math.min(95, n.current_risk + step));

      if (clamped === n.current_risk) return n;

      const newHistory = [...(n.history ?? []).slice(1), clamped];
      const trend: 'UP' | 'DOWN' | 'STABLE' =
        clamped > n.current_risk ? 'UP' : clamped < n.current_risk ? 'DOWN' : 'STABLE';

      return { ...n, current_risk: clamped, history: newHistory, trend };
    }));
  }, []);



  // ── Deploy action ───────────────────────────────────────────────────────
  const handleDeploy = useCallback(async (location_id: string, reason: string) => {
    const targetNode = nodes.find(n => n.location_id === location_id);
    if (!targetNode) return;

    // Spawn unit marker immediately (optimistic UI)
    const newUnit: Unit = {
      id: `UNIT-${Math.floor(Math.random() * 1000)}`,
      lat: targetNode.lat ?? 21.1189,
      lng: targetNode.lng ?? 79.0664,
      target_id: location_id,
      status: 'EN_ROUTE',
    };
    setUnits(prev => [...prev, newUnit]);

    // Update node state to reflect unit coverage
    setNodes(prev => prev.map(n => {
      if (n.location_id === location_id) {
        const updatedUnits = n.police_units + 1;
        return {
          ...n,
          police_units: updatedUnits,
          risk_shadow: updatedUnits < n.required_units ? n.risk_shadow : false,
        };
      }
      return n;
    }));

    const newLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'Deploy',
      location: targetNode.name,
      reason,
    };
    setAuditLogs(prev => [newLog, ...prev]);

    // Call backend optimizer
    try {
      const result = await api.postOptimize();
      setRecommendation(result);
    } catch {
      // Optimizer unavailable — unit still shows on map
    }
  }, [nodes]);

  // ── Override action ─────────────────────────────────────────────────────
  const handleOverride = useCallback(async (location_id: string, reason: string) => {
    const targetNode = nodes.find(n => n.location_id === location_id);
    try {
      await api.postOverride({
        recommendation_id: recommendation?.recommendation_id ?? 'MANUAL',
        action: 'OVERRIDE',
        reason,
        operator_note: `Operator rejected recommendation for ${location_id}`,
      });
    } catch { /* log failure silently */ }

    const newLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'Override',
      location: targetNode?.name ?? location_id,
      reason,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  }, [nodes, recommendation]);

  // ── Reset / Recall Deployments ──────────────────────────────────────────
  const handleResetDeployments = useCallback(async () => {
    // Clear optimistic units on map
    setUnits([]);

    // Reset node coverage units back to 0
    setNodes(prev => prev.map(n => ({
      ...n,
      police_units: 0,
      risk_shadow: (n.required_units || 0) > 0 ? (n.current_risk > 30) : false,
    })));

    setRecommendation(null);

    const newLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'Override',
      location: 'All Sectors',
      reason: 'Recalled all units to Traffic HQ Standby',
    };
    setAuditLogs(prev => [newLog, ...prev]);

    try {
      await api.resetDeployment();
    } catch { /* silent fallback */ }
  }, []);

  // ── Connection status badge ─────────────────────────────────────────────
  const statusBadge = !isLiveMode
    ? { color: 'bg-indigo-500', icon: <Wifi size={14} />, label: 'DEMO' }
    : {
        connected:  { color: 'bg-emerald-500', icon: <Wifi size={14} />,     label: 'LIVE' },
        offline:    { color: 'bg-rose-500',    icon: <WifiOff size={14} />,  label: 'OFFLINE' },
        connecting: { color: 'bg-amber-500',   icon: <Loader2 size={14} className="animate-spin" />, label: 'CONNECTING' },
      }[connectionStatus];

  return (
    <div className={`h-[100dvh] font-sans overflow-hidden flex flex-col relative transition-colors duration-300 ${isNightMode ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-100/90 text-slate-900'}`}>
      {/* Header */}
      <header className={`mx-2 sm:mx-6 mt-2 sm:mt-6 px-3 sm:px-8 py-3 sm:py-5 rounded-[18px] sm:rounded-[24px] flex flex-wrap sm:flex-nowrap justify-between items-center gap-2.5 sm:gap-4 shrink-0 z-50 panel-shadow border transition-colors duration-300 ${isNightMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-2.5 sm:gap-4">
          <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-[12px] sm:rounded-[16px] flex items-center justify-center border ${isNightMode ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-50 border-slate-200'}`}>
            <span className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-rose-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.4)]"></span>
          </div>
          <div className="flex flex-col">
            <h1 className={`text-base sm:text-xl font-display font-bold tracking-tight leading-none ${isNightMode ? 'text-white' : 'text-slate-900'}`}>
              NAGPUR-R2
            </h1>
            <span className={`text-[10px] sm:text-sm font-medium mt-0.5 sm:mt-1 ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>Tactical Command Center</span>
          </div>
        </div>

        <div className="flex items-center flex-wrap sm:flex-nowrap gap-1.5 sm:gap-3 ml-auto sm:ml-0">
          {/* Incident Simulator Modal Button */}
          <button
            onClick={() => setIsSimulationModalOpen(true)}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-[8px] sm:rounded-[10px] border text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all shadow-sm ${
              simulationActive
                ? 'bg-amber-950/60 border-amber-600 text-amber-300 ring-2 ring-amber-500/40 shadow-amber-900/30 animate-pulse'
                : isNightMode
                ? 'bg-zinc-800 border-zinc-700 text-amber-400 hover:bg-zinc-700 hover:border-amber-500/50'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 hover:border-amber-300'
            }`}
            title="Open Incident & Scenario Simulator"
          >
            <Zap size={13} className={simulationActive ? 'text-amber-400' : 'text-amber-600'} />
            <span>SIMULATOR</span>
            {simulationActive ? (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping ml-0.5" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />
            )}
          </button>

          {/* CCTV Wall Button */}
          <button
            onClick={() => setIsCameraWallOpen(true)}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-[8px] sm:rounded-[10px] border text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-colors ${
              isNightMode 
                ? 'bg-zinc-800 border-zinc-700 text-rose-300 hover:bg-zinc-700' 
                : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
            title="Open Live CCTV Command Wall"
          >
            <Video size={13} className="text-rose-500" />
            <span>CCTV WALL</span>
          </button>

          {/* Connection status */}
          <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-[8px] sm:rounded-[10px] border text-[10px] sm:text-xs font-bold ${
            isNightMode 
              ? 'bg-zinc-800 border-zinc-700 text-zinc-300' 
              : 'bg-white border-slate-200 text-slate-700'
          }`}>
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${statusBadge.color} ${connectionStatus === 'connecting' ? '' : 'animate-pulse'}`}></span>
            {statusBadge.icon}
            <span className="hidden sm:inline">{statusBadge.label}</span>
          </div>

          {/* Live/Demo toggle */}
          <button
            onClick={() => setIsLiveMode(v => !v)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-[8px] sm:rounded-[10px] border text-[10px] sm:text-xs font-bold transition-colors ${
              isLiveMode 
                ? (isNightMode ? 'bg-emerald-900/50 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-800') 
                : (isNightMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-white border-slate-200 text-slate-600')
            }`}
          >
            {isLiveMode ? '⚡ LIVE' : '🎭 DEMO'}
          </button>

          <button
            onClick={toggleNightMode}
            className={`p-1.5 sm:p-2.5 rounded-[8px] sm:rounded-[12px] border transition-colors ${
              isNightMode 
                ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white' 
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            title="Toggle Night Mode"
          >
            {isNightMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <div className={`text-xs sm:text-sm font-semibold font-mono px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-[10px] sm:rounded-[14px] border hidden md:flex items-center gap-2 sm:gap-3 ${
            isNightMode 
              ? 'bg-zinc-800 border-zinc-700 text-zinc-300' 
              : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {currentTime}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col w-full p-2.5 sm:p-6 gap-3 sm:gap-6 relative z-10 max-w-[1920px] mx-auto overflow-y-auto no-scrollbar">

        {/* Map */}
        <section className="w-full h-[46vh] sm:h-[52vh] min-h-[340px] sm:min-h-[440px] flex flex-col shrink-0">
          <div className={`flex-1 relative rounded-[18px] sm:rounded-[24px] overflow-hidden panel-shadow border flex flex-col p-1.5 sm:p-2 transition-colors duration-300 ${
            isNightMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
          }`}>
            <div className="px-3 sm:px-5 py-2.5 sm:py-4 flex items-center gap-2 sm:gap-3 shrink-0">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                isNightMode ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-700'
              }`}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              </div>
              <h2 className={`text-sm sm:text-base font-display font-bold ${isNightMode ? 'text-zinc-100' : 'text-slate-900'}`}>Tactical Map</h2>
              {connectionStatus === 'connected' && (
                <span className="ml-auto text-[11px] sm:text-xs text-emerald-500 font-semibold">● Live</span>
              )}
            </div>
            <div className={`flex-1 relative rounded-[12px] sm:rounded-[16px] overflow-hidden border min-h-[200px] sm:min-h-[300px] ${
              isNightMode ? 'border-zinc-800 bg-zinc-950' : 'border-slate-200 bg-slate-100'
            }`}>
              <div className="absolute inset-0">
                <RiskMap
                  nodes={nodes}
                  edges={edges}
                  units={units}
                  isNightMode={isNightMode}
                  onNodeClick={setSelectedNodeId}
                  onOpenCctvWall={() => setIsCameraWallOpen(true)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Panel */}
        <section className="w-full shrink-0 pb-10">
          <div className="flex flex-col xl:flex-row gap-6">
            <div className="flex-1 flex flex-col gap-6">
              <RiskOverview
                nodes={nodes}
                onNodeClick={setSelectedNodeId}
                selectedNodeId={selectedNodeId}
                isNightMode={isNightMode}
                explanations={explanations}
                onConfigureCamera={handleOpenConfigureCamera}
                onRiskUpdate={handleRiskUpdate}
              />
            </div>
            <div className="w-full xl:w-[420px] shrink-0 flex flex-col gap-6">
              <DeploymentPanel
                candidates={candidates}
                auditLogs={auditLogs}
                isNightMode={isNightMode}
                onDeploy={handleDeploy}
                onOverride={handleOverride}
                onResetDeployments={handleResetDeployments}
                recommendation={recommendation}
                nodes={nodes}
                units={units}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Incident & Scenario Simulator Modal */}
      <SimulationModal
        isOpen={isSimulationModalOpen}
        nodes={nodes}
        isNightMode={isNightMode}
        onClose={() => setIsSimulationModalOpen(false)}
        onScenarioRun={(scenarioName?: string, presetId?: string, locationId?: string, severity?: string) => {
          setSimulationActive(true);
          const name = scenarioName || 'CUSTOM';
          setActiveScenarioName(name);

          // ── Client-side instant simulation update ──────────────────────────
          const SIM_PRESETS: Record<string, Record<string, { current: number; future: number; reason: string[] }>> = {
            festival: {
              MAHAL: { current: 78, future: 92, reason: ['Major festival gathering at Mahal heritage zone', 'Pedestrian density exceeding threshold'] },
              SITABULDI: { current: 65, future: 85, reason: ['Retail festival crowd overflow from Sitabuldi market'] },
              ZERO_MILE: { current: 58, future: 79, reason: ['Upstream propagation shockwave from Sitabuldi interchange'] },
              WARDHA_ROAD: { current: 52, future: 74, reason: ['Corridor transit congestion towards festival zone'] },
              LAXMI_NAGAR: { current: 40, future: 55, reason: ['Secondary arterial detour volume building up'] },
              MANEWADA: { current: 30, future: 42, reason: ['Moderate ring road freight traffic'] },
            },
            accident: {
              WARDHA_ROAD: { current: 88, future: 96, reason: ['Multi-vehicle collision blocking two primary expressway lanes', 'Severe immediate bottleneck'] },
              ZERO_MILE: { current: 74, future: 91, reason: ['Severe shockwave spillover from Wardha Road crash site'] },
              SITABULDI: { current: 62, future: 82, reason: ['Downstream detour congestion building up rapidly'] },
              LAXMI_NAGAR: { current: 48, future: 66, reason: ['Local intersection diversion strain'] },
              MAHAL: { current: 35, future: 48, reason: ['Nominal flow rate in heritage zone'] },
              MANEWADA: { current: 28, future: 36, reason: ['Ring road logistics normal'] },
            },
            rain: {
              WARDHA_ROAD: { current: 68, future: 84, reason: ['Severe expressway waterlogging reducing vehicular speed by 50%'] },
              ZERO_MILE: { current: 75, future: 89, reason: ['Transit interchange junction drainage saturation'] },
              SITABULDI: { current: 70, future: 86, reason: ['Commercial corridor urban flash flood advisory'] },
              MAHAL: { current: 64, future: 80, reason: ['Narrow heritage lane drainage overflow'] },
              LAXMI_NAGAR: { current: 60, future: 76, reason: ['Residential square surface water accumulation'] },
              MANEWADA: { current: 55, future: 70, reason: ['Outer ring road heavy spray and reduced visibility'] },
            },
          };

          const selectedPreset = presetId?.toLowerCase();
          if (selectedPreset && SIM_PRESETS[selectedPreset]) {
            const data = SIM_PRESETS[selectedPreset];
            setNodes(prev => prev.map(n => {
              const sim = data[n.location_id];
              if (!sim) return n;
              const newCurrent = sim.current;
              const newFuture = sim.future;
              const isShadow = (newFuture >= 70) && (n.police_units < n.required_units);
              const history = [...n.history.slice(1), newCurrent];
              return {
                ...n,
                current_risk: newCurrent,
                future_risk: newFuture,
                risk_shadow: isShadow,
                trend: 'UP',
                history,
                reason: sim.reason,
              };
            }));

            // Generate responsive candidates
            const newCandidates: DeploymentCandidate[] = Object.entries(data)
              .filter(([_, d]) => d.future >= 60)
              .map(([locId, d], idx) => ({
                location_id: locId,
                priority: Math.round(d.future * 0.8),
                future_risk: d.future,
                risk_shadow: d.future >= 70,
                required_units: d.future >= 85 ? 2 : 1,
                eta_minutes: 8 + (idx * 2),
              }))
              .sort((a, b) => b.priority - a.priority);

            if (newCandidates.length > 0) setCandidates(newCandidates);
          } else if (locationId) {
            // Single junction injection
            const bump = severity === 'CRITICAL' ? 45 : severity === 'HIGH' ? 30 : severity === 'MEDIUM' ? 20 : 10;
            setNodes(prev => prev.map(n => {
              if (n.location_id === locationId) {
                const newCurrent = Math.min(100, n.current_risk + bump);
                const newFuture = Math.min(100, n.future_risk + bump + 10);
                return {
                  ...n,
                  current_risk: newCurrent,
                  future_risk: newFuture,
                  risk_shadow: (newFuture >= 70) && (n.police_units < n.required_units),
                  trend: 'UP',
                  history: [...n.history.slice(1), newCurrent],
                  reason: [`Injected ${severity || 'HIGH'} simulated incident alert`],
                };
              }
              return n;
            }));
          }

          // Also attempt live backend sync if online
          fetchLiveData(true);
        }}
        onResetToRealData={() => {
          setSimulationActive(false);
          setActiveScenarioName(null);
          handleResetDeployments();
          setNodes(MOCK_NODES);
          setCandidates(MOCK_CANDIDATES);
          fetchLiveData(true);
        }}
        simulationActive={simulationActive}
        activeScenarioName={activeScenarioName}
      />

      {/* Camera Configuration Modal */}
      <CameraModal
        isOpen={isCameraModalOpen}
        node={cameraModalNode}
        isNightMode={isNightMode}
        onClose={() => {
          setIsCameraModalOpen(false);
          setCameraModalNode(null);
        }}
        onSave={handleSaveCamera}
        onDelete={handleDeleteCamera}
      />

      {/* CCTV Command Wall Modal */}
      <CameraWallModal
        isOpen={isCameraWallOpen}
        nodes={nodes}
        isNightMode={isNightMode}
        onClose={() => setIsCameraWallOpen(false)}
        onConfigureNode={node => {
          handleOpenConfigureCamera(node);
        }}
        onRiskUpdate={handleRiskUpdate}
      />
    </div>
  );
}
