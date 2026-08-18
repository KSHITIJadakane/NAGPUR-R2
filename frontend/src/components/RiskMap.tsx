import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, ScaleControl, useMap, Tooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { Shield, AlertTriangle, Video, Compass, Layers, Car, Plus, Minus, Maximize2, Satellite, Map as MapIcon, Lock, Unlock, X, ArrowDown } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { RiskNode, Edge, Unit } from '../types';

// NAGPUR Center Coordinates (Zero Mile Landmark)
const NAGPUR_CENTER: [number, number] = [21.1380, 79.0820];
const getInitialZoom = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 12.2 : 13);


type MapTileStyle = 'google_streets' | 'google_satellite' | 'tactical_dark' | 'osm_streets';

interface TileConfig {
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
}

const TILE_PRESETS: Record<MapTileStyle, TileConfig> = {
  google_streets: {
    name: 'Google Streets',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps Precision Roads & Landmarks',
    maxZoom: 20
  },
  google_satellite: {
    name: 'Satellite Hybrid',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Satellite Imagery & Roads',
    maxZoom: 20
  },
  tactical_dark: {
    name: 'Tactical Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd']
  },
  osm_streets: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c']
  }
};

// Heatmap Layer Component
const HeatmapLayer = ({ points, isNightMode }: { points: [number, number, number][], isNightMode: boolean }) => {
  const map = useMap();
  useEffect(() => {
    const heat = (L as any).heatLayer(points, {
      radius: 65,
      blur: 40,
      maxZoom: 16,
      max: 1.0,
      gradient: isNightMode 
        ? { 0.2: '#0284c7', 0.4: '#059669', 0.6: '#d97706', 0.8: '#ea580c', 1.0: '#dc2626' }
        : { 0.2: '#3b82f6', 0.4: '#10b981', 0.6: '#f59e0b', 0.8: '#f97316', 1.0: '#ef4444' }
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points, isNightMode]);

  return null;
};

// Map Instance Capturer for zoom controls and view resets
const MapInstanceCapturer = ({ onMapReady }: { onMapReady: (map: L.Map) => void }) => {
  const map = useMap();
  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);
  return null;
};

const getRiskDiscreteColor = (risk: number) => {
  if (risk >= 81) return '#ef4444'; // Critical (Red)
  if (risk >= 61) return '#f97316'; // High (Orange)
  if (risk >= 31) return '#f59e0b'; // Medium (Amber)
  return '#10b981'; // Low (Emerald)
};

const getRiskCategory = (risk: number) => {
  if (risk >= 81) return 'Critical Area';
  if (risk >= 61) return 'High Risk Area';
  if (risk >= 31) return 'Medium Risk Area';
  return 'Low Risk Area';
};

const InterpolatedEdge = ({ source, target, isNightMode }: { source: RiskNode; target: RiskNode; key?: number | string; isNightMode?: boolean }) => {
  const steps = 12; 
  const segments = [];

  for (let i = 0; i < steps; i++) {
    const ratio1 = i / steps;
    const ratio2 = (i + 1) / steps;

    const lat1 = source.lat + (target.lat - source.lat) * ratio1;
    const lng1 = source.lng + (target.lng - source.lng) * ratio1;
    
    const lat2 = source.lat + (target.lat - source.lat) * ratio2;
    const lng2 = source.lng + (target.lng - source.lng) * ratio2;

    const risk1 = source.current_risk + (target.current_risk - source.current_risk) * ratio1;
    const risk2 = source.current_risk + (target.current_risk - source.current_risk) * ratio2;
    const avgRisk = (risk1 + risk2) / 2;

    segments.push({
      positions: [[lat1, lng1], [lat2, lng2]] as [number, number][],
      color: getRiskDiscreteColor(avgRisk),
      riskScore: Math.round(avgRisk),
      category: getRiskCategory(avgRisk)
    });
  }

  return (
    <>
      {segments.map((seg, idx) => (
        <Polyline 
          key={idx}
          positions={seg.positions} 
          color={seg.color}
          weight={4}
          opacity={isNightMode ? 0.6 : 0.8}
          pathOptions={{ 
            lineCap: 'butt', 
          }}
        >
          <Tooltip sticky direction="top" className="bg-zinc-900 text-white border-zinc-800 shadow-lg !p-0 !rounded-lg overflow-hidden">
            <div className="flex flex-col">
              <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: seg.color }}>
                {seg.category}
              </div>
              <div className="px-3 py-2 flex items-center justify-between gap-4 bg-zinc-900">
                <span className="text-zinc-400 text-xs font-medium">Risk Score</span>
                <span className="text-white text-sm font-bold font-mono">{seg.riskScore}</span>
              </div>
            </div>
          </Tooltip>
        </Polyline>
      ))}
    </>
  );
};

const createCustomIcon = (risk: number, isShadow: boolean, hasCamera: boolean, isNightMode: boolean) => {
  let iconClass = 'text-emerald-600 bg-white/95 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.35)]';
  let IconComponent = Video;
  let pulseColor = 'bg-emerald-500';
  
  if (risk >= 81) {
    iconClass = 'text-rose-600 bg-white/95 border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.45)]';
    IconComponent = AlertTriangle;
    pulseColor = 'bg-rose-500';
  } else if (risk >= 61) {
    iconClass = 'text-orange-600 bg-white/95 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.45)]';
    pulseColor = 'bg-orange-500';
  } else if (risk >= 31) {
    iconClass = 'text-amber-600 bg-white/95 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.45)]';
    pulseColor = 'bg-amber-500';
  }
  
  if (isNightMode) {
    iconClass = iconClass
      .replace('bg-white/95', 'bg-zinc-950/95')
      .replace('text-emerald-600', 'text-emerald-400')
      .replace('text-rose-600', 'text-rose-400')
      .replace('text-orange-600', 'text-orange-400')
      .replace('text-amber-600', 'text-amber-400');
  }

  if (isShadow) {
    IconComponent = Shield;
    pulseColor = isNightMode ? 'bg-zinc-600' : 'bg-zinc-400';
    iconClass = isNightMode 
      ? 'text-zinc-400 bg-zinc-900/95 border-zinc-700 shadow-none' 
      : 'text-zinc-500 bg-zinc-100/95 border-zinc-300 shadow-none';
  }

  const html = renderToString(
    <div className="relative group flex items-center justify-center w-12 h-12 cursor-pointer">
      <div className={`absolute inset-1 rounded-full animate-ping opacity-30 ${pulseColor}`}></div>
      <div className={`relative z-10 w-9 h-9 rounded-full border-[2.5px] flex items-center justify-center backdrop-blur-md transition-all duration-300 scale-100 group-hover:scale-115 group-hover:border-[3px] ${iconClass}`}>
        <IconComponent size={16} strokeWidth={2.5} />
      </div>
      {/* Risk Alert Indicator */}
      {risk >= 81 && !isShadow && (
        <div className={`absolute top-1.5 right-1.5 z-20 w-2.5 h-2.5 ${pulseColor} border-2 border-white dark:border-zinc-900 rounded-full animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.8)]`}></div>
      )}
      {/* Live IP Camera Beacon */}
      {hasCamera && (
        <div className="absolute -bottom-1 -right-1 z-20 bg-emerald-600 text-white rounded-full p-0.5 border-2 border-white dark:border-zinc-900 shadow-md flex items-center justify-center">
          <Video size={10} strokeWidth={2.5} />
        </div>
      )}
    </div>
  );

  return L.divIcon({
    html,
    className: 'custom-leaflet-icon',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
};

// ── Icon Cache to Prevent Leaflet DOM Destruction and Tooltip Blinking ────────
const iconCache = new Map<string, L.DivIcon>();

const getCustomIcon = (risk: number, isShadow: boolean, hasCamera: boolean, isNightMode: boolean) => {
  let tier = 'low';
  if (risk >= 81) tier = 'critical';
  else if (risk >= 61) tier = 'high';
  else if (risk >= 31) tier = 'medium';

  const key = `${tier}_${isShadow ? 'shadow' : 'normal'}_${hasCamera ? 'cam' : 'nocam'}_${isNightMode ? 'night' : 'day'}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = createCustomIcon(risk, isShadow, hasCamera, isNightMode);
    iconCache.set(key, icon);
  }
  return icon;
};

const createUnitIcon = () => {
  const html = renderToString(
    <div className="relative group flex items-center justify-center w-14 h-14">
      <div className="absolute inset-1 bg-blue-500 rounded-full animate-ping opacity-40"></div>
      <div className="relative z-10 w-10 h-10 rounded-full border-[2.5px] border-white bg-blue-600 text-white flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.6)] backdrop-blur-sm">
        <Car size={18} strokeWidth={2.5} />
      </div>
    </div>
  );
  return L.divIcon({
    html,
    className: 'custom-leaflet-icon-unit',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
};

interface RiskMapProps {
  nodes: RiskNode[];
  edges: Edge[];
  units?: Unit[];
  isNightMode?: boolean;
  onNodeClick?: (id: string) => void;
  onOpenCctvWall?: () => void;
}

export function RiskMap({ nodes, edges, units = [], isNightMode = false, onNodeClick, onOpenCctvWall }: RiskMapProps) {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapTileStyle>(isNightMode ? 'tactical_dark' : 'google_streets');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleNodeMouseEnter = (locationId: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredNodeId(locationId);
  };

  const handleNodeMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNodeId(null);
    }, 200); // Snappy 200ms grace period requested by user
  };

  const handleTooltipMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleTooltipMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNodeId(null);
    }, 150);
  };

  // Sync default layer if night mode changes and user is on default
  useEffect(() => {
    if (isNightMode && activeLayer === 'google_streets') {
      setActiveLayer('tactical_dark');
    } else if (!isNightMode && activeLayer === 'tactical_dark') {
      setActiveLayer('google_streets');
    }
  }, [isNightMode]);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(NAGPUR_CENTER, getInitialZoom(), { animate: true });
    }
  };

  const createClusterCustomIcon = function (cluster: any) {
    const count = cluster.getChildCount();
    const markers = cluster.getAllChildMarkers();
    let maxRisk = 0;
    
    markers.forEach((marker: any) => {
      const risk = marker.options.riskData || 0;
      if (risk > maxRisk) maxRisk = risk;
    });

    let coreClass = 'border-emerald-500 text-emerald-700 bg-emerald-50 shadow-[0_0_15px_rgba(16,185,129,0.5)]';
    let ringBorder = 'border-emerald-500';
    
    if (maxRisk >= 81) {
      coreClass = 'border-rose-500 text-rose-700 bg-rose-50 shadow-[0_0_15px_rgba(225,29,72,0.5)]';
      ringBorder = 'border-rose-500';
    } else if (maxRisk >= 61) {
      coreClass = 'border-orange-500 text-orange-700 bg-orange-50 shadow-[0_0_15px_rgba(249,115,22,0.5)]';
      ringBorder = 'border-orange-500';
    } else if (maxRisk >= 31) {
      coreClass = 'border-amber-500 text-amber-700 bg-amber-50 shadow-[0_0_15px_rgba(245,158,11,0.5)]';
      ringBorder = 'border-amber-500';
    }

    if (isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite') {
      coreClass = coreClass.replace('bg-rose-50', 'bg-rose-950/90 text-rose-300')
                           .replace('bg-orange-50', 'bg-orange-950/90 text-orange-300')
                           .replace('bg-amber-50', 'bg-amber-950/90 text-amber-300')
                           .replace('bg-emerald-50', 'bg-emerald-950/90 text-emerald-300');
    }

    const html = `<div class="relative flex items-center justify-center w-14 h-14">
      <div class="absolute inset-0 rounded-full border-[2px] border-dashed ${ringBorder} opacity-60 animate-[spin_10s_linear_infinite]"></div>
      <div class="absolute inset-1.5 rounded-full border-[2px] border-dotted ${ringBorder} opacity-40 animate-[spin_15s_linear_infinite_reverse]"></div>
      <div class="relative z-10 w-10 h-10 rounded-full border-[3px] flex items-center justify-center font-bold text-[13px] backdrop-blur-md ${coreClass}">
        ${count}
      </div>
    </div>`;
    
    return L.divIcon({ html, className: 'custom-cluster-icon', iconSize: [56, 56], iconAnchor: [28, 28] });
  };

  const currentTileConfig = TILE_PRESETS[activeLayer];

  return (
    <div className={`w-full h-full relative select-none ${isNightMode ? 'bg-zinc-950' : 'bg-zinc-100'}`}>
      <MapContainer 
        center={NAGPUR_CENTER} 
        zoom={getInitialZoom()} 
        maxZoom={20}
        minZoom={10}
        zoomSnap={0.5}
        zoomDelta={1}
        style={{ height: '100%', width: '100%', zIndex: 0, background: 'transparent' }}
        zoomControl={false}
        scrollWheelZoom={true}
      >
        <TileLayer
          key={activeLayer}
          attribution={currentTileConfig.attribution}
          url={currentTileConfig.url}
          maxZoom={currentTileConfig.maxZoom}
          subdomains={currentTileConfig.subdomains || ['a', 'b', 'c']}
        />
        
        <ScaleControl position="bottomleft" imperial={false} />
        
        <MapInstanceCapturer onMapReady={(map) => { mapInstanceRef.current = map; }} />

        {/* Tactical Edges */}
        {!showHeatmap && edges.map((edge, index) => {
          const sourceNode = nodes.find(n => n.location_id === edge.source);
          const targetNode = nodes.find(n => n.location_id === edge.target);
          if (!sourceNode || !targetNode) return null;
          return <InterpolatedEdge key={`edge-${index}`} source={sourceNode} target={targetNode} isNightMode={isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite'} />;
        })}

        {/* Nodes / Cameras with High-Performance Clean Markers */}
        <MarkerClusterGroup 
          chunkedLoading 
          iconCreateFunction={createClusterCustomIcon}
          maxClusterRadius={35}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
        >
          {!showHeatmap && nodes.map(node => (
            <Marker 
              key={node.location_id} 
              position={[node.lat, node.lng]}
              icon={getCustomIcon(node.current_risk, node.risk_shadow, !!node.camera?.enabled, isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite')}
              riskData={node.current_risk}
              eventHandlers={{
                click: () => onNodeClick && onNodeClick(node.location_id),
                mouseover: () => handleNodeMouseEnter(node.location_id),
                mouseout: () => handleNodeMouseLeave(),
              }}
            >
              {hoveredNodeId === node.location_id && (
                <Tooltip 
                  direction="auto" 
                  offset={[0, -6]}
                  permanent={true}
                  interactive={true}
                  opacity={1}
                  className="!p-0 !border-0 !bg-transparent shadow-2xl custom-node-tooltip"
                >
                  <div 
                    onMouseEnter={handleTooltipMouseEnter}
                    onMouseLeave={handleTooltipMouseLeave}
                    className="relative py-2 px-1 pointer-events-auto"
                  >
                    <div className={`flex flex-col min-w-[210px] rounded-[16px] overflow-hidden border backdrop-blur-md transition-colors ${
                      isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite' 
                        ? 'border-zinc-700 bg-zinc-900/95 shadow-[0_0_25px_rgba(0,0,0,0.8)] text-white' 
                        : 'border-zinc-200 bg-white/95 shadow-2xl text-zinc-900'
                    }`}>
                      <div className={`px-3.5 py-2.5 text-sm font-display font-bold border-b flex items-center justify-between gap-2 ${
                        isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite' 
                          ? 'bg-zinc-800/90 border-zinc-700 text-white' 
                          : 'bg-zinc-100/90 border-zinc-200 text-zinc-900'
                      }`}>
                        <span className="truncate">{node.name}</span>
                        {node.camera?.enabled && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            CAM
                          </span>
                        )}
                      </div>
                      <div className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Risk Score</span>
                        <span className={`text-base font-extrabold font-mono transition-all duration-300 ${
                          node.current_risk >= 81 ? 'text-rose-500' : node.current_risk >= 61 ? 'text-orange-500' : node.current_risk >= 31 ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {node.current_risk}/100
                        </span>
                      </div>
                      <div className={`p-2 border-t ${
                        isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite' 
                          ? 'bg-zinc-950/80 border-zinc-800' 
                          : 'bg-zinc-50 border-zinc-100'
                      }`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNodeClick) onNodeClick(node.location_id);
                            setTimeout(() => {
                              const el = document.getElementById('optical-vision-telemetry') || document.getElementById('location-directory');
                              if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }, 60);
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
                        >
                          <Video size={13} className="shrink-0" />
                          <span>Open AI Optical Vision</span>
                          <ArrowDown size={12} className="shrink-0 animate-bounce" />
                        </button>
                      </div>
                    </div>
                    {/* Multi-directional Hover Bridge extending all around the card to prevent hover loss */}
                    <div className="absolute -inset-4 bg-transparent pointer-events-auto -z-10" />
                  </div>
                </Tooltip>
              )}
            </Marker>
          ))}
        </MarkerClusterGroup>

        {/* Deployed Units */}
        {units.map(unit => (
          <Marker
            key={unit.id}
            position={[unit.lat, unit.lng]}
            icon={createUnitIcon()}
            zIndexOffset={1000}
          >
            <Tooltip direction="top" className="bg-blue-900 text-white border-blue-800 font-bold">
              Unit {unit.id} <br/><span className="text-blue-300 font-normal text-xs">{unit.status}</span>
            </Tooltip>
          </Marker>
        ))}

        {/* Heatmap Layer */}
        {showHeatmap && (
          <HeatmapLayer 
            points={nodes.map(node => [node.lat, node.lng, Math.min(1, node.current_risk / 60)] as [number, number, number])} 
            isNightMode={isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite'}
          />
        )}
      </MapContainer>

      {/* Top Left: Google Maps Precision Layer Switcher */}
      <div className="absolute top-2 left-2 sm:top-5 sm:left-5 flex items-center gap-1.5 z-[400]">
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-md border backdrop-blur-md ${
              isNightMode 
                ? 'bg-zinc-900/90 border-zinc-700 text-white hover:bg-zinc-800' 
                : 'bg-white/90 border-zinc-200 text-zinc-800 hover:bg-zinc-50'
            }`}
            title="Switch Map Tile Source"
          >
            {activeLayer === 'google_satellite' ? (
              <Satellite size={13} className="text-blue-500 shrink-0 sm:hidden" />
            ) : (
              <MapIcon size={13} className="text-emerald-500 shrink-0 sm:hidden" />
            )}
            {activeLayer === 'google_satellite' ? (
              <Satellite size={15} className="text-blue-500 shrink-0 hidden sm:block" />
            ) : (
              <MapIcon size={15} className="text-emerald-500 shrink-0 hidden sm:block" />
            )}
            <span className="truncate max-w-[90px] sm:max-w-none">{currentTileConfig.name}</span>
          </button>

          {showLayerMenu && (
            <div 
              className={`absolute top-full left-0 mt-1.5 w-44 sm:w-48 rounded-xl shadow-2xl border backdrop-blur-md p-1 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 ${
                isNightMode ? 'bg-zinc-900/95 border-zinc-700 text-zinc-200' : 'bg-white/95 border-zinc-200 text-zinc-800'
              }`}
            >
              {(Object.keys(TILE_PRESETS) as MapTileStyle[]).map((key) => {
                const preset = TILE_PRESETS[key];
                const isSelected = activeLayer === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveLayer(key);
                      setShowLayerMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : isNightMode
                        ? 'hover:bg-zinc-800 text-zinc-300'
                        : 'hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <span>{preset.name}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Right Controls & Tactical Zoom Buttons */}
      <div className="absolute top-2 right-2 sm:top-5 sm:right-5 flex flex-col gap-1.5 sm:gap-2 z-[400]">
        {/* Compass (hidden on mobile to save space) */}
        <div className={`backdrop-blur-md border p-2 rounded-full shadow-md hidden sm:flex flex-col items-center justify-center w-10 h-10 ${isNightMode ? 'bg-zinc-900/90 border-zinc-700' : 'bg-white/90 border-zinc-200'}`}>
          <Compass size={20} className={isNightMode ? 'text-zinc-400' : 'text-zinc-600'} />
          <span className={`text-[10px] font-bold mt-[-2px] ${isNightMode ? 'text-zinc-400' : 'text-zinc-600'}`}>N</span>
        </div>

        {/* Dedicated Precision Zoom In / Out Buttons */}
        <div className={`flex flex-col rounded-xl sm:rounded-2xl border shadow-md backdrop-blur-md overflow-hidden ${isNightMode ? 'bg-zinc-900/90 border-zinc-700' : 'bg-white/90 border-zinc-200'}`}>
          <button 
            onClick={handleZoomIn}
            className={`w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center transition-colors border-b ${isNightMode ? 'border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:text-white' : 'border-zinc-100 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'}`}
            title="Zoom In"
          >
            <Plus size={14} className="sm:hidden" />
            <Plus size={18} className="hidden sm:block" />
          </button>
          <button 
            onClick={handleZoomOut}
            className={`w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center transition-colors ${isNightMode ? 'text-zinc-200 hover:bg-zinc-800 hover:text-white' : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'}`}
            title="Zoom Out"
          >
            <Minus size={14} className="sm:hidden" />
            <Minus size={18} className="hidden sm:block" />
          </button>
        </div>

        {/* Reset / Fit to Nagpur Overview */}
        <button 
          onClick={handleResetView}
          className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full shadow-md flex items-center justify-center transition-colors border backdrop-blur-md ${isNightMode ? 'bg-zinc-900/90 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white' : 'bg-white/90 border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
          title="Reset to Nagpur Central View"
        >
          <Maximize2 size={12} className="sm:hidden" />
          <Maximize2 size={16} className="hidden sm:block" />
        </button>

        {/* Heatmap Toggle */}
        <button 
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full shadow-md flex items-center justify-center transition-colors border ${showHeatmap ? (isNightMode ? 'bg-white text-zinc-900 border-white' : 'bg-zinc-900 border-zinc-900 text-white') : (isNightMode ? 'bg-zinc-900/90 backdrop-blur-md border-zinc-700 text-zinc-400 hover:bg-zinc-800' : 'bg-white/90 backdrop-blur-md border-zinc-200 text-zinc-600 hover:bg-zinc-50')}`}
          title="Toggle Heatmap Density"
        >
          <Layers size={13} className="sm:hidden" />
          <Layers size={18} className="hidden sm:block" />
        </button>
      </div>

      {/* Bottom Right Legend (Collapsible / Toggleable for Mobile & Desktop) */}
      <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 z-[400] flex flex-col items-end">
        {!isLegendOpen ? (
          <button
            onClick={() => setIsLegendOpen(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg border backdrop-blur-md flex items-center gap-1.5 transition-all hover:scale-105 ${
              isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite'
                ? 'bg-zinc-900/90 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                : 'bg-white/95 border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-md'
            }`}
            title="Show Map Risk Legend"
          >
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <span>Legend</span>
          </button>
        ) : (
          <div className={`backdrop-blur-md border p-3 sm:p-4 rounded-[16px] shadow-2xl text-xs w-[195px] sm:w-[215px] animate-in fade-in zoom-in-95 duration-150 ${
            isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite'
              ? 'bg-zinc-900/95 border-zinc-800 text-zinc-300'
              : 'bg-white/95 border-zinc-200 text-zinc-700'
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className={`font-bold ${isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite' ? 'text-white' : 'text-zinc-900'}`}>
                Risk Legend
              </h4>
              <button
                onClick={() => setIsLegendOpen(false)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
                title="Hide Legend"
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5 text-[11px] sm:text-xs">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></div> Critical (81-100)</div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0"></div> High (61-80)</div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></div> Medium (31-60)</div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></div> Low (0-30)</div>
            </div>
            <div className={`mt-2.5 pt-2 border-t flex flex-col gap-1.5 text-[11px] sm:text-xs ${
              isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite' ? 'border-zinc-800' : 'border-zinc-200'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center border ${
                  isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite' ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-300 bg-zinc-100'
                }`}>
                  <Shield size={5} className={isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite' ? 'text-zinc-400' : 'text-zinc-500'} />
                </div>
                <span>Unmanned Shadow</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center border ${
                  isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite' ? 'border-blue-700 bg-blue-900' : 'border-blue-400 bg-blue-600'
                }`}>
                  <Car size={5} className={isNightMode || activeLayer === 'tactical_dark' || activeLayer === 'google_satellite' ? 'text-blue-200' : 'text-white'} />
                </div>
                <span>Deployed Unit</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
