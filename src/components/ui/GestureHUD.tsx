import React, { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, CameraOff, Hand, HelpCircle, Maximize2, Minimize2, ShieldCheck, Sparkles, Volume2, VolumeX } from "lucide-react";
import { GestureType, HandGestureData } from "../../types";
import { classifyHandGesture, drawHandSkeleton } from "../../utils/handGestureDetector";

interface GestureHUDProps {
  gestureData: HandGestureData;
  onGestureUpdate: (data: HandGestureData) => void;
  onOpenGuide: () => void;
  isCameraActive: boolean;
  onToggleCamera: () => void;
}

export const GestureHUD: React.FC<GestureHUDProps> = ({
  gestureData,
  onGestureUpdate,
  onOpenGuide,
  isCameraActive,
  onToggleCamera,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Track viewport size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Initialize MediaPipe Hands & Camera Feed
  useEffect(() => {
    let cameraInstance: any = null;
    let handsInstance: any = null;
    let isProcessingFrame = false;

    async function initMediaPipe() {
      if (!isCameraActive || !videoRef.current || !canvasRef.current) return;

      try {
        setCameraError(null);

        // Pre-check getUserMedia permission directly
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
          });
          // Stop stream tracks so MediaPipe Camera instance can attach cleanly
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr: any) {
          console.warn("Direct getUserMedia check failed:", permErr);
          if (
            permErr.name === "NotAllowedError" ||
            permErr.name === "PermissionDeniedError" ||
            permErr.message?.includes("Permission denied")
          ) {
            setCameraError("Camera permission denied. Please allow camera access in your browser address bar.");
          } else if (permErr.name === "NotFoundError" || permErr.name === "DevicesNotFoundError") {
            setCameraError("No camera device was detected on your device.");
          } else {
            setCameraError(`Camera feed error: ${permErr.message || "Permission denied"}`);
          }
          return;
        }

        // Import MediaPipe Hands & Camera Utils dynamically
        const handsModule = await import("@mediapipe/hands");
        const cameraModule = await import("@mediapipe/camera_utils");

        const Hands = handsModule.Hands;
        const Camera = cameraModule.Camera;

        handsInstance = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        handsInstance.setOptions({
          maxNumHands: 1,
          modelComplexity: 0, // 0 (Lite) for minimal CPU overhead and instant tracking
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        handsInstance.onResults((results: any) => {
          if (!canvasRef.current) return;
          const ctx = canvasRef.current.getContext("2d");
          if (!ctx) return;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const data = classifyHandGesture(landmarks);
            onGestureUpdate(data);

            // Draw Skeleton
            drawHandSkeleton(ctx, landmarks, data.gesture);
          } else {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            onGestureUpdate({
              gesture: "none",
              confidence: 0,
              x: 0.5,
              y: 0.5,
              deltaX: 0,
              deltaY: 0,
              pinchDistance: 1,
              isTracking: false,
              landmarksCount: 0,
            });
          }
        });

        if (videoRef.current) {
          cameraInstance = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current && handsInstance && !isProcessingFrame) {
                isProcessingFrame = true;
                try {
                  await handsInstance.send({ image: videoRef.current });
                } catch (e) {
                  // Ignore frame drop errors
                } finally {
                  isProcessingFrame = false;
                }
              }
            },
            width: 640,
            height: 480,
          });

          await cameraInstance.start().catch((startErr: any) => {
            console.warn("MediaPipe Camera start failed:", startErr);
            setCameraError("Failed to acquire camera feed: Permission denied or camera busy.");
          });
        }
      } catch (err: any) {
        console.error("Camera / MediaPipe initialization error:", err);
        setCameraError("Camera permission or MediaPipe initialization failed.");
      }
    }

    if (isCameraActive) {
      initMediaPipe();
    }

    return () => {
      if (cameraInstance) {
        try { cameraInstance.stop(); } catch (e) {}
      }
      if (handsInstance) {
        try { handsInstance.close(); } catch (e) {}
      }
    };
  }, [isCameraActive, retryCount]);

  const lastGestureRef = useRef<GestureType>("none");
  useEffect(() => {
    if (!soundEnabled || gestureData.gesture === "none" || gestureData.gesture === lastGestureRef.current) return;
    lastGestureRef.current = gestureData.gesture;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(gestureData.gesture === "open_palm" ? 440 : 660, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore audio context restrictions
    }
  }, [gestureData.gesture, soundEnabled]);

  const getGestureLabel = (gesture: GestureType) => {
    switch (gesture) {
      case "open_palm":
        return { title: "🖐 Open Palm", action: "Direct Globe Rotation", color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" };
      case "closed_fist":
        return { title: "✊ Closed Fist", action: "Input Disengaged (Reset)", color: "text-slate-400 border-slate-700 bg-slate-800/80" };
      case "thumbs_up":
        return { title: "👍 Thumbs Up", action: "Steady Zoom In", color: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10" };
      case "thumbs_down":
        return { title: "👎 Thumbs Down", action: "Steady Zoom Out", color: "text-rose-400 border-rose-500/40 bg-rose-500/10" };
      case "pointing":
        return { title: "☝️ Pointing Finger", action: "Pinpoint & Lock Pin", color: "text-amber-400 border-amber-500/40 bg-amber-500/10" };
      case "peace_layer":
        return { title: "✌️ Peace Sign", action: "Switch Climate Layer", color: "text-purple-400 border-purple-500/40 bg-purple-500/10" };
      default:
        return { title: "Scanning Hand...", action: "Show hand in camera view", color: "text-slate-400 border-slate-700 bg-slate-900/60" };
    }
  };

  const currentLabel = getGestureLabel(gestureData.gesture);

  // 1. MOBILE CAMERA UI (< 768px)
  if (isMobile) {
    if (!isCameraActive) {
      return null; // Hide floating 'Start Hand Camera' button overlay on mobile
    }

    return (
      <div className="flex flex-col gap-1 items-start">
        {/* Hidden/Live Video and Canvas (ALWAYS in DOM for unbroken MediaPipe tracking loop) */}
        <div
          className={
            isMinimized
              ? "absolute opacity-0 pointer-events-none w-1 h-1 overflow-hidden"
              : "relative w-[130px] h-[165px] bg-slate-950 border-2 border-cyan-500/60 rounded-2xl overflow-hidden shadow-2xl"
          }
        >
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-85"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            width={320}
            height={240}
            className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 z-10"
          />

          {!isMinimized && (
            <>
              {/* Top Overlay Bar inside PiP */}
              <div className="absolute top-1.5 inset-x-1.5 z-20 flex items-center justify-between">
                <div className="flex items-center gap-1 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-emerald-500/40 text-[8px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </div>
                <div className="flex items-center gap-1 bg-black/75 backdrop-blur-md rounded-lg p-0.5 border border-slate-700">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-0.5 text-slate-300 hover:text-cyan-400"
                    title="Toggle Audio"
                  >
                    {soundEnabled ? <Volume2 className="w-3 h-3 text-cyan-400" /> : <VolumeX className="w-3 h-3 text-slate-500" />}
                  </button>
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="p-0.5 text-slate-300 hover:text-white"
                    title="Minimize PiP"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Bottom Overlay Gesture Banner inside PiP */}
              <div className="absolute bottom-1.5 inset-x-1.5 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-1 rounded-xl text-center">
                <div className="text-[10px] font-bold text-slate-100 truncate">{currentLabel.title}</div>
                <div className="text-[8px] text-cyan-400 font-medium truncate">{currentLabel.action}</div>
              </div>
            </>
          )}
        </div>

        {/* Minimized Pill View on Mobile */}
        {isMinimized && (
          <div className="flex items-center gap-2 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/50 px-3 py-1.5 rounded-full shadow-2xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-slate-100 truncate max-w-[110px]">{currentLabel.title}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsMinimized(false)}
                className="p-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-md border border-cyan-500/40"
                title="Expand Camera PiP"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
              <button
                onClick={onToggleCamera}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-md"
                title="Turn Off Camera"
              >
                <CameraOff className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {cameraError && (
          <div className="text-[10px] text-rose-300 bg-rose-950/90 border border-rose-500/40 p-2 rounded-xl max-w-[200px]">
            {cameraError}
          </div>
        )}
      </div>
    );
  }

  // 2. DESKTOP / TABLET CAMERA UI (>= 768px)
  return (
    <div
      className={`flex flex-col gap-2 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-3 rounded-2xl shadow-2xl transition-all duration-300 ${
        isMinimized ? "w-64" : "w-72"
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <Hand className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide truncate">
            {isCameraActive ? "Hand Tracking" : "Gesture Camera"}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 text-slate-400 hover:text-slate-200 transition"
            title="Toggle Audio Feedback"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>
          <button
            onClick={onOpenGuide}
            className="p-1 text-slate-400 hover:text-cyan-400 transition"
            title="Hand Sign Guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          {isCameraActive && (
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-slate-400 hover:text-slate-200 transition text-[10px] font-mono bg-slate-800 rounded px-1"
              title={isMinimized ? "Expand HUD" : "Minimize HUD"}
            >
              {isMinimized ? "EXPAND" : "MIN"}
            </button>
          )}
        </div>
      </div>

      {/* Video Stream & Skeleton Canvas Container */}
      <div
        className={`relative w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center transition-all ${
          isMinimized ? "h-28" : "h-44"
        }`}
      >
        {isCameraActive ? (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-70"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              width={320}
              height={240}
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 z-10"
            />
            {/* Live Indicator */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-emerald-500/30 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE PIP
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-3 text-center gap-1.5 text-slate-400">
            <CameraOff className="w-8 h-8 text-slate-600 mb-0.5" />
            <p className="text-xs font-medium text-slate-300">Camera Off</p>
            <p className="text-[11px] text-slate-500 max-w-[200px]">
              Enable camera to control the 3D globe using hand signs.
            </p>
            <button
              onClick={onToggleCamera}
              className="mt-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
            >
              <CameraIcon className="w-3.5 h-3.5" /> Start Hand Camera
            </button>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="text-[11px] text-rose-300 bg-rose-950/80 border border-rose-500/40 p-2.5 rounded-xl space-y-1.5 shadow-lg">
          <div className="flex items-center gap-1.5 font-bold text-rose-400">
            <CameraOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Camera Permission Needed</span>
          </div>
          <p className="text-[10px] text-slate-300 leading-snug">{cameraError}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              onClick={() => {
                setCameraError(null);
                if (!isCameraActive) {
                  onToggleCamera();
                } else {
                  setRetryCount((c) => c + 1);
                }
              }}
              className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-[10px] font-semibold transition"
            >
              Retry Camera
            </button>
            <button
              onClick={() => {
                setCameraError(null);
                if (isCameraActive) onToggleCamera();
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[10px] font-medium transition"
            >
              Use Mouse Controls
            </button>
            <button
              onClick={() => setCameraError(null)}
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg text-[10px] transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Detected Gesture Feedback Banner */}
      <div className={`p-2 rounded-xl border flex items-center justify-between transition-all ${currentLabel.color}`}>
        <div className="min-w-0 pr-1">
          <div className="text-xs font-bold truncate">{currentLabel.title}</div>
          <div className="text-[10px] opacity-80 truncate">{currentLabel.action}</div>
        </div>
        {gestureData.isTracking && (
          <div className="flex flex-col items-end text-[9px] font-mono opacity-70 shrink-0">
            <span>CONF: {Math.round(gestureData.confidence * 100)}%</span>
            <span>TRACKING</span>
          </div>
        )}
      </div>

      {/* Toggle Camera Button */}
      {isCameraActive && (
        <button
          onClick={onToggleCamera}
          className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700"
        >
          <CameraOff className="w-3.5 h-3.5 text-slate-400" /> Turn Off Camera
        </button>
      )}
    </div>
  );
};

