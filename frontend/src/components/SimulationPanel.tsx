import { useState } from 'react';
import { runScenario, postIncident } from '../services/api';
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
} from 'lucide-react';

interface SimulationPanelProps {
  nodes?: RiskNode[];
  isNightMode?: boolean;
  onScenarioRun?: () => void;
  onResetToRealData?: () => void;
}

// ── Incident Types ─────────────────────────────────────────────────────────────
const INCIDENT_TYPES = [
  {
    id: 'ACCIDENT',
    label: 'Collision / Crash',
    icon: <AlertTriangle size={14} className="text-rose-400" />,
    scenarioPreset: 'accident',
    desc: 'Multi-vehicle collision blocking active lanes',
  },
  {
    id: 'CROWD',
    label: 'Festival / Crowd',
    icon: <Zap size={14} className="text-amber-400" />,
    scenarioPreset: 'festival',
    desc: 'Mass gathering & rapid pedestrian surge',
  },
  {
    id: 'WEATHER',
    label: 'Heavy Monsoon / Rain',
    icon: <CloudRain size={14} className="text-sky-400" />,
    scenarioPreset: 'rain',
    desc: 'Severe waterlogging and brake distance penalty',
  },
  {
    id: 'SECURITY',
    label: 'VIP Transit / Blockade',
    icon: <ShieldAlert size={14} className="text-violet-400" />,
    scenarioPreset: null,
    desc: 'Security perimeter and arterial route diversion',
  },
  {
    id: 'GRIDLOCK',
    label: 'Roadwork / Gridlock',
    icon: <Construction size={14} className="text-orange-400" />,
    scenarioPreset: null,
    desc: 'Emergency lane repairs and choke-point bottleneck',
  },
] as const;

type IncidentTypeId = typeof INCIDENT_TYPES[number]['id'];
type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const SEVERITY_CONFIG: Record<SeverityLevel, { label: string; bump: string; color: string; badge: string }> = {
  LOW: {
    label: 'Low',
    bump: '+15%',
    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
    badge: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
  },
  MEDIUM: {
    label: 'Medium',
    bump: '+30%',
    color: 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20',
    badge: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
  },
  HIGH: {
    label: 'High',
    bump: '+50%',
    color: 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20',
    badge: 'text-rose-400 border-rose-500/40 bg-rose-950/40',
  },
  CRITICAL: {
    label: 'Critical',
    bump: '+70%',
    color: 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20',
    badge: 'text-purple-400 border-purple-500/40 bg-purple-950/40',
  },
};

export function SimulationPanel({
  nodes = [],
  isNightMode = false,
  onScenarioRun,
  onResetToRealData,
}: SimulationPanelProps) {
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<IncidentTypeId>('ACCIDENT');
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityLevel>('HIGH');
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeSimulationMode, setActiveSimulationMode] = useState<'REAL_DATA' | 'SIMULATION'>('REAL_DATA');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // ── 1. Inject Specific Incident on Selected Node ───────────────────────────
  const handleInjectIncident = async () => {
    setIsExecuting(true);
    setStatusMessage(null);

    try {
      if (selectedLocation === 'ALL') {
        // Find mapped preset or fallback
        const preset = INCIDENT_TYPES.find(t => t.id === selectedType)?.scenarioPreset || 'accident';
        await runScenario(preset);
        setStatusMessage(`✓ Citywide ${selectedType} scenario deployed across all corridors`);
      } else {
        await postIncident({
          location_id: selectedLocation,
          type: selectedType,
          severity: selectedSeverity,
        });
        const nodeName = nodes.find(n => n.location_id === selectedLocation)?.name || selectedLocation;
        setStatusMessage(`✓ ${selectedSeverity} ${selectedType} incident injected at ${nodeName} (${SEVERITY_CONFIG[selectedSeverity].bump})`);
      }

      setActiveSimulationMode('SIMULATION');
      onScenarioRun?.();
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
      await runScenario('baseline');
      setActiveSimulationMode('REAL_DATA');
      setStatusMessage('✓ Returned to Real Data — Live AI Camera detection active');
      onResetToRealData?.();
      onScenarioRun?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to reset scenario';
      setStatusMessage(`✗ ${msg}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className={`rounded-[22px] border p-4 sm:p-5 panel-shadow transition-all ${isNightMode ? 'bg-zinc-900/95 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'}`}>
      
      {/* ── Top Bar: Title, Active Status, and "Back to Real Data" Button ──── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Sliders size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-display font-bold">Tactical Scenario &amp; Incident Simulator</h3>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                activeSimulationMode === 'REAL_DATA'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : 'bg-rose-950/60 text-rose-300 border-rose-800/60 animate-pulse'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeSimulationMode === 'REAL_DATA' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                {activeSimulationMode === 'REAL_DATA' ? 'REAL DATA MODE' : 'SIMULATION ACTIVE'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Inject custom incident spikes per junction or reset to live AI camera streams</p>
          </div>
        </div>

        {/* ── RETURN TO REAL DATA (NORMAL WORKING) BUTTON ───────────────────── */}
        <button
          onClick={handleReturnToRealData}
          disabled={isExecuting}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 ${
            activeSimulationMode === 'REAL_DATA'
              ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-600/30 ring-2 ring-emerald-500/40 animate-bounce'
          }`}
          title="Clear all simulated spikes and restore normal live camera detection"
        >
          {isExecuting && activeSimulationMode === 'SIMULATION' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RotateCcw size={13} className="text-emerald-300" />
          )}
          <span>Back to Real Data</span>
        </button>
      </div>

      {/* ── Interactive Injection Matrix (Node, Type, Severity) ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
        
        {/* 1. Target Node Selector */}
        <div className="md:col-span-3 flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <Radio size={12} className="text-indigo-400" />
            Target Node / Sector
          </label>
          <select
            value={selectedLocation}
            onChange={e => setSelectedLocation(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="ALL">🌐 All Nodes (Citywide Network)</option>
            {nodes.map(n => (
              <option key={n.location_id} value={n.location_id}>
                📍 {n.name} [{n.current_risk}% Risk]
              </option>
            ))}
          </select>
        </div>

        {/* 2. Incident Type Selector */}
        <div className="md:col-span-4 flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-400" />
            Incident Type
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {INCIDENT_TYPES.slice(0, 4).map(type => {
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  type="button"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors text-left truncate ${
                    isSelected
                      ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-sm'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                  title={type.desc}
                >
                  {type.icon}
                  <span className="truncate">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Severity Level */}
        <div className="md:col-span-3 flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-rose-400" />
            Severity &amp; Impact
          </label>
          <div className="flex gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as SeverityLevel[]).map(sev => {
              const cfg = SEVERITY_CONFIG[sev];
              const isSelected = selectedSeverity === sev;
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSelectedSeverity(sev)}
                  className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold font-mono transition-all text-center ${
                    isSelected
                      ? `${cfg.badge} border shadow-sm font-extrabold scale-105`
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={`Risk bump: ${cfg.bump}`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Action Trigger Button */}
        <div className="md:col-span-2 flex flex-col justify-end">
          <button
            onClick={handleInjectIncident}
            disabled={isExecuting}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95 disabled:opacity-50 transition-all"
          >
            {isExecuting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Zap size={13} />
            )}
            <span>Simulate</span>
          </button>
        </div>

      </div>

      {/* ── Status Toast ─────────────────────────────────────────────────── */}
      {statusMessage && (
        <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-1.5 font-medium">
            {statusMessage.startsWith('✓') ? (
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle size={13} className="text-rose-400 shrink-0" />
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
  );
}
