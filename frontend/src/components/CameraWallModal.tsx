import { useState } from 'react';
import { X, Video, Sliders, Grid } from 'lucide-react';
import { RiskNode } from '../types';
import { CameraStreamPlayer } from './CameraStreamPlayer';

interface CameraWallModalProps {
  isOpen: boolean;
  nodes: RiskNode[];
  isNightMode?: boolean;
  onClose: () => void;
  onConfigureNode: (node: RiskNode) => void;
  onRiskUpdate?: (locationId: string, vehicleCount: number) => void;
}

export function CameraWallModal({
  isOpen,
  nodes,
  isNightMode = false,
  onClose,
  onConfigureNode,
  onRiskUpdate,
}: CameraWallModalProps) {
  if (!isOpen) return null;

  const [filter, setFilter] = useState<'ALL' | 'ACTIVE_CAM' | 'CRITICAL'>('ALL');

  const filteredNodes = nodes.filter(n => {
    if (filter === 'ACTIVE_CAM') return n.camera?.enabled;
    if (filter === 'CRITICAL') return n.current_risk >= 60;
    return true;
  });

  return (
    // ── Fullscreen overlay that IS the scrollable surface ──────────────────
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 flex flex-col overflow-hidden">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3.5 sm:px-5 py-2.5 sm:py-3 pt-11 sm:pt-3 border-b border-zinc-800 bg-zinc-950/95 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
            <Grid size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-display font-bold text-white truncate">Tactical CCTV Command Wall</h3>
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold shrink-0">
                {filteredNodes.length} FEEDS
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 hidden sm:block">Multi-node synchronized live traffic &amp; surveillance matrix</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Filter pills */}
          <div className="flex items-center bg-zinc-800/80 p-0.5 rounded-xl border border-zinc-700 text-[11px]">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filter === 'ALL' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
            >
              All Nodes ({nodes.length})
            </button>
            <button
              onClick={() => setFilter('ACTIVE_CAM')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filter === 'ACTIVE_CAM' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
            >
              Active Cams ({nodes.filter(n => n.camera?.enabled).length})
            </button>
            <button
              onClick={() => setFilter('CRITICAL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${filter === 'CRITICAL' ? 'bg-rose-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
            >
              High Risk ({nodes.filter(n => n.current_risk >= 60).length})
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-700 shrink-0"
            title="Close CCTV Wall"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Scrollable Camera Grid ─────────────────────────────────────────── */}
      {/* 
        Key layout decisions:
        - flex-1 + overflow-y-auto: the grid scrolls, not the modal 
        - grid-cols-3 with auto-rows that size to the available height
        - Each camera card uses a fixed compact height so 2 rows fit on screen
      */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-min">
          {filteredNodes.map(node => (
            <div
              key={node.location_id}
              className="flex flex-col gap-1.5 bg-zinc-900/80 p-2.5 rounded-2xl border border-zinc-800/80 hover:border-zinc-700 transition-colors"
            >
              {/* Node label row */}
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${node.current_risk > 60 ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`} />
                  <span className="text-[11px] font-bold text-white font-display truncate">{node.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${node.current_risk > 60 ? 'bg-rose-950 text-rose-400 border border-rose-800/60' : 'bg-zinc-800 text-zinc-400'}`}>
                    {node.current_risk}% Risk
                  </span>
                  <button
                    onClick={() => onConfigureNode(node)}
                    className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                    title={`Configure camera for ${node.name}`}
                  >
                    <Sliders size={12} />
                  </button>
                </div>
              </div>

              {/* Camera player — compact mode so controls are not cut off */}
              <CameraStreamPlayer
                node={node}
                compact
                isNightMode={true}
                onConfigureClick={() => onConfigureNode(node)}
                onRiskUpdate={onRiskUpdate}
              />
            </div>
          ))}

          {filteredNodes.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-zinc-500 text-center">
              <Video size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No camera streams match the active filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
