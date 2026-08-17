import { RiskNode, XaiExplanation } from '../types';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  BrainCircuit,
  Video,
  Sliders,
  Plus,
  Activity,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { CameraStreamPlayer } from './CameraStreamPlayer';

interface RiskOverviewProps {
  nodes: RiskNode[];
  onNodeClick: (id: string | null) => void;
  selectedNodeId: string | null;
  isNightMode?: boolean;
  explanations?: XaiExplanation[];
  onConfigureCamera?: (node: RiskNode) => void;
  onRiskUpdate?: (locationId: string, vehicleCount: number) => void;
}

// ── Custom Tooltip for Comparative Forecast Chart ─────────────────────────────
function CustomForecastTooltip({ active, payload, label, isNightMode }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  const isForecastPoint = data?.type === 'projected' || data?.type === 'current';

  return (
    <div className={`border rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono min-w-[170px] ${
      isNightMode ? 'bg-zinc-950/95 border-zinc-700/80 text-zinc-200' : 'bg-white/95 border-slate-200 text-slate-800 shadow-xl'
    }`}>
      <div className={`flex items-center justify-between border-b pb-1.5 mb-2 ${isNightMode ? 'border-zinc-800' : 'border-slate-100'}`}>
        <span className={`text-[11px] font-bold flex items-center gap-1 ${isNightMode ? 'text-zinc-300' : 'text-slate-700'}`}>
          <Clock size={11} className={isNightMode ? 'text-indigo-400' : 'text-indigo-600'} />
          {label === 'NOW' ? 'Current Time (NOW)' : `T ${label}`}
        </span>
        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
          data?.type === 'projected' 
            ? (isNightMode ? 'bg-rose-950 text-rose-300 border border-rose-800/60' : 'bg-rose-100 text-rose-700 border border-rose-200')
            : (isNightMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' : 'bg-emerald-100 text-emerald-700 border border-emerald-200')
        }`}>
          {data?.type === 'projected' ? 'M2 FORECAST' : 'LIVE OBSERVED'}
        </span>
      </div>

      {data?.actual !== null && data?.actual !== undefined && (
        <div className={`flex items-center justify-between py-0.5 ${isNightMode ? 'text-zinc-300' : 'text-slate-700'}`}>
          <span className={`flex items-center gap-1.5 ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            Live Risk:
          </span>
          <span className={`font-bold ${isNightMode ? 'text-cyan-300' : 'text-cyan-600'}`}>{data.actual}%</span>
        </div>
      )}

      {data?.forecast !== null && data?.forecast !== undefined && (
        <div className={`flex items-center justify-between py-0.5 ${isNightMode ? 'text-zinc-300' : 'text-slate-700'}`}>
          <span className={`flex items-center gap-1.5 ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Forecast (+15m):
          </span>
          <span className={`font-bold ${isNightMode ? 'text-rose-400' : 'text-rose-600'}`}>{data.forecast}%</span>
        </div>
      )}

      {isForecastPoint && (
        <div className={`mt-1.5 pt-1.5 border-t text-[10px] flex justify-between ${isNightMode ? 'border-zinc-800/80 text-zinc-500' : 'border-slate-100 text-slate-400'}`}>
          <span>Confidence:</span>
          <span className={`font-bold ${isNightMode ? 'text-zinc-300' : 'text-slate-700'}`}>92%</span>
        </div>
      )}
    </div>
  );
}

export function RiskOverview({
  nodes,
  onNodeClick,
  selectedNodeId,
  isNightMode = false,
  explanations = [],
  onConfigureCamera,
  onRiskUpdate,
}: RiskOverviewProps) {
  const selectedNode = nodes.find(n => n.location_id === selectedNodeId);
  const selectedExplanation = explanations.find(e => e.location_id === selectedNodeId);
  const shadowNodes = nodes.filter(n => n.risk_shadow && n.police_units === 0);
  const propagationNodes = nodes.filter(n => n.propagation_sources.length > 0);

  // ── Build Comparative Real-Time vs 15-Min Forecast Dataset ──────────────────
  const getComparativeForecastData = (history: number[], currentRisk: number, futureRisk: number) => {
    // 5 historical points prior to NOW: -25m, -20m, -15m, -10m, -5m
    const hist = (history && history.length >= 5)
      ? history.slice(-5)
      : [Math.max(10, currentRisk - 6), Math.max(12, currentRisk - 4), Math.max(10, currentRisk - 8), Math.max(15, currentRisk - 3), Math.max(12, currentRisk - 5)];

    const delta = futureRisk - currentRisk;
    const f5 = Math.round(currentRisk + delta * 0.38);
    const f10 = Math.round(currentRisk + delta * 0.74);
    const f15 = futureRisk;

    return [
      { time: '-25m', actual: hist[0] ?? currentRisk, forecast: null, type: 'historical' },
      { time: '-20m', actual: hist[1] ?? currentRisk, forecast: null, type: 'historical' },
      { time: '-15m', actual: hist[2] ?? currentRisk, forecast: null, type: 'historical' },
      { time: '-10m', actual: hist[3] ?? currentRisk, forecast: null, type: 'historical' },
      { time: '-5m',  actual: hist[4] ?? currentRisk, forecast: null, type: 'historical' },
      { time: 'NOW',  actual: currentRisk,            forecast: currentRisk, type: 'current' },
      { time: '+5m',  actual: null,                   forecast: f5,          type: 'projected' },
      { time: '+10m', actual: null,                   forecast: f10,         type: 'projected' },
      { time: '+15m', actual: null,                   forecast: f15,         type: 'projected' },
    ];
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* ── Active Alerts & Propagation Summary ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Active Alerts */}
        <div className={`border panel-shadow rounded-[24px] p-6 transition-colors ${
          isNightMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-base font-display font-bold ${isNightMode ? 'text-white' : 'text-slate-900'}`}>
              Active Alerts
            </h3>
            <span className={`text-xs font-mono ${isNightMode ? 'text-zinc-500' : 'text-slate-500'}`}>
              {shadowNodes.length} Unmanned Shadows
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {shadowNodes.map(node => (
              <div
                key={node.location_id}
                onClick={() => onNodeClick(node.location_id)}
                className={`text-sm rounded-[14px] p-4 flex gap-3 items-center border cursor-pointer transition-all ${
                  isNightMode 
                    ? 'bg-rose-950/30 border-rose-900/50 text-rose-300 hover:border-rose-500/60' 
                    : 'bg-rose-50 border-rose-200 text-rose-900 hover:border-rose-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isNightMode ? 'bg-rose-900/50 text-rose-400' : 'bg-rose-100 text-rose-600'
                }`}>
                  <AlertTriangle size={15} />
                </div>
                <div className="flex-1">
                  <strong className={`block ${isNightMode ? 'text-rose-100' : 'text-rose-950 font-bold'}`}>
                    {node.name}
                  </strong>
                  <span className={`text-xs ${isNightMode ? 'text-rose-400' : 'text-rose-700'}`}>
                    Unmanned zone with {node.future_risk}% projected risk in 15m.
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                  isNightMode ? 'bg-rose-900/60 border-rose-700/60 text-rose-200' : 'bg-rose-100 border-rose-300 text-rose-800'
                }`}>
                  SHADOW
                </span>
              </div>
            ))}
            {shadowNodes.length === 0 && (
              <span className={`text-sm p-4 rounded-xl flex items-center gap-2 ${
                isNightMode ? 'text-zinc-500 bg-zinc-800/50' : 'text-slate-600 bg-slate-50 border border-slate-200'
              }`}>
                <ShieldCheck size={16} className="text-emerald-500" />
                All high-risk sectors currently have active police unit coverage.
              </span>
            )}
          </div>
        </div>

        {/* Propagation Corridors */}
        <div className={`border panel-shadow rounded-[24px] p-6 transition-colors ${
          isNightMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-base font-display font-bold ${isNightMode ? 'text-white' : 'text-slate-900'}`}>
              Propagation Paths
            </h3>
            <span className={`text-xs font-mono ${isNightMode ? 'text-zinc-500' : 'text-slate-500'}`}>
              {propagationNodes.length} Active Corridors
            </span>
          </div>
          <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto no-scrollbar">
            {propagationNodes.map(node => (
              <div
                key={node.location_id}
                onClick={() => onNodeClick(node.location_id)}
                className={`text-sm rounded-[14px] p-3.5 border flex items-center justify-between cursor-pointer transition-all ${
                  isNightMode 
                    ? 'bg-amber-950/20 border-amber-900/40 text-amber-300 hover:border-amber-500/60' 
                    : 'bg-amber-50/70 border-amber-200 text-amber-900 hover:border-amber-300'
                }`}
              >
                <div>
                  <span className={`font-semibold block text-xs mb-1 ${isNightMode ? 'text-amber-100' : 'text-amber-950'}`}>
                    {node.propagation_sources.join(', ')} <span className="text-amber-500 mx-1">→</span> {node.name}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    isNightMode ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    Shockwave Pressure: {node.propagation_pressure}
                  </span>
                </div>
                <ArrowUpRight size={15} className={isNightMode ? 'text-amber-400/70' : 'text-amber-600'} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Selected Node Deep Dive Analysis Section ───────────────────────── */}
      {selectedNode && (
        <div className={`border rounded-[28px] p-6 sm:p-8 shadow-xl relative overflow-hidden animate-in fade-in duration-200 transition-colors ${
          isNightMode 
            ? 'bg-zinc-900 border-zinc-800 text-zinc-50' 
            : 'bg-white border-slate-200 text-slate-900'
        }`}>
          
          {/* Header Row */}
          <div className={`flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b ${
            isNightMode ? 'border-zinc-800' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${selectedNode.current_risk > 60 ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`} />
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className={`text-xl font-display font-bold ${isNightMode ? 'text-white' : 'text-slate-900'}`}>
                    {selectedNode.name}
                  </h3>
                  <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                    isNightMode ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {selectedNode.location_id}
                  </span>
                  {selectedNode.risk_shadow && (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full animate-pulse border ${
                      isNightMode ? 'bg-rose-950 text-rose-300 border-rose-700' : 'bg-rose-100 text-rose-700 border-rose-200'
                    }`}>
                      RISK SHADOW
                    </span>
                  )}
                </div>
                <span className={`text-xs ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                  {selectedNode.lat.toFixed(4)}°N, {selectedNode.lng.toFixed(4)}°E • Tactical Sector
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {onConfigureCamera && (
                <button
                  onClick={() => onConfigureCamera(selectedNode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                    isNightMode 
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700/60' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <Sliders size={13} />
                  <span>{selectedNode.camera ? 'Edit Camera' : '+ Add Camera'}</span>
                </button>
              )}
              <button
                onClick={() => onNodeClick(null)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isNightMode ? 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700' : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="Close Analysis View"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Camera Feed Player Component */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Video size={16} className={isNightMode ? 'text-indigo-400' : 'text-indigo-600'} />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isNightMode ? 'text-zinc-300' : 'text-slate-700'}`}>
                  Live Optical &amp; Vision Telemetry
                </h4>
              </div>
              <span className={`text-xs font-mono ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                {selectedNode.camera?.name ?? 'Camera Stream'}
              </span>
            </div>

            {selectedNode.camera ? (
              <CameraStreamPlayer
                node={selectedNode}
                isNightMode={isNightMode}
                onConfigureClick={() => onConfigureCamera && onConfigureCamera(selectedNode)}
                onRiskUpdate={onRiskUpdate}
              />
            ) : (
              <div className={`border border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center ${
                isNightMode ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-300 bg-slate-50'
              }`}>
                <Video size={24} className={isNightMode ? 'text-zinc-500 mb-2' : 'text-slate-400 mb-2'} />
                <h5 className={`text-sm font-semibold ${isNightMode ? 'text-white' : 'text-slate-900'}`}>
                  No IP Camera Connected to {selectedNode.name}
                </h5>
                <p className={`text-xs max-w-[340px] mt-1 mb-3 ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                  Attach a stream or traffic preset to enable live AI bounding box vision.
                </p>
                {onConfigureCamera && (
                  <button
                    onClick={() => onConfigureCamera(selectedNode)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus size={13} />
                    <span>Attach Live Camera</span>
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* ── Real-Time vs. 15-Min Forecast Matrix + XAI Reasoning ─────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Comparative Graph & Metric Badges (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              {/* Comparative Chart Container */}
              <div className={`border rounded-2xl p-4.5 flex flex-col gap-3 ${
                isNightMode ? 'bg-zinc-950/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      isNightMode ? 'text-zinc-200' : 'text-slate-800'
                    }`}>
                      <Activity size={14} className={isNightMode ? 'text-cyan-400' : 'text-cyan-600'} />
                      Comparative Risk Trajectory: Real-Time vs. +15m Forecast
                    </h4>
                    <p className={`text-[10px] ${isNightMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                      Observed camera history vs. graph propagation shockwave
                    </p>
                  </div>

                  {/* Legend Pills */}
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                      isNightMode ? 'text-cyan-400 bg-cyan-950/50 border-cyan-800/60' : 'text-cyan-700 bg-cyan-50 border-cyan-200'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                      Live Observed
                    </span>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                      isNightMode ? 'text-rose-400 bg-rose-950/50 border-rose-800/60' : 'text-rose-700 bg-rose-50 border-rose-200'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      +15m Forecast
                    </span>
                  </div>
                </div>

                {/* High-Fidelity Comparative Recharts Area */}
                <div className="h-44 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={getComparativeForecastData(selectedNode.history, selectedNode.current_risk, selectedNode.future_risk)}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <defs>
                        {/* Cyan Gradient for Real-time actual history */}
                        <linearGradient id="gradientActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                        {/* Rose Gradient for Forecast Projection */}
                        <linearGradient id="gradientForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke={isNightMode ? '#27272a' : '#e2e8f0'} vertical={false} />
                      <XAxis
                        dataKey="time"
                        stroke={isNightMode ? '#71717a' : '#64748b'}
                        fontSize={10}
                        fontFamily="monospace"
                        tickLine={false}
                        axisLine={{ stroke: isNightMode ? '#3f3f46' : '#cbd5e1' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke={isNightMode ? '#71717a' : '#64748b'}
                        fontSize={10}
                        fontFamily="monospace"
                        tickLine={false}
                        axisLine={false}
                        ticks={[0, 25, 50, 75, 100]}
                      />
                      
                      {/* Critical Threshold Line */}
                      <ReferenceLine
                        y={70}
                        stroke="#f43f5e"
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                        label={{
                          value: 'Critical Threshold (70%)',
                          fill: '#f43f5e',
                          fontSize: 9,
                          position: 'insideTopRight',
                        }}
                      />

                      <Tooltip content={<CustomForecastTooltip isNightMode={isNightMode} />} />

                      {/* 1. Historical Actual Line (Cyan) */}
                      <Area
                        type="monotone"
                        dataKey="actual"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        fill="url(#gradientActual)"
                        connectNulls={false}
                        isAnimationActive={true}
                        dot={{ r: 3, fill: '#06b6d4', stroke: '#0891b2', strokeWidth: 1 }}
                      />

                      {/* 2. Forecast Projected Line (Rose - Dashed) */}
                      <Area
                        type="monotone"
                        dataKey="forecast"
                        stroke="#f43f5e"
                        strokeWidth={2.5}
                        strokeDasharray="5 5"
                        fill="url(#gradientForecast)"
                        connectNulls={false}
                        isAnimationActive={true}
                        dot={{ r: 4, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 1.5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* 4 Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                
                {/* 1. Current Risk */}
                <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                  isNightMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] uppercase font-bold font-mono ${
                    isNightMode ? 'text-zinc-400' : 'text-slate-500'
                  }`}>
                    Current Live
                  </span>
                  <div className="flex items-baseline gap-1 my-1">
                    <span className={`text-xl font-display font-bold ${
                      isNightMode ? 'text-white' : 'text-slate-900'
                    }`}>
                      {selectedNode.current_risk}
                    </span>
                    <span className={`text-xs ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>%</span>
                  </div>
                  <span className={`text-[10px] font-bold ${
                    selectedNode.current_risk > 60 
                      ? (isNightMode ? 'text-rose-400' : 'text-rose-600') 
                      : (isNightMode ? 'text-emerald-400' : 'text-emerald-600')
                  }`}>
                    {selectedNode.current_risk > 60 ? 'HIGH SECTOR' : 'NOMINAL FLOW'}
                  </span>
                </div>

                {/* 2. 15-Min Forecast */}
                <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                  isNightMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] uppercase font-bold font-mono ${
                    isNightMode ? 'text-zinc-400' : 'text-slate-500'
                  }`}>
                    +15m Forecast
                  </span>
                  <div className="flex items-baseline gap-1 my-1">
                    <span className={`text-xl font-display font-bold ${
                      selectedNode.future_risk > 70 
                        ? (isNightMode ? 'text-rose-400' : 'text-rose-600') 
                        : (isNightMode ? 'text-amber-400' : 'text-amber-600')
                    }`}>
                      {selectedNode.future_risk}
                    </span>
                    <span className={`text-xs ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>%</span>
                  </div>
                  <span className={`text-[10px] font-mono ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                    M2 Propagation
                  </span>
                </div>

                {/* 3. Risk Delta Velocity */}
                <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                  isNightMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] uppercase font-bold font-mono ${
                    isNightMode ? 'text-zinc-400' : 'text-slate-500'
                  }`}>
                    Risk Velocity
                  </span>
                  <div className="flex items-center gap-1 my-1">
                    {selectedNode.future_risk >= selectedNode.current_risk ? (
                      <ArrowUpRight size={18} className={isNightMode ? 'text-rose-400' : 'text-rose-600'} />
                    ) : (
                      <ArrowDownRight size={18} className={isNightMode ? 'text-emerald-400' : 'text-emerald-600'} />
                    )}
                    <span className={`text-base font-display font-bold ${
                      selectedNode.future_risk >= selectedNode.current_risk 
                        ? (isNightMode ? 'text-rose-400' : 'text-rose-600') 
                        : (isNightMode ? 'text-emerald-400' : 'text-emerald-600')
                    }`}>
                      {selectedNode.future_risk >= selectedNode.current_risk ? `+${(selectedNode.future_risk - selectedNode.current_risk).toFixed(0)}%` : `${(selectedNode.future_risk - selectedNode.current_risk).toFixed(0)}%`}
                    </span>
                  </div>
                  <span className={`text-[10px] ${isNightMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                    {selectedNode.future_risk > selectedNode.current_risk ? 'Shockwave Rising' : 'Stabilizing'}
                  </span>
                </div>

                {/* 4. Police Coverage Status */}
                <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                  isNightMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] uppercase font-bold font-mono ${
                    isNightMode ? 'text-zinc-400' : 'text-slate-500'
                  }`}>
                    Police Units
                  </span>
                  <div className="flex items-baseline gap-1 my-1">
                    <span className={`text-xl font-display font-bold ${
                      selectedNode.police_units < selectedNode.required_units 
                        ? (isNightMode ? 'text-rose-400' : 'text-rose-600') 
                        : (isNightMode ? 'text-emerald-400' : 'text-emerald-600')
                    }`}>
                      {selectedNode.police_units}
                    </span>
                    <span className={`text-xs ${isNightMode ? 'text-zinc-500' : 'text-slate-500'}`}>
                      / {selectedNode.required_units} Req
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold ${
                    selectedNode.police_units < selectedNode.required_units 
                      ? (isNightMode ? 'text-rose-400' : 'text-rose-600') 
                      : (isNightMode ? 'text-emerald-400' : 'text-emerald-600')
                  }`}>
                    {selectedNode.police_units < selectedNode.required_units ? 'UNMANNED GAP' : 'COVERED'}
                  </span>
                </div>

              </div>

              {/* Upstream Pressure Attribution Bar */}
              {selectedNode.propagation_sources && selectedNode.propagation_sources.length > 0 && (
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  isNightMode 
                    ? 'bg-amber-950/20 border-amber-800/40' 
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className={isNightMode ? 'text-amber-400 shrink-0' : 'text-amber-600 shrink-0'} />
                    <span className={isNightMode ? 'text-amber-200' : 'text-amber-900 font-medium'}>
                      Upstream Shockwave: <strong>{selectedNode.propagation_sources.join(', ')}</strong> ({selectedNode.propagation_pressure} pressure units)
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono uppercase font-bold ${
                    isNightMode ? 'text-amber-400/80' : 'text-amber-700'
                  }`}>
                    Inbound Surge
                  </span>
                </div>
              )}

            </div>

            {/* Right Column: AI Explanation & Decision Logic (5 cols) */}
            <div className="lg:col-span-5 flex flex-col">
              {selectedExplanation ? (
                <div className={`border rounded-2xl p-5 flex flex-col h-full justify-between gap-4 ${
                  isNightMode ? 'bg-zinc-950/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  
                  {/* Top XAI Title */}
                  <div className={`flex items-center justify-between pb-3 border-b ${
                    isNightMode ? 'border-zinc-800/80' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <BrainCircuit size={16} className={isNightMode ? 'text-indigo-400' : 'text-indigo-600'} />
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${
                        isNightMode ? 'text-indigo-300' : 'text-indigo-700'
                      }`}>
                        XAI Decision Intelligence
                      </h4>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                      isNightMode 
                        ? 'bg-indigo-950 text-indigo-300 border-indigo-800/60' 
                        : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                    }`}>
                      {selectedExplanation.urgency}
                    </span>
                  </div>
                  
                  {/* Evidence & Reasoning */}
                  <div className="flex flex-col gap-3 text-xs">
                    <div>
                      <h5 className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 font-mono ${
                        isNightMode ? 'text-zinc-500' : 'text-slate-500'
                      }`}>
                        Telemetry Evidence
                      </h5>
                      <ul className="space-y-1.5">
                        {selectedExplanation.evidence.map((ev, i) => (
                          <li key={i} className={`flex items-start gap-2 text-[11px] leading-relaxed ${
                            isNightMode ? 'text-zinc-300' : 'text-slate-700'
                          }`}>
                            <span className={`font-bold mt-0.5 ${isNightMode ? 'text-indigo-400' : 'text-indigo-600'}`}>•</span>
                            <span>{ev}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h5 className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 font-mono ${
                        isNightMode ? 'text-zinc-500' : 'text-slate-500'
                      }`}>
                        Tactical Reasoning
                      </h5>
                      <ul className="space-y-1.5">
                        {selectedExplanation.reason.map((res, i) => (
                          <li key={i} className={`flex items-start gap-2 text-[11px] leading-relaxed ${
                            isNightMode ? 'text-zinc-300' : 'text-slate-700'
                          }`}>
                            <span className={`font-bold mt-0.5 ${isNightMode ? 'text-amber-400' : 'text-amber-600'}`}>•</span>
                            <span>{res}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommended Action Callout */}
                  <div className={`p-3.5 rounded-xl border text-xs font-medium ${
                    selectedExplanation.urgency.includes('Immediate')
                      ? (isNightMode ? 'bg-rose-950/40 border-rose-900/70 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-800')
                      : (isNightMode ? 'bg-indigo-950/40 border-indigo-900/70 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-800')
                  }`}>
                    <div className="text-[10px] uppercase font-bold tracking-wider mb-1 opacity-75 font-mono flex items-center gap-1">
                      <ShieldAlert size={12} />
                      <span>Recommended Action</span>
                    </div>
                    <p className="text-[11px] leading-relaxed font-semibold">{selectedExplanation.action}</p>
                  </div>

                </div>
              ) : (
                <div className={`border rounded-2xl p-6 flex flex-col items-center justify-center text-center h-full ${
                  isNightMode ? 'bg-zinc-950/60 border-zinc-800 text-zinc-500' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  <BrainCircuit size={28} className="mb-2 opacity-30" />
                  <p className="text-xs">No XAI explanation generated for this sector.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── Location Directory Table ────────────────────────────────────────── */}
      <div className={`border panel-shadow rounded-[24px] overflow-hidden flex flex-col transition-colors ${
        isNightMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
      }`}>
        <div className={`p-6 border-b flex justify-between items-center ${
          isNightMode ? 'border-zinc-800' : 'border-slate-100'
        }`}>
          <h3 className={`text-lg font-display font-bold ${isNightMode ? 'text-white' : 'text-slate-900'}`}>
            Location Directory
          </h3>
          <span className={`text-xs font-mono ${isNightMode ? 'text-zinc-500' : 'text-slate-500'}`}>
            Click any sector to inspect telemetry
          </span>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm text-left">
            <thead className={`text-xs font-medium ${isNightMode ? 'text-zinc-500' : 'text-slate-500'}`}>
              <tr>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium text-center">IP Camera</th>
                <th className="px-4 py-3 font-medium text-center">Live Current</th>
                <th className="px-4 py-3 font-medium text-center">Future (+15m)</th>
                <th className="px-4 py-3 font-medium text-center">Coverage</th>
                <th className="px-4 py-3 font-medium text-center">Trend</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isNightMode ? 'divide-zinc-800' : 'divide-slate-100'}`}>
              {nodes.map(node => (
                <tr 
                  key={node.location_id} 
                  onClick={() => onNodeClick(node.location_id)}
                  className={`cursor-pointer transition-colors group ${
                    selectedNodeId === node.location_id
                      ? (isNightMode ? 'bg-zinc-800/60 border-l-4 border-indigo-500' : 'bg-indigo-50/60 border-l-4 border-indigo-600')
                      : (isNightMode ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50')
                  }`}
                >
                  <td className="px-4 py-4">
                    <div className={`font-semibold ${isNightMode ? 'text-zinc-100' : 'text-slate-900'}`}>
                      {node.name}
                    </div>
                    {node.risk_shadow && (
                      <div className="text-[11px] text-rose-600 mt-0.5 font-bold">
                        ⚠️ Risk Shadow Active
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {node.camera?.enabled ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono border ${
                        isNightMode ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Optical
                      </span>
                    ) : (
                      <span className={`text-xs ${isNightMode ? 'text-zinc-500' : 'text-slate-400'}`}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center font-mono font-bold">
                    <span className={node.current_risk > 60 ? (isNightMode ? 'text-rose-400' : 'text-rose-600') : (isNightMode ? 'text-emerald-400' : 'text-emerald-600')}>
                      {node.current_risk}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center font-mono font-bold">
                    <span className={node.future_risk > 70 ? (isNightMode ? 'text-rose-400' : 'text-rose-600') : (isNightMode ? 'text-amber-400' : 'text-amber-600')}>
                      {node.future_risk}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    <span className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold font-mono border ${
                      node.police_units < node.required_units
                        ? (isNightMode ? 'bg-rose-950/50 text-rose-300 border-rose-800/60' : 'bg-rose-50 text-rose-700 border-rose-200')
                        : (isNightMode ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                    }`}>
                      {node.police_units} / {node.required_units}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold font-mono ${
                      node.trend === 'UP' 
                        ? (isNightMode ? 'text-rose-400' : 'text-rose-600') 
                        : node.trend === 'DOWN' 
                        ? (isNightMode ? 'text-emerald-400' : 'text-emerald-600') 
                        : (isNightMode ? 'text-zinc-400' : 'text-slate-500')
                    }`}>
                      {node.trend === 'UP' ? '▲ RISING' : node.trend === 'DOWN' ? '▼ DROPPING' : '― STABLE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
