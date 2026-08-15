import React, { useCallback, useEffect, useState } from "react";
import {
  Camera,
  ChevronDown,
  Coffee,
  Globe2,
  Hand,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  Sliders,
  X,
} from "lucide-react";
import { GlobeMetrics, HandGestureData, LayerType, PresetLocation } from "./types";
import {
  calculateGlobeMetrics,
  fetchOpenMeteoMetrics,
  PRESET_LOCATIONS,
  searchLocationNominatim,
} from "./utils/climateData";
import { GlobeCanvas } from "./components/3d/GlobeCanvas";
import { GestureHUD } from "./components/ui/GestureHUD";
import { ParameterControls } from "./components/ui/ParameterControls";
import { LocationMetricsPanel } from "./components/ui/LocationMetricsPanel";
import { GestureGuideModal } from "./components/ui/GestureGuideModal";
import { SupportPage } from "./components/ui/SupportPage";

type MobileTab = "none" | "metrics" | "controls" | "camera";

export default function App() {
  const [activeLayer, setActiveLayer] = useState<LayerType>("temperature");
  const [seaLevelRiseM, setSeaLevelRiseM] = useState<number>(0);
  const [timeOffsetHours, setTimeOffsetHours] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [useFahrenheit, setUseFahrenheit] = useState<boolean>(false);

  // Selected Location Metrics (Defaults to Tokyo preset)
  const [selectedMetrics, setSelectedMetrics] = useState<GlobeMetrics>(() =>
    calculateGlobeMetrics(PRESET_LOCATIONS[0].lat, PRESET_LOCATIONS[0].lng, 0, 0)
  );

  // Pin Lock state (User gesture or button toggles whether pin is locked on globe or targeting center)
  const [isPinLocked, setIsPinLocked] = useState<boolean>(false);

  const handleTogglePinLock = useCallback(() => {
    setIsPinLocked((prev) => !prev);
  }, []);

  const handleCancelPin = useCallback(() => {
    setIsPinLocked(false);
  }, []);

  // Hand Gesture Tracking State
  const [gestureData, setGestureData] = useState<HandGestureData>({
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

  // UI Modals & Camera & Mobile Sheet Drawer state
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isSupportPageOpen, setIsSupportPageOpen] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
  const [mobileSheetTab, setMobileSheetTab] = useState<"search" | "layers">("search");

  // Load live Open-Meteo weather on startup for default location
  useEffect(() => {
    fetchOpenMeteoMetrics(
      PRESET_LOCATIONS[0].lat,
      PRESET_LOCATIONS[0].lng,
      PRESET_LOCATIONS[0].name,
      PRESET_LOCATIONS[0].country,
      0,
      0
    ).then((metrics) => {
      setSelectedMetrics(metrics);
    }).catch(() => {});
  }, []);

  // Handlers
  const handleLayerChange = (layer: LayerType) => {
    setActiveLayer(layer);
  };

  const handleCycleLayer = useCallback(() => {
    const layers: LayerType[] = ["temperature", "pressure", "airflow", "sealevel", "precipitation", "uv"];
    setActiveLayer((current) => {
      const idx = layers.indexOf(current);
      return layers[(idx + 1) % layers.length];
    });
  }, []);

  const handleSelectPreset = async (preset: PresetLocation) => {
    const baseMetrics = calculateGlobeMetrics(preset.lat, preset.lng, seaLevelRiseM, timeOffsetHours);
    baseMetrics.locationName = preset.name;
    baseMetrics.country = preset.country;
    setSelectedMetrics(baseMetrics);

    try {
      const liveMetrics = await fetchOpenMeteoMetrics(
        preset.lat,
        preset.lng,
        preset.name,
        preset.country,
        seaLevelRiseM,
        timeOffsetHours
      );
      setSelectedMetrics(liveMetrics);
    } catch {
      // Fallback
    }
  };

  const handleSearchLocation = async (query: string) => {
    try {
      const metrics = await searchLocationNominatim(query, seaLevelRiseM, timeOffsetHours);
      setSelectedMetrics(metrics);
    } catch (err) {
      console.error("Location search failed:", err);
    }
  };

  const handleSelectMetrics = useCallback(async (baseMetrics: GlobeMetrics) => {
    setSelectedMetrics(baseMetrics);
    try {
      const liveMetrics = await fetchOpenMeteoMetrics(
        baseMetrics.lat,
        baseMetrics.lng,
        baseMetrics.locationName,
        baseMetrics.country,
        seaLevelRiseM,
        timeOffsetHours
      );
      setSelectedMetrics(liveMetrics);
    } catch {
      // Keep base
    }
  }, [seaLevelRiseM, timeOffsetHours]);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-slate-950 font-sans text-slate-100 select-none">
      {/* 1. Main 3D Interactive WebGL Globe (Full 100vh Screen Height) */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto">
        <GlobeCanvas
          activeLayer={activeLayer}
          seaLevelRiseM={seaLevelRiseM}
          timeOffsetHours={timeOffsetHours}
          gestureData={gestureData}
          selectedMetrics={selectedMetrics}
          onSelectMetrics={handleSelectMetrics}
          onLayerChangeRequest={handleCycleLayer}
          isPinLocked={isPinLocked}
          onTogglePinLock={handleTogglePinLock}
        />
      </div>

      {/* 2. Compact Floating Top Header */}
      <header className="absolute top-0 inset-x-0 z-20 p-2.5 sm:p-4 flex items-center justify-between pointer-events-none">
        {/* Branding Badge */}
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-900/85 backdrop-blur-xl border border-slate-800/80 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-2xl shadow-xl pointer-events-auto">
          <div className="p-1 sm:p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
            <Globe2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs sm:text-base font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 via-blue-200 to-indigo-300 bg-clip-text text-transparent">
                EarthVision
              </h1>
              <span className="text-[8px] sm:text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 sm:px-2 py-0.5 rounded-full font-mono font-semibold uppercase">
                3D Globe
              </span>
            </div>
            <p className="text-[8px] sm:text-[10px] text-slate-400 hidden sm:block">100% Client-Side Atmosphere Simulator</p>
          </div>
        </div>

        {/* Top Right Actions: Left-to-Right layout: Camera -> Hand Gesture Guide -> Co+2Fe ☕ */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {/* 1. Camera Toggle */}
          <button
            onClick={() => setIsCameraActive(!isCameraActive)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold backdrop-blur-xl transition shadow-lg border ${
              isCameraActive
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-500/10"
                : "bg-slate-900/85 hover:bg-slate-800 text-slate-300 border-slate-800"
            }`}
            title="Toggle Hand Gesture Camera"
          >
            <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            <span className="hidden sm:inline">{isCameraActive ? "Camera ON" : "Hand Camera"}</span>
          </button>

          {/* 2. Hand Gesture Guide */}
          <button
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-900/85 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-medium backdrop-blur-xl transition shadow-lg"
            title="Hand Gestures Guide"
          >
            <Hand className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            <span className="hidden sm:inline">Guide</span>
          </button>

          {/* 3. Co+2Fe ☕ Button */}
          <button
            onClick={() => setIsSupportPageOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-pink-500/20 hover:from-amber-500/30 hover:to-pink-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/40 hover:border-amber-500/60 rounded-xl text-xs font-bold backdrop-blur-xl transition shadow-lg shadow-amber-500/10 cursor-pointer"
            title="Support Developer & Backend / Co+2Fe"
          >
            <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-pulse" />
            <span>Co+2Fe ☕</span>
          </button>
        </div>
      </header>

      {/* 3. Floating Left Corner: Gesture HUD (Camera PIP) */}
      <div className="absolute top-14 sm:top-20 left-2 sm:left-4 z-20 pointer-events-none max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar">
        <div className="pointer-events-auto">
          <GestureHUD
            gestureData={gestureData}
            onGestureUpdate={setGestureData}
            onOpenGuide={() => setIsGuideOpen(true)}
            isCameraActive={isCameraActive}
            onToggleCamera={() => setIsCameraActive(!isCameraActive)}
          />
        </div>
      </div>

      {/* 4. Desktop Floating Right Panel: Location Metrics Dashboard */}
      <div className="absolute top-20 right-4 z-20 hidden md:block pointer-events-none max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar">
        <div className="pointer-events-auto">
          <LocationMetricsPanel
            metrics={selectedMetrics}
            onSelectPreset={handleSelectPreset}
            onSearchLocation={handleSearchLocation}
            useFahrenheit={useFahrenheit}
            isPinLocked={isPinLocked}
            onTogglePinLock={handleTogglePinLock}
            onCancelPin={handleCancelPin}
          />
        </div>
      </div>

      {/* 5. Desktop Floating Bottom Center Panel: Parameter Layer Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4 hidden md:block pointer-events-none">
        <div className="pointer-events-auto">
          <ParameterControls
            activeLayer={activeLayer}
            onLayerChange={handleLayerChange}
            useFahrenheit={useFahrenheit}
            onToggleUnits={() => setUseFahrenheit(!useFahrenheit)}
          />
        </div>
      </div>

      {/* 6. Mobile Bottom Semi-Transparent Data Bar & Expandable Sheet */}
      <div className="absolute bottom-2 inset-x-2 z-30 md:hidden flex flex-col gap-1.5 pointer-events-none">
        {/* Compact Weather Data Bar (Always Visible at Base of Screen) */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 p-2.5 rounded-2xl flex flex-col gap-2 shadow-2xl pointer-events-auto">
          {/* Header row: Location Name + Pin Lock + Expand Drawer button */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="font-bold text-xs text-slate-100 truncate">{selectedMetrics.locationName}</span>
              {selectedMetrics.country && (
                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700/60 truncate">
                  {selectedMetrics.country}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleTogglePinLock}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition ${
                  isPinLocked
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-slate-800 text-slate-300 border-slate-700"
                }`}
              >
                {isPinLocked ? "📍 Pin Locked" : "📍 Lock Pin"}
              </button>
              <button
                onClick={() => {
                  setMobileSheetTab("search");
                  setIsMobileSheetOpen(true);
                }}
                className="p-1 text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition flex items-center gap-1 text-[10px] font-semibold"
              >
                <span>More / Search</span>
                <ChevronDown className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>
          </div>

          {/* Core Weather Data Grid (4 Key Metrics: Temperature, Pressure, Wind, Elevation) */}
          <div
            onClick={() => {
              setMobileSheetTab("layers");
              setIsMobileSheetOpen(true);
            }}
            className="grid grid-cols-4 gap-1.5 text-center cursor-pointer"
          >
            {/* Temp */}
            <div className="bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-xl flex flex-col items-center">
              <span className="text-[9px] text-amber-400 font-medium">Temp</span>
              <span className="text-xs font-bold font-mono text-slate-100">
                {useFahrenheit
                  ? `${((selectedMetrics.tempC * 9) / 5 + 32).toFixed(0)}°F`
                  : `${selectedMetrics.tempC}°C`}
              </span>
            </div>
            {/* Pressure */}
            <div className="bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-xl flex flex-col items-center">
              <span className="text-[9px] text-emerald-400 font-medium">Pressure</span>
              <span className="text-xs font-bold font-mono text-slate-100">{selectedMetrics.pressureHpa}hPa</span>
            </div>
            {/* Wind */}
            <div className="bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-xl flex flex-col items-center">
              <span className="text-[9px] text-cyan-400 font-medium">Wind</span>
              <span className="text-xs font-bold font-mono text-slate-100">{selectedMetrics.windSpeedKmh}km/h</span>
            </div>
            {/* Elevation */}
            <div className="bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-xl flex flex-col items-center">
              <span className="text-[9px] text-blue-400 font-medium">Elevation</span>
              <span className="text-xs font-bold font-mono text-slate-100">{selectedMetrics.seaLevelElevationM}m</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Mobile Expandable Sheet Overlay */}
      {isMobileSheetOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setIsMobileSheetOpen(false)}
          />
          <div className="relative z-50 bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[82vh] overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3 shadow-2xl">
            {/* Handle & Close Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileSheetTab("search")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    mobileSheetTab === "search"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Location & Search
                </button>
                <button
                  onClick={() => setMobileSheetTab("layers")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    mobileSheetTab === "layers"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Climate Layers
                </button>
              </div>
              <button
                onClick={() => setIsMobileSheetOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 bg-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Content */}
            {mobileSheetTab === "search" && (
              <LocationMetricsPanel
                metrics={selectedMetrics}
                onSelectPreset={(p) => {
                  handleSelectPreset(p);
                  setIsMobileSheetOpen(false);
                }}
                onSearchLocation={async (q) => {
                  await handleSearchLocation(q);
                  setIsMobileSheetOpen(false);
                }}
                useFahrenheit={useFahrenheit}
                isPinLocked={isPinLocked}
                onTogglePinLock={handleTogglePinLock}
                onCancelPin={handleCancelPin}
              />
            )}

            {mobileSheetTab === "layers" && (
              <ParameterControls
                activeLayer={activeLayer}
                onLayerChange={(l) => {
                  handleLayerChange(l);
                  setIsMobileSheetOpen(false);
                }}
                useFahrenheit={useFahrenheit}
                onToggleUnits={() => setUseFahrenheit(!useFahrenheit)}
              />
            )}

            {/* Mobile quick support button */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsMobileSheetOpen(false);
                  setIsSupportPageOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-pink-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Coffee className="w-4 h-4 text-amber-400" />
                <span>Co+2Fe ☕ (love you man 😘)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hand Gesture Guide Modal */}
      <GestureGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Dedicated Support / Ads / Appreciation Page */}
      {isSupportPageOpen && (
        <SupportPage onBack={() => setIsSupportPageOpen(false)} />
      )}
    </div>
  );
}


