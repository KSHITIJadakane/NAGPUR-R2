import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import {
  Video, Eye, EyeOff, ZoomIn, ZoomOut, Camera,
  Sliders, Moon, Flame, Sparkles, Cpu
} from 'lucide-react';
import { CameraConfig, RiskNode } from '../types';
import { PRESET_CAMERAS } from '../data';

// ── Module-level singleton: ONE model & ONE global inference mutex ───────────
let sharedModel: cocoSsd.ObjectDetection | null = null;
let modelLoading = false;
let globalInferring = false; // Mutex to prevent multi-camera GPU overload
const modelReadyCallbacks: Array<() => void> = [];

async function getModel(): Promise<cocoSsd.ObjectDetection> {
  if (sharedModel) return sharedModel;
  if (modelLoading) {
    return new Promise(resolve => {
      modelReadyCallbacks.push(() => resolve(sharedModel!));
    });
  }
  modelLoading = true;
  await tf.ready();
  sharedModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  modelLoading = false;
  modelReadyCallbacks.forEach(cb => cb());
  modelReadyCallbacks.length = 0;
  return sharedModel;
}

// ── Clean & Balanced Tactical Colors ──────────────────────────────────────────
const VEHICLE_CLASSES = new Set([
  'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'person',
]);

const CLASS_COLORS: Record<string, string> = {
  car: '#10b981',        // Clean Balanced Emerald Green
  truck: '#f59e0b',      // Amber
  bus: '#3b82f6',        // Tactical Blue
  motorcycle: '#8b5cf6', // Soft Violet
  bicycle: '#06b6d4',    // Soft Cyan
  person: '#f43f5e',     // Soft Rose
};

interface Detection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

interface CameraStreamPlayerProps {
  node: RiskNode;
  cameraConfig?: CameraConfig;
  isNightMode?: boolean;
  onConfigureClick?: () => void;
  compact?: boolean;
  onRiskUpdate?: (locationId: string, vehicleCount: number) => void;
}

// Interval per stream (ms). 240ms (~4.2 FPS) is extremely smooth for vehicle tracking while using near-zero CPU/GPU.
const INFERENCE_INTERVAL_MS = 240;

export function CameraStreamPlayer({
  node,
  cameraConfig,
  isNightMode = false,
  onConfigureClick,
  compact = false,
  onRiskUpdate,
}: CameraStreamPlayerProps) {
  const [showAiOverlay, setShowAiOverlay] = useState(true);
  const [visionMode, setVisionMode] = useState<'STANDARD' | 'NIGHT_VISION' | 'THERMAL'>('STANDARD');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isRecording] = useState(true);
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [shortTime, setShortTime] = useState('');
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detectionCount, setDetectionCount] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectionsRef = useRef<Detection[]>([]);
  const lastInferenceRef = useRef<number>(0);
  const lastDetectionCountRef = useRef<number>(0);

  // Stable refs to prevent RAF teardown/recreation on prop changes
  const nodeRef = useRef(node);
  nodeRef.current = node;
  const onRiskUpdateRef = useRef(onRiskUpdate);
  onRiskUpdateRef.current = onRiskUpdate;
  const showAiOverlayRef = useRef(showAiOverlay);
  showAiOverlayRef.current = showAiOverlay;
  const modelStatusRef = useRef(modelStatus);
  modelStatusRef.current = modelStatus;

  const camera = cameraConfig || node.camera;

  const [videoSrc, setVideoSrc] = useState<string>('');
  const [triedFallback, setTriedFallback] = useState(false);

  const preset = PRESET_CAMERAS.find(pr => pr.id === (camera?.preset_id || ''));

  useEffect(() => {
    setTriedFallback(false);
    if (camera?.url) {
      setVideoSrc(camera.url);
    } else if (preset) {
      setVideoSrc(preset.url);
    } else {
      setVideoSrc('/videos/wardha_expressway.mp4');
    }
  }, [camera?.url, camera?.preset_id]);

  const handleVideoError = () => {
    if (!triedFallback && preset?.fallbackUrl) {
      setTriedFallback(true);
      setVideoSrc(preset.fallbackUrl);
    } else {
      setVideoLoaded(false);
    }
  };

  const videoStartOffset = camera?.videoStartOffset ?? preset?.videoStartOffset ?? 0;
  const fps = camera?.fps ?? preset?.fps ?? 30;

  // ── Intersection Observer (Pause inference when scrolled off screen) ────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          isVisibleRef.current = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      setShortTime(new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Load shared model ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getModel()
      .then(() => { if (!cancelled) setModelStatus('ready'); })
      .catch(() => { if (!cancelled) setModelStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  // ── Webcam ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (camera?.type !== 'WEBCAM' || !camera.enabled) return;
    navigator.mediaDevices?.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then(stream => {
        webcamStreamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        setWebcamError(null);
      })
      .catch(err => setWebcamError(err.message || 'Webcam denied'));
    return () => { webcamStreamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [camera?.type, camera?.enabled]);

  // ── Main render loop — silky 60fps canvas & light inference ────────────────
  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Only render if container is in viewport
    if (!isVisibleRef.current || !canvas) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const now = performance.now();

    // ── SEQUENTIAL GLOBAL MUTEX INFERENCE (Ultra lightweight CPU/GPU footprint) ─
    if (
      sharedModel &&
      video &&
      !globalInferring &&
      showAiOverlayRef.current &&
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      (now - lastInferenceRef.current) > INFERENCE_INTERVAL_MS
    ) {
      globalInferring = true;
      lastInferenceRef.current = now;

      sharedModel.detect(video).then(raw => {
        const filtered = raw
          .filter(d => VEHICLE_CLASSES.has(d.class) && d.score > 0.38)
          .map(d => ({ bbox: d.bbox as [number, number, number, number], class: d.class, score: d.score }));

        detectionsRef.current = filtered;
        const count = filtered.length;

        // Only trigger React state change if count actually changed to save CPU cycles
        if (count !== lastDetectionCountRef.current) {
          lastDetectionCountRef.current = count;
          setDetectionCount(count);
          onRiskUpdateRef.current?.(nodeRef.current.location_id, count);
        }
        globalInferring = false;
      }).catch(() => { 
        globalInferring = false; 
      });
    }

    // ── 100% SOLID, HIGH-CONTRAST VIVID DRAWING ──────────────────────────────
    if (showAiOverlayRef.current && video && video.videoWidth > 0 && detectionsRef.current.length > 0) {
      const scaleX = cw / video.videoWidth;
      const scaleY = ch / video.videoHeight;

      detectionsRef.current.forEach((det, i) => {
        const [x, y, w, h] = det.bbox;
        const sx = x * scaleX, sy = y * scaleY, sw = w * scaleX, sh = h * scaleY;
        const color = CLASS_COLORS[det.class] ?? '#10b981';

        ctx.save();

        // 1. Sleek, Balanced Bounding Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.75;
        ctx.strokeRect(sx, sy, sw, sh);

        // 2. Subtle White Corner Accents
        const cl = Math.min(8, sw * 0.2, sh * 0.2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(sx, sy + cl); ctx.lineTo(sx, sy); ctx.lineTo(sx + cl, sy);
        // Bottom-right
        ctx.moveTo(sx + sw, sy + sh - cl); ctx.lineTo(sx + sw, sy + sh); ctx.lineTo(sx + sw - cl, sy + sh);
        ctx.stroke();

        // 3. Crisp Balanced HUD Tag
        ctx.font = `bold ${compact ? 9 : 10}px monospace`;
        const label = `${det.class.toUpperCase()} ${(det.score * 100).toFixed(0)}%`;
        const lw = ctx.measureText(label).width + 10;
        const lh = 15;
        const ly = sy > lh + 3 ? sy - lh - 2 : sy + sh + 2;

        // Dark Translucent Glass Pill
        ctx.fillStyle = 'rgba(10, 10, 14, 0.88)';
        ctx.fillRect(sx, ly, lw, lh);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, ly, lw, lh);

        // Clean Emerald Label Text
        ctx.fillStyle = color;
        ctx.fillText(label, sx + 5, ly + 11);

        // 4. Target ID
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.font = `${compact ? 8 : 9}px monospace`;
        ctx.fillText(`#${(i + 1)}`, sx + 3, sy + 10);

        ctx.restore();
      });

      // Subtle tactical scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.02)';
      for (let i = 0; i < ch; i += 4) ctx.fillRect(0, i, cw, 1);
    }

    // Loading indicator
    if (showAiOverlayRef.current && modelStatusRef.current === 'loading') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(cw / 2 - 72, ch / 2 - 12, 144, 24);
      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('⟳  Loading AI Engine...', cw / 2 - 66, ch / 2 + 4);
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [compact]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(renderLoop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [renderLoop]);

  // ── Snapshot ──────────────────────────────────────────────────────────────
  const handleSnapshot = () => {
    setSnapshotTaken(true);
    setTimeout(() => setSnapshotTaken(false), 1200);
    const video = videoRef.current;
    const overlay = canvasRef.current;
    const out = document.createElement('canvas');
    out.width = 1280; out.height = 720;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    try {
      if (video && videoLoaded) ctx.drawImage(video, 0, 0, 1280, 720);
      if (overlay) ctx.drawImage(overlay, 0, 0, 1280, 720);
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(10, 10, 420, 28);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`NAGPUR-R2 AI-CCTV: ${node.name} [${node.location_id}] ${new Date().toLocaleTimeString()}`, 16, 28);
      const link = document.createElement('a');
      link.download = `CCTV-${node.location_id}-${Date.now()}.png`;
      link.href = out.toDataURL('image/png');
      link.click();
    } catch { /* cross-origin guard */ }
  };

  const isStreamActive = camera?.enabled !== false;

  return (
    <div ref={containerRef} className={`relative flex flex-col w-full rounded-2xl overflow-hidden border ${isNightMode ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-900 border-zinc-800'} ${compact ? 'h-[210px]' : 'h-[370px]'}`}>

      {/* Top HUD */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-mono font-bold shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full bg-rose-500 ${isRecording ? 'animate-ping' : ''}`} />
            REC
          </span>
          <span className="text-white text-[11px] font-mono font-bold truncate max-w-[130px]" title={camera?.name || node.name}>
            {camera?.name || `${node.name} Cam`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
            modelStatus === 'ready'
              ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60'
              : modelStatus === 'loading'
              ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 animate-pulse'
              : 'bg-rose-950/70 text-rose-400'
          }`}>
            <Cpu size={9} />
            {modelStatus === 'ready' ? `AI ${detectionCount}` : modelStatus === 'loading' ? 'AI…' : 'AI ERR'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
            {camera?.resolution || '1080p'}
          </span>
          <span className="text-emerald-400 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
            {fps} FPS
          </span>
          {!compact && <span className="text-zinc-500 text-[10px] font-mono hidden md:block">{shortTime}</span>}
        </div>
      </div>

      {/* Main viewport */}
      <div className="relative flex-1 w-full overflow-hidden bg-black">
        {snapshotTaken && (
          <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-300 pointer-events-none" />
        )}

        <div
          className="relative w-full h-full transition-transform duration-100"
          style={{
            transform: `scale(${zoomLevel})`,
            filter:
              visionMode === 'NIGHT_VISION'
                ? 'sepia(1) hue-rotate(70deg) saturate(3) brightness(1.15)'
                : visionMode === 'THERMAL'
                ? 'invert(1) hue-rotate(180deg) saturate(2)'
                : 'none',
          }}
        >
          {/* Video layer */}
          {camera?.type === 'WEBCAM' ? (
            webcamError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
                <Video size={32} className="text-rose-500 mb-2" />
                <p className="text-xs font-bold text-white">Webcam Error</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{webcamError}</p>
              </div>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted
                className="absolute inset-0 w-full h-full object-cover"
                onLoadedData={() => setVideoLoaded(true)} />
            )
          ) : (
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay loop muted playsInline
              crossOrigin="anonymous"
              className="absolute inset-0 w-full h-full object-cover"
              onLoadedData={e => {
                const vid = e.currentTarget;
                if (videoStartOffset > 0 && vid.duration > videoStartOffset) {
                  vid.currentTime = videoStartOffset;
                }
                setVideoLoaded(true);
              }}
              onError={handleVideoError}
            />
          )}

          {/* AI overlay canvas (transparent, draw-only) */}
          <canvas ref={canvasRef} width={640} height={360}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        </div>

        {/* Telemetry footer */}
        <div className="absolute bottom-2 left-2.5 z-20 pointer-events-none flex items-center gap-2 bg-black/75 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-zinc-800/80 text-[10px] font-mono shadow-lg">
          <span className="text-zinc-500">{node.lat.toFixed(2)}°N, {node.lng.toFixed(2)}°E</span>
          <span className="text-zinc-700">|</span>
          <span className={`font-bold ${node.current_risk > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
            RISK: {node.current_risk}%
            {node.current_risk > 80 ? ' [CRITICAL]' : node.current_risk > 60 ? ' [HIGH]' : ' [NOMINAL]'}
          </span>
        </div>

        {/* Offline banner */}
        {!isStreamActive && (
          <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-5 text-center">
            <Video size={36} className="text-zinc-600 mb-2 animate-pulse" />
            <h4 className="text-sm font-bold text-white">Camera Disabled</h4>
            <p className="text-xs text-zinc-400 max-w-[240px] mt-1">Live feed disabled for {node.name}.</p>
            {onConfigureClick && (
              <button onClick={onConfigureClick} className="mt-3 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
                Configure Feed
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="relative z-30 flex items-center justify-between px-2.5 py-1.5 bg-zinc-950 border-t border-zinc-800 text-xs shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAiOverlay(v => !v)}
            className={`px-2 py-1 rounded-md flex items-center gap-1 text-[11px] font-medium transition-colors ${showAiOverlay ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-zinc-400 hover:bg-zinc-800'}`}
            title="Toggle COCO-SSD Vehicle Detection"
          >
            {showAiOverlay ? <Eye size={12} /> : <EyeOff size={12} />}
            <span className="hidden sm:inline">AI Bounding</span>
          </button>

          <button
            onClick={() => setVisionMode(m => m === 'STANDARD' ? 'NIGHT_VISION' : m === 'NIGHT_VISION' ? 'THERMAL' : 'STANDARD')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 text-[11px] font-mono transition-colors ${visionMode !== 'STANDARD' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'text-zinc-400 hover:bg-zinc-800'}`}
            title="Cycle vision mode"
          >
            {visionMode === 'NIGHT_VISION' ? <Moon size={12} className="text-emerald-400" /> : visionMode === 'THERMAL' ? <Flame size={12} className="text-purple-400" /> : <Sparkles size={12} />}
            <span className="hidden sm:inline">{visionMode === 'NIGHT_VISION' ? 'Night' : visionMode === 'THERMAL' ? 'Thermal' : 'Standard'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 px-1.5 py-0.5 rounded-lg border border-zinc-800">
          <button onClick={() => setZoomLevel(z => Math.max(1, +(z - 0.25).toFixed(2)))} disabled={zoomLevel <= 1}
            className="p-1 text-zinc-400 hover:text-white disabled:opacity-30" title="Zoom Out">
            <ZoomOut size={12} />
          </button>
          <span className="font-mono text-[10px] text-zinc-300 px-1">{zoomLevel}x</span>
          <button onClick={() => setZoomLevel(z => Math.min(4, +(z + 0.25).toFixed(2)))} disabled={zoomLevel >= 4}
            className="p-1 text-zinc-400 hover:text-white disabled:opacity-30" title="Zoom In">
            <ZoomIn size={12} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleSnapshot} className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title="Snapshot">
            <Camera size={13} />
          </button>
          {onConfigureClick && (
            <button onClick={onConfigureClick} className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium flex items-center gap-1 border border-zinc-700/50">
              <Sliders size={11} />
              <span>Config</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
