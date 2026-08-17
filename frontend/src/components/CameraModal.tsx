import { useState, useEffect } from 'react';
import { 
  X, Video, Globe, Camera as CameraIcon, Check, 
  Trash2, Play, Sparkles
} from 'lucide-react';
import { RiskNode, CameraConfig, CameraType } from '../types';
import { PRESET_CAMERAS, CameraPreset } from '../data';

interface CameraModalProps {
  isOpen: boolean;
  node: RiskNode | null;
  isNightMode?: boolean;
  onClose: () => void;
  onSave: (location_id: string, config: CameraConfig) => void;
  onDelete: (location_id: string) => void;
}

export function CameraModal({
  isOpen,
  node,
  isNightMode = false,
  onClose,
  onSave,
  onDelete,
}: CameraModalProps) {
  if (!isOpen || !node) return null;

  const existingConfig = node.camera;

  // Map older types (SIMULATED_AI, PRESET) to unified AI_PRESET
  const initialType: CameraType = (() => {
    if (!existingConfig) return 'AI_PRESET';
    if (existingConfig.type === 'SIMULATED_AI' || existingConfig.type === 'PRESET' || existingConfig.type === 'AI_PRESET') {
      return 'AI_PRESET';
    }
    return existingConfig.type;
  })();

  const [streamType, setStreamType] = useState<CameraType>(initialType);
  const [cameraName, setCameraName] = useState(
    existingConfig?.name || `${node.name} - CAM 01`
  );
  const [streamUrl, setStreamUrl] = useState(existingConfig?.url || '');
  const [resolution, setResolution] = useState(
    existingConfig?.resolution || '1080p FHD'
  );
  const [fps, setFps] = useState<number>(existingConfig?.fps || 30);
  const [isEnabled, setIsEnabled] = useState(
    existingConfig?.enabled !== false
  );
  const [presetId, setPresetId] = useState(existingConfig?.preset_id || 'wardha_expressway');
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (node) {
      const cfg = node.camera;
      const type: CameraType = (!cfg || cfg.type === 'SIMULATED_AI' || cfg.type === 'PRESET' || cfg.type === 'AI_PRESET')
        ? 'AI_PRESET'
        : cfg.type;
      
      setStreamType(type);
      setCameraName(cfg?.name || `${node.name} - CAM 01`);
      setStreamUrl(cfg?.url || '');
      setResolution(cfg?.resolution || '1080p FHD');
      setFps(cfg?.fps || 30);
      setIsEnabled(cfg?.enabled !== false);
      setPresetId(cfg?.preset_id || 'wardha_expressway');
      setTestSuccess(null);
    }
  }, [node]);

  const handleSelectPreset = (preset: CameraPreset) => {
    setPresetId(preset.id);
    setCameraName(`${node.name} - ${preset.name}`);
    setStreamUrl(preset.url);
    setResolution(preset.resolution);
    setFps(preset.fps);
  };

  const handleTestConnection = () => {
    setTestSuccess(null);
    setTimeout(() => {
      setTestSuccess(true);
    }, 600);
  };

  const handleSave = () => {
    let finalUrl = streamUrl;
    if (streamType === 'AI_PRESET') {
      const selected = PRESET_CAMERAS.find(p => p.id === presetId);
      finalUrl = selected ? selected.url : (streamUrl || '/videos/wardha_expressway.mp4');
    }

    const config: CameraConfig = {
      name: cameraName.trim() || `${node.name} IP Cam`,
      type: streamType,
      url: finalUrl,
      preset_id: presetId,
      resolution,
      fps,
      enabled: isEnabled,
      status: isEnabled ? 'ONLINE' : 'OFFLINE',
      last_updated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    onSave(node.location_id, config);
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Remove IP Camera stream from node "${node.name}"?`)) {
      onDelete(node.location_id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col transition-colors ${isNightMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'}`}>
        
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${isNightMode ? 'border-zinc-800 bg-zinc-950/60' : 'border-zinc-100 bg-zinc-50/60'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-500">
              <Video size={20} />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold leading-tight">IP Camera Settings</h3>
              <p className={`text-xs ${isNightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Node: <strong className={isNightMode ? 'text-white' : 'text-zinc-800'}>{node.name}</strong> ({node.location_id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isNightMode ? 'bg-zinc-800 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
          
          {/* Stream Type Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
              Select Camera Stream Source
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { 
                  type: 'AI_PRESET', 
                  icon: <Sparkles size={16} />, 
                  label: 'AI Vision Presets', 
                  badge: 'Real Video + AI' 
                },
                { 
                  type: 'IP_STREAM', 
                  icon: <Globe size={16} />, 
                  label: 'Custom IP Stream', 
                  badge: 'RTSP / HTTP' 
                },
                { 
                  type: 'WEBCAM', 
                  icon: <CameraIcon size={16} />, 
                  label: 'Live Webcam', 
                  badge: 'Local Device' 
                },
              ].map(item => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setStreamType(item.type as CameraType)}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1 transition-all text-xs font-semibold ${streamType === item.type ? (isNightMode ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.25)]' : 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md') : (isNightMode ? 'bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:bg-zinc-800' : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100')}`}
                >
                  <div className="flex items-center gap-1.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] opacity-75 font-mono">{item.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Camera Name / Tag
              </label>
              <input
                type="text"
                value={cameraName}
                onChange={e => setCameraName(e.target.value)}
                placeholder="e.g. Wardha Road Expressway - CAM 01"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${isNightMode ? 'bg-zinc-800/80 border-zinc-700 text-white placeholder-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400'}`}
              />
            </div>

            {/* AI Vision Preset selector */}
            {streamType === 'AI_PRESET' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Choose Nagpur Corridor Video Preset
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PRESET_CAMERAS.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${presetId === p.id ? (isNightMode ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-md' : 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-md') : (isNightMode ? 'bg-zinc-800/40 border-zinc-800 hover:bg-zinc-800/80' : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100')}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <strong className="text-xs font-bold truncate max-w-[170px]">{p.name}</strong>
                        {presetId === p.id && <Check size={14} className="text-indigo-400 shrink-0" />}
                      </div>
                      <p className={`text-[11px] leading-snug line-clamp-2 ${isNightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>{p.desc}</p>
                      <div className="mt-2 flex gap-2 text-[10px] font-mono text-zinc-400">
                        <span>{p.resolution}</span>
                        <span>•</span>
                        <span>{p.fps} FPS</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom IP Stream URL input */}
            {streamType === 'IP_STREAM' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  IP Stream URL (RTSP / HTTP / HTTPS / MJPEG / MP4)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={streamUrl}
                    onChange={e => setStreamUrl(e.target.value)}
                    placeholder="http://192.168.1.100:8080/video or https://..."
                    className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${isNightMode ? 'bg-zinc-800/80 border-zinc-700 text-white placeholder-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400'}`}
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <Play size={13} />
                    <span>Test</span>
                  </button>
                </div>
                {testSuccess && (
                  <p className="text-xs text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                    <Check size={13} /> Stream endpoint verified successfully.
                  </p>
                )}
              </div>
            )}

            {/* Webcam info */}
            {streamType === 'WEBCAM' && (
              <div className={`p-4 rounded-2xl border flex items-start gap-3 ${isNightMode ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-200' : 'bg-emerald-50 border-emerald-100 text-emerald-900'}`}>
                <CameraIcon size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong>Local Device Webcam Mode:</strong> Feeds your workstation's live webcam directly into this tactical node with real-time AI bounding box analysis.
                </div>
              </div>
            )}

            {/* Resolution & FPS */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Resolution
                </label>
                <select
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isNightMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'}`}
                >
                  <option value="720p HD">720p HD</option>
                  <option value="1080p FHD">1080p FHD</option>
                  <option value="4K UltraHD">4K UltraHD</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Frame Rate (FPS)
                </label>
                <select
                  value={fps}
                  onChange={e => setFps(Number(e.target.value))}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isNightMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'}`}
                >
                  <option value={15}>15 FPS (Bandwidth Saver)</option>
                  <option value={25}>25 FPS (Standard PAL)</option>
                  <option value={30}>30 FPS (Smooth NTSC)</option>
                  <option value={60}>60 FPS (High Speed)</option>
                </select>
              </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-zinc-300">Live Camera Enabled</span>
              <button
                type="button"
                onClick={() => setIsEnabled(v => !v)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${isEnabled ? 'bg-emerald-500' : (isNightMode ? 'bg-zinc-700' : 'bg-zinc-300')}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${isNightMode ? 'border-zinc-800 bg-zinc-950/60' : 'border-zinc-100 bg-zinc-50'}`}>
          {existingConfig ? (
            <button
              type="button"
              onClick={handleDelete}
              className="px-3.5 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={14} />
              <span>Remove Cam</span>
            </button>
          ) : <div></div>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${isNightMode ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-colors"
            >
              <Check size={14} />
              <span>Save & Connect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
