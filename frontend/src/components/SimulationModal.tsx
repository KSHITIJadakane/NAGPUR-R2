import { useState } from 'react';
import { runScenario, postIncident, resetToBaseline } from '../services/api';
import { RiskNode } from '../types';
import {
  Zap,
  AlertTriangle,
  CloudRain,
  ShieldAlert,
  Construction,
  RotateCcw,
  Loader2,
  Sliders,
  Radio,
  CheckCircle2,
  Sparkles,
  X,
  Activity,
  Layers,
} from 'lucide-react';

interface SimulationModalProps {
  isOpen: boolean;
  nodes?: RiskNode[];
  isNightMode?: boolean;
  onClose: () => void;
  onScenarioRun?: (scenarioName?: string) => void;
  onResetToRealData?: () => void;
  simulationActive?: boolean;
  activeScenarioName?: string | null;
}

// ── Incident Types ─────────────────────────────────────────────────────────────
const INCIDENT_TYPES = [
  {
    id: 'ACCIDENT',
    label: 'Collision / Pileup',
    icon: <AlertTriangle size={16} className="text-rose-400" />,
    scenarioPreset: 'accident',
    tag: 'HIGH IMPACT',
    desc: 'Critical multi-vehicle crash blocking active corridor lanes with sudden downstream spillover.',
  },
  {
    id: 'CROWD',
    label: 'Festival / Mass Gathering',
    icon: <Zap size={16} className="text-amber-400" />,
    scenarioPreset: 'festival',
    tag: 'CONGESTION',
    desc: 'Major religious or cultural event generating dense pedestrian surge & bottleneck.',
  },
  {
    id: 'WEATHER',
    label: 'Heavy Monsoon / Flooding',
    icon: <CloudRain size={16} className="text-sky-400" />,
    scenarioPreset: 'rain',
    tag: 'WEATHER',
    desc: 'Severe road waterlogging causing citywide speed reduction & sensor degradation.',
  },
  {
    id: 'SECURITY',
    label: 'VIP Escort / Security Blockade',
    icon: <ShieldAlert size={16} className="text-violet-400" />,
    scenarioPreset: null,
    tag: 'TACTICAL',
    desc: 'Strategic security perimeter establishment & mandatory corridor diversion.',
  },
  {
    id: 'GRIDLOCK',
    label: 'Roadwork / Construction Gridlock',
    icon: <Construction size={16} className="text-orange-400" />,
    scenarioPreset: null,
    tag: 'BOTTLENECK',
    desc: 'Emergency infrastructure repair closing key flyovers & arterial lines.',
  },
] as const;

type IncidentTypeId = typeof INCIDENT_TYPES[number]['id'];
type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const SEVERITY_CONFIG: Record<SeverityLevel, { label: string; bump: string; desc: string; color: string; badge: string }> = {
  LOW: {
    label: 'Low',
    bump: '+15%',
    desc: 'Minor delay, localized friction',
    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
    badge: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
  },
  MEDIUM: {
    label: 'Medium',
    bump: '+30%',
    desc: 'Moderate bottleneck, lane restriction',
    color: 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20',
    badge: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
  },
  HIGH: {
    label: 'High',
    bump: '+50%',
    desc: 'Severe blockage, propagation shadow',
    color: 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20',
    badge: 'text-rose-400 border-rose-500/40 bg-rose-950/40',
  },
  CRITICAL: {
    label: 'Critical',
    bump: '+70%',
    desc: 'Complete gridlock, emergency dispatch required',
    color: 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20',
    badge: 'text-purple-400 border-purple-500/40 bg-purple-950/40',
  },
};

export function SimulationModal({
  isOpen,
  nodes = [],
  isNightMode = false,
  onClose,
  onScenarioRun,
  onResetToRealData,
  simulationActive = false,
  activeScenarioName = null,
}: SimulationModalProps) {
  if (!isOpen) return null;

  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<IncidentTypeId>('ACCIDENT');
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityLevel>('HIGH');
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // ── 1. Inject Incident on Node or Citywide ─────────────────────────────────
  const handleInjectIncident = async () => {
    setIsExecuting(true);
    setStatusMessage(null);

    try {
      if (selectedLocation === 'ALL') {
        const preset = INCIDENT_TYPES.find(t => t.id === selectedType)?.scenarioPreset || 'accident';
        await runScenario(preset);
        setStatusMessage(`✓ Citywide ${selectedType} simulation deployed across all sectors`);
        onScenarioRun?.(`Citywide ${selectedType}`);
      } else {
        await postIncident({
          location_id: selectedLocation,
          type: selectedType,
          severity: selectedSeverity,
        });
        const nodeName = nodes.find(n => n.location_id === selectedLocation)?.name || selectedLocation;
        setStatusMessage(`✓ Injected ${selectedSeverity} ${selectedType} at ${nodeName} (${SEVERITY_CONFIG[selectedSeverity].bump})`);
        onScenarioRun?.(`${selectedSeverity} ${selectedType}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to inject scenario';
      setStatusMessage(`✗ ${msg}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // ── 2. Return to Normal Real Data ─────────────────────────────────────────
  const handleReturnToRealData = async () => {
    setIsExecuting(true);
    setStatusMessage(null);

    try {
      await resetToBaseline();
      setStatusMessage('✓ Returned to Real Data — Live AI camera stream active');
      onResetToRealData?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to reset scenario';
      setStatusMessage(`✗ ${msg}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // ── 3. Quick 1-Click Presets ───────────────────────────────────────────────
  const handleQuickPreset = async (presetId: string, label: string) => {
    setIsExecuting(true);
    setStatusMessage(null);
    try {
      await runScenario(presetId);
      setStatusMessage(`✓ Deployed ${label} scenario`);
      onScenarioRun?.(label);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load scenario';
      setStatusMessage(`✗ ${msg}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* ── Modal Container ────────────────────────────────────────────────── */}
      <div className={`w-full max-w-3xl rounded-[28px] border shadow-2xl overflow-hidden flex flex-col transition-all ${
        isNightMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-zinc-900 border-zinc-800 text-white'
      }`}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4.5 border-b border-zinc-800/90 bg-zinc-900/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-display font-bold text-white">Tactical Incident &amp; Scenario Simulator</h3>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                  simulationActive
                    ? 'bg-rose-950/70 text-rose-300 border-rose-700/60 animate-pulse'
                    : 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${simulationActive ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                  {simulationActive ? `SIMULATION ACTIVE (${activeScenarioName || 'CUSTOM'})` : 'REAL DATA MODE'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">Inject custom incident spikes per junction or reset to live AI camera feeds</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-700 shrink-0"
            title="Close Simulator"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body Content ─────────────────────────────────────────────────── */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[80vh]">

          {/* Section 1: Quick Mode Toggle (Back to Real Data / Quick Presets) */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Activity size={14} className="text-indigo-400" />
                Quick Actions &amp; Global Switch
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">1-Click Control</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              
              {/* BACK TO REAL DATA BUTTON */}
              <button
                onClick={handleReturnToRealData}
                disabled={isExecuting}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  !simulationActive
                    ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'bg-zinc-900 border-emerald-800/60 text-emerald-400 hover:bg-emerald-950/40 hover:border-emerald-500'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <RotateCcw size={13} className="text-emerald-400" />
                  <span>Real Data</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 mt-0.5">Live Camera Streams</span>
              </button>

              {/* Preset: Festival */}
              <button
                onClick={() => handleQuickPreset('festival', 'Festival')}
                disabled={isExecuting}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-amber-950/30 hover:border-amber-700/60 text-zinc-300 hover:text-amber-300 transition-all text-center"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Zap size={13} className="text-amber-400" />
                  <span>Festival Preset</span>
                </div>
                <span className="text-[10px] text-zinc-500 mt-0.5">Sitabuldi + Mahal</span>
              </button>

              {/* Preset: Accident */}
              <button
                onClick={() => handleQuickPreset('accident', 'Accident')}
                disabled={isExecuting}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-rose-950/30 hover:border-rose-700/60 text-zinc-300 hover:text-rose-300 transition-all text-center"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <AlertTriangle size={13} className="text-rose-400" />
                  <span>Crash Preset</span>
                </div>
                <span className="text-[10px] text-zinc-500 mt-0.5">Wardha Rd Collision</span>
              </button>

              {/* Preset: Rain */}
              <button
                onClick={() => handleQuickPreset('rain', 'Heavy Rain')}
                disabled={isExecuting}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-sky-950/30 hover:border-sky-700/60 text-zinc-300 hover:text-sky-300 transition-all text-center"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <CloudRain size={13} className="text-sky-400" />
                  <span>Rain Monsoon</span>
                </div>
                <span className="text-[10px] text-zinc-500 mt-0.5">Citywide Wet Roads</span>
              </button>
            </div>
          </div>

          {/* Section 2: Targeted Node & Incident Configurator */}
          <div className="flex flex-col gap-4">
            
            {/* Step 1: Select Target Node */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-mono">1</span>
                <span>Select Target Junction / Sector</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLocation('ALL')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selectedLocation === 'ALL'
                      ? 'bg-indigo-600/30 border-indigo-500 text-white ring-1 ring-indigo-500'
                      : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-400" />
                    <span>All Nodes</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">Citywide Network</span>
                </button>

                {nodes.map(n => (
                  <button
                    key={n.location_id}
                    type="button"
                    onClick={() => setSelectedLocation(n.location_id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedLocation === n.location_id
                        ? 'bg-indigo-600/30 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <div className="font-bold text-xs truncate flex items-center justify-between">
                      <span className="truncate">{n.name}</span>
                      <span className={`text-[10px] font-mono font-bold ${n.current_risk > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {n.current_risk}%
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">[{n.location_id}]</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select Incident Type */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-mono">2</span>
                <span>Select Incident / Emergency Type</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {INCIDENT_TYPES.map(type => {
                  const isSelected = selectedType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSelectedType(type.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600/25 border-indigo-500 text-white ring-1 ring-indigo-500 shadow-sm'
                          : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-white">
                          {type.icon}
                          <span>{type.label}</span>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {type.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {type.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Select Severity */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-mono">3</span>
                <span>Select Severity &amp; Risk Delta</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as SeverityLevel[]).map(sev => {
                  const cfg = SEVERITY_CONFIG[sev];
                  const isSelected = selectedSeverity === sev;
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSelectedSeverity(sev)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? `${cfg.badge} border-2 shadow-md ring-1 ring-white/20 font-bold scale-[1.02]`
                          : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-xs">{cfg.label}</span>
                        <span className="text-xs font-mono font-bold">{cfg.bump}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1">{cfg.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2 font-medium">
                {statusMessage.startsWith('✓') ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                )}
                <span className={statusMessage.startsWith('✓') ? 'text-emerald-400' : 'text-rose-400'}>
                  {statusMessage}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          )}

        </div>

        {/* ── Footer Actions ───────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors"
          >
            Cancel / Close
          </button>

          <button
            onClick={handleInjectIncident}
            disabled={isExecuting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 active:scale-95 disabled:opacity-50 transition-all"
          >
            {isExecuting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            <span>Deploy Simulation Scenario</span>
          </button>
        </div>

      </div>
    </div>
  );
}
