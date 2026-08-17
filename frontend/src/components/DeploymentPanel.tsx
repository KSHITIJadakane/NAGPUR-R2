import { useState } from 'react';
import { DeploymentCandidate, AuditLogEntry, OptimizationResult, RiskNode, Unit } from '../types';
import { postOptimize } from '../services/api';
import {
  Loader2,
  GitCompareArrows,
  ShieldCheck,
  Sliders,
  Zap,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface DeploymentPanelProps {
  candidates: DeploymentCandidate[];
  auditLogs: AuditLogEntry[];
  isNightMode?: boolean;
  onDeploy?: (location_id: string, reason: string) => void;
  onOverride?: (location_id: string, reason: string) => void;
  onResetDeployments?: () => void;
  recommendation?: OptimizationResult | null;
  nodes?: RiskNode[];
  units?: Unit[];
}

const OVERRIDE_REASONS = [
  'GROUND_SITUATION_DIFFERS',
  'OFFICER_UNAVAILABLE',
  'VIP_EVENT_MOVEMENT',
  'OTHER',
];

export function DeploymentPanel({
  candidates,
  auditLogs,
  isNightMode = false,
  onDeploy,
  onOverride,
  onResetDeployments,
  nodes = [],
}: DeploymentPanelProps) {
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState(OVERRIDE_REASONS[0]);
  const [optimizing, setOptimizing] = useState(false);
  const [whatIfMode, setWhatIfMode] = useState<'LIVE' | 'PLAYGROUND'>('LIVE');
  const [simulatedUnitCount, setSimulatedUnitCount] = useState<number>(3);

  // ── Dynamic Accurate Real-World Exposure Calculations ───────────────────────
  // 1. Unmitigated Baseline (If 0 police were deployed across all junctions)
  const unmitigatedTotalRisk = Math.round(
    nodes.reduce((acc, n) => acc + (n.future_risk || n.current_risk), 0)
  );
  const totalShadowsInCity = nodes.filter(n => n.risk_shadow).length;

  // 2. Currently Covered Risk (Risk neutralized by actively deployed units)
  const deployedCoveredRisk = Math.round(
    nodes
      .filter(n => n.police_units >= n.required_units && n.required_units > 0)
      .reduce((acc, n) => acc + (n.future_risk || n.current_risk), 0)
  );

  // 3. Remaining Uncovered Risk Exposure in City
  const currentUncoveredRisk = Math.max(0, unmitigatedTotalRisk - deployedCoveredRisk);
  const remainingUncoveredShadows = nodes.filter(n => n.risk_shadow && n.police_units < n.required_units).length;

  // 4. Percentage Risk Averted
  const mitigatedPct = unmitigatedTotalRisk > 0
    ? Math.round((deployedCoveredRisk / unmitigatedTotalRisk) * 100)
    : 0;

  // ── Interactive Playground Simulation Calculation ───────────────────────────
  // Sort all nodes by priority / future_risk
  const sortedNodes = [...nodes].sort((a, b) => (b.future_risk || 0) - (a.future_risk || 0));
  const simCoveredRisk = Math.round(
    sortedNodes.slice(0, simulatedUnitCount).reduce((acc, n) => acc + (n.future_risk || 0), 0)
  );
  const simRemainingRisk = Math.max(0, unmitigatedTotalRisk - simCoveredRisk);
  const simImprovementPct = unmitigatedTotalRisk > 0
    ? Math.round((simCoveredRisk / unmitigatedTotalRisk) * 100)
    : 0;

  const handleDeployClick = (cand: DeploymentCandidate) => {
    onDeploy?.(cand.location_id, `Dispatched unit to ${cand.location_id.replace(/_/g, ' ')} — priority ${Math.round(cand.priority <= 1 ? cand.priority * 100 : cand.priority)}%`);
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      await postOptimize();
    } catch { /* handled in App */ } finally {
      setOptimizing(false);
    }
  };

  const handleOverrideConfirm = () => {
    if (!overrideTarget) return;
    onOverride?.(overrideTarget, overrideReason);
    setOverrideTarget(null);
    setOverrideReason(OVERRIDE_REASONS[0]);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      
      {/* ── 1. Interactive What-If Analysis Intelligence Card ─────────────── */}
      <div className={`border rounded-[24px] p-5.5 panel-shadow transition-all ${
        isNightMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Card Header & Tab Toggle */}
        <div className={`flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b ${
          isNightMode ? 'border-zinc-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <GitCompareArrows size={16} className={isNightMode ? 'text-indigo-400' : 'text-indigo-600'} />
            <h3 className={`text-sm font-display font-bold ${isNightMode ? 'text-zinc-100' : 'text-slate-900'}`}>
              What-If Scenario Intelligence
            </h3>
          </div>

          <div className={`flex items-center gap-1 p-0.5 rounded-lg border text-[10px] font-mono font-bold ${
            isNightMode ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setWhatIfMode('LIVE')}
              className={`px-2 py-1 rounded-md transition-all ${
                whatIfMode === 'LIVE' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : (isNightMode ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              Live Impact
            </button>
            <button
              onClick={() => setWhatIfMode('PLAYGROUND')}
              className={`px-2 py-1 rounded-md transition-all ${
                whatIfMode === 'PLAYGROUND' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : (isNightMode ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              🔮 Simulate
            </button>
          </div>
        </div>

        {/* MODE A: LIVE DISPATCH IMPACT (Accurate Before vs After) */}
        {whatIfMode === 'LIVE' && (
          <div className="flex flex-col gap-3">
            
            {/* Top Improvement Badge */}
            <div className="flex items-center justify-between text-xs">
              <span className={`text-[11px] ${isNightMode ? 'text-zinc-400' : 'text-slate-600'}`}>
                Cumulative Citywide Risk Mitigation
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                mitigatedPct > 0
                  ? (isNightMode ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                  : (isNightMode ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-slate-100 text-slate-600 border-slate-200')
              }`}>
                {mitigatedPct > 0 ? `+${mitigatedPct}% Risk Averted` : 'Nominal Baseline'}
              </span>
            </div>

            {/* Comparison Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              
              {/* Baseline: Do Nothing (Unmitigated) */}
              <div className={`rounded-xl p-3 border flex flex-col justify-between ${
                isNightMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`uppercase font-bold tracking-wider text-[10px] font-mono ${
                  isNightMode ? 'text-zinc-500' : 'text-slate-500'
                }`}>
                  DO NOTHING BASELINE
                </span>
                <div className="my-1.5">
                  <div className={`font-bold text-xl font-display ${isNightMode ? 'text-zinc-100' : 'text-slate-900'}`}>
                    {unmitigatedTotalRisk}
                  </div>
                  <div className={`text-[10px] font-mono ${isNightMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                    unmitigated risk points
                  </div>
                </div>
                <div className={`text-[10px] font-bold font-mono ${
                  totalShadowsInCity > 0 ? (isNightMode ? 'text-rose-400' : 'text-rose-600') : (isNightMode ? 'text-zinc-400' : 'text-slate-500')
                }`}>
                  {totalShadowsInCity} shadow bottlenecks
                </div>
              </div>

              {/* Current Active Deployed State */}
              <div className={`rounded-xl p-3 border flex flex-col justify-between ${
                isNightMode ? 'bg-indigo-950/40 border-indigo-800/80' : 'bg-indigo-50/70 border-indigo-200'
              }`}>
                <span className={`uppercase font-bold tracking-wider text-[10px] font-mono flex items-center justify-between ${
                  isNightMode ? 'text-indigo-400' : 'text-indigo-700'
                }`}>
                  <span>WITH DISPATCH</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </span>
                <div className="my-1.5">
                  <div className={`font-bold text-xl font-display ${isNightMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {currentUncoveredRisk}
                  </div>
                  <div className={`text-[10px] font-mono ${isNightMode ? 'text-indigo-300' : 'text-indigo-600/80'}`}>
                    remaining unmanaged risk
                  </div>
                </div>
                <div className={`text-[10px] font-bold font-mono ${
                  remainingUncoveredShadows === 0 
                    ? (isNightMode ? 'text-emerald-400' : 'text-emerald-700') 
                    : (isNightMode ? 'text-rose-400' : 'text-rose-600')
                }`}>
                  {remainingUncoveredShadows === 0 ? '✓ 0 Shadows (All Covered)' : `${remainingUncoveredShadows} Shadows remaining`}
                </div>
              </div>

            </div>

            {/* Bottom Status Banner */}
            {remainingUncoveredShadows === 0 && deployedCoveredRisk > 0 ? (
              <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                isNightMode 
                  ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <span className="flex items-center gap-1.5 font-bold text-[11px]">
                  <ShieldCheck size={14} className={isNightMode ? 'text-emerald-400' : 'text-emerald-600'} />
                  All Predicted Risk Shadows Fully Covered
                </span>
                <span className={`text-[10px] font-mono font-extrabold ${isNightMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  -{deployedCoveredRisk} pts averted
                </span>
              </div>
            ) : remainingUncoveredShadows > 0 ? (
              <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                isNightMode 
                  ? 'bg-rose-950/30 border-rose-800/50 text-rose-300' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <span className="flex items-center gap-1.5 font-medium text-[11px]">
                  <AlertTriangle size={14} className={`shrink-0 ${isNightMode ? 'text-rose-400' : 'text-rose-600'}`} />
                  {remainingUncoveredShadows} shadow bottleneck(s) require interceptor units
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isNightMode ? 'bg-rose-900/50 text-rose-300 border border-rose-700/50' : 'bg-rose-100 text-rose-700 border border-rose-200'
                }`}>
                  ACTION REQ
                </span>
              </div>
            ) : null}

          </div>
        )}

        {/* MODE B: INTERACTIVE PLAYGROUND (Slider to simulate adding/removing units) */}
        {whatIfMode === 'PLAYGROUND' && (
          <div className="flex flex-col gap-3 text-xs animate-in fade-in">
            
            <div className="flex items-center justify-between">
              <span className={`text-[11px] flex items-center gap-1 ${isNightMode ? 'text-zinc-400' : 'text-slate-600'}`}>
                <Sliders size={12} className={isNightMode ? 'text-indigo-400' : 'text-indigo-600'} />
                Simulate Total Active Units:
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                isNightMode 
                  ? 'text-indigo-300 bg-indigo-950 border-indigo-800' 
                  : 'text-indigo-700 bg-indigo-50 border-indigo-200'
              }`}>
                {simulatedUnitCount} Units
              </span>
            </div>

            {/* Interactive Slider */}
            <input
              type="range"
              min={1}
              max={6}
              value={simulatedUnitCount}
              onChange={e => setSimulatedUnitCount(Number(e.target.value))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-600 ${
                isNightMode ? 'bg-zinc-800' : 'bg-slate-200'
              }`}
            />

            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className={`p-2.5 rounded-xl border ${
                isNightMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-[9px] uppercase font-mono font-bold block mb-1 ${
                  isNightMode ? 'text-zinc-500' : 'text-slate-500'
                }`}>
                  Averted Exposure
                </span>
                <span className={`text-base font-bold ${isNightMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  -{simCoveredRisk} pts
                </span>
                <span className={`text-[10px] block mt-0.5 ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                  ({simImprovementPct}% Protected)
                </span>
              </div>
              <div className={`p-2.5 rounded-xl border ${
                isNightMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-[9px] uppercase font-mono font-bold block mb-1 ${
                  isNightMode ? 'text-zinc-500' : 'text-slate-500'
                }`}>
                  Residual Uncovered
                </span>
                <span className={`text-base font-bold ${isNightMode ? 'text-zinc-200' : 'text-slate-900'}`}>
                  {simRemainingRisk} pts
                </span>
                <span className={`text-[10px] block mt-0.5 ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                  Estimated residual
                </span>
              </div>
            </div>

            <p className={`text-[10px] italic ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>
              💡 Drag slider to test how allocating additional reserve patrol units from Traffic HQ mitigates downstream shockwave exposure.
            </p>
          </div>
        )}

      </div>

      {/* ── 2. Action Center ──────────────────────────────────────────────── */}
      <div className={`border panel-shadow rounded-[24px] flex flex-col min-h-[300px] overflow-hidden transition-colors ${
        isNightMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Header */}
        <div className={`p-5 border-b shrink-0 flex justify-between items-center ${
          isNightMode ? 'border-zinc-800 bg-zinc-900' : 'border-slate-100 bg-white'
        }`}>
          <h2 className={`text-base font-display font-bold flex items-center gap-2.5 ${
            isNightMode ? 'text-white' : 'text-slate-900'
          }`}>
            <span className="w-2 h-5 rounded-full bg-emerald-500"></span>
            Action Center
          </h2>
          <div className="flex items-center gap-2">
            {onResetDeployments && (
              <button
                onClick={onResetDeployments}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-semibold border transition-colors ${
                  isNightMode
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Recall all deployed police units to Standby HQ"
              >
                <RotateCcw size={12} />
                <span>Recall Units</span>
              </button>
            )}
            <button
              onClick={handleOptimize}
              disabled={optimizing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold border transition-colors disabled:opacity-50 ${
                isNightMode 
                  ? 'bg-indigo-900/50 border-indigo-800 text-indigo-300 hover:bg-indigo-900' 
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              {optimizing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Run Optimizer
            </button>
          </div>
        </div>

        {/* Candidates List */}
        <div className={`p-4 flex flex-col gap-3 overflow-y-auto no-scrollbar ${
          isNightMode ? 'bg-zinc-950/50' : 'bg-slate-50/50'
        }`}>
          {candidates.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center justify-center text-zinc-500">
              <ShieldCheck size={32} className="text-emerald-500 mb-2 opacity-80" />
              <span className={`text-xs font-semibold ${isNightMode ? 'text-zinc-300' : 'text-slate-700'}`}>
                All Sectors Fully Covered
              </span>
              <span className={`text-[11px] mt-0.5 ${isNightMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                No critical dispatch candidates pending.
              </span>
            </div>
          ) : (
            candidates.map((cand) => {
              const targetNode = nodes.find(n => n.location_id === cand.location_id);
              const isCovered = (targetNode?.police_units ?? 0) >= cand.required_units;

              return (
                <div
                  key={cand.location_id}
                  className={`border shadow-sm rounded-[18px] p-4 flex flex-col gap-3 transition-all ${
                    isNightMode 
                      ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className={`font-display font-bold text-sm ${
                      isNightMode ? 'text-zinc-100' : 'text-slate-900'
                    }`}>
                      {cand.location_id.replace(/_/g, ' ')}
                      {cand.risk_shadow && !isCovered && (
                        <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border ${
                          isNightMode ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-rose-100 text-rose-700 border-rose-200'
                        }`}>
                          SHADOW
                        </span>
                      )}
                      {isCovered && (
                        <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border flex-inline items-center gap-1 ${
                          isNightMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}>
                          ✓ COVERED
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                        isCovered
                          ? (isNightMode ? 'text-emerald-400 bg-emerald-950/50 border-emerald-900' : 'text-emerald-700 bg-emerald-50 border-emerald-200')
                          : (isNightMode ? 'text-rose-400 bg-rose-950/50 border-rose-900' : 'text-rose-700 bg-rose-50 border-rose-200')
                      }`}>
                        {(cand.priority <= 1 ? Math.round(cand.priority * 100) : Math.round(cand.priority))}% Pri
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                        isNightMode ? 'text-amber-400 bg-amber-950/50 border-amber-900' : 'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>
                        {cand.eta_minutes}m ETA
                      </span>
                    </div>
                  </div>

                  {/* Stat boxes */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className={`rounded-xl p-2 border ${
                      isNightMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className={`text-[9px] uppercase font-semibold mb-0.5 ${
                        isNightMode ? 'text-zinc-500' : 'text-slate-500'
                      }`}>
                        Forecast
                      </div>
                      <div className={`text-xs font-bold ${
                        isNightMode ? 'text-white' : 'text-slate-900'
                      }`}>
                        {cand.future_risk}%
                      </div>
                    </div>
                    <div className={`rounded-xl p-2 border ${
                      isNightMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className={`text-[9px] uppercase font-semibold mb-0.5 ${
                        isNightMode ? 'text-zinc-500' : 'text-slate-500'
                      }`}>
                        Required
                      </div>
                      <div className={`text-xs font-bold ${
                        isNightMode ? 'text-white' : 'text-slate-900'
                      }`}>
                        {cand.required_units} Unit
                      </div>
                    </div>
                    <div className={`rounded-xl p-2 border ${
                      isCovered
                        ? (isNightMode ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800')
                        : (isNightMode ? 'bg-rose-950/30 border-rose-900/50 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800')
                    }`}>
                      <div className="text-[9px] uppercase font-semibold mb-0.5">Coverage</div>
                      <div className="text-xs font-bold whitespace-nowrap">
                        {targetNode?.police_units ?? 0}/{cand.required_units}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {isCovered ? (
                      <button
                        disabled
                        className={`flex-1 py-1.5 rounded-xl border font-bold text-xs shadow flex items-center justify-center gap-1.5 cursor-default ${
                          isNightMode 
                            ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300' 
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        <ShieldCheck size={13} className={isNightMode ? 'text-emerald-400' : 'text-emerald-600'} />
                        <span>Unit Deployed (Active)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeployClick(cand)}
                        className={`flex-1 py-2 rounded-xl font-bold text-xs shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                          isNightMode
                            ? 'bg-white hover:bg-zinc-200 text-zinc-950'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 shadow-md'
                        }`}
                      >
                        <Zap size={13} className={isNightMode ? 'text-indigo-600' : 'text-white'} />
                        <span>Deploy</span>
                      </button>
                    )}
                    <button
                      onClick={() => setOverrideTarget(cand.location_id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                        isNightMode
                          ? 'border-zinc-800 hover:bg-zinc-800 text-rose-400'
                          : 'border-slate-200 hover:bg-slate-100 text-rose-600'
                      }`}
                    >
                      Override
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Override Modal / Dropdown */}
        {overrideTarget && (
          <div className={`p-4 border-t flex flex-col gap-2.5 ${
            isNightMode ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-slate-50'
          }`}>
            <span className={`text-xs font-bold ${isNightMode ? 'text-white' : 'text-slate-900'}`}>
              Override Dispatch for {overrideTarget.replace(/_/g, ' ')}
            </span>
            <select
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              className={`border rounded-xl px-3 py-1.5 text-xs ${
                isNightMode ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              {OVERRIDE_REASONS.map(r => (
                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleOverrideConfirm}
                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Confirm Override
              </button>
              <button
                onClick={() => setOverrideTarget(null)}
                className={`px-3 py-1.5 rounded-xl text-xs ${
                  isNightMode ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── 3. Audit Log Roster ───────────────────────────────────────────── */}
      {auditLogs.length > 0 && (
        <div className={`border rounded-[20px] p-4.5 panel-shadow ${
          isNightMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          <h4 className={`text-xs font-bold uppercase tracking-wider mb-2.5 font-mono ${
            isNightMode ? 'text-zinc-400' : 'text-slate-500'
          }`}>
            Dispatch Audit Log ({auditLogs.length})
          </h4>
          <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto no-scrollbar text-xs">
            {auditLogs.slice(0, 5).map(log => (
              <div key={log.id} className={`p-2 rounded-lg border flex items-center justify-between ${
                isNightMode ? 'bg-zinc-950/60 border-zinc-800/80' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                    log.action === 'Deploy' 
                      ? (isNightMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-100 text-emerald-700 border-emerald-200')
                      : (isNightMode ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-rose-100 text-rose-700 border-rose-200')
                  }`}>
                    {log.action}
                  </span>
                  <span className={`font-medium ${isNightMode ? 'text-zinc-200' : 'text-slate-800'}`}>
                    {log.location}
                  </span>
                </div>
                <span className={`text-[10px] font-mono ${isNightMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                  {log.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
