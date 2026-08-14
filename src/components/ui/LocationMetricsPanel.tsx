import React, { useState } from "react";
import { AlertTriangle, Compass, Flame, Gauge, Globe2, MapPin, Search, Sparkles, Sun, Thermometer, Waves, Wind } from "lucide-react";
import { GlobeMetrics, PresetLocation } from "../../types";
import { PRESET_LOCATIONS } from "../../utils/climateData";
import { formatCoordinates, formatTemperature } from "../../utils/formatters";

interface LocationMetricsPanelProps {
  metrics: GlobeMetrics;
  onSelectPreset: (preset: PresetLocation) => void;
  onSearchLocation: (query: string) => Promise<void>;
  useFahrenheit: boolean;
  isPinLocked: boolean;
  onTogglePinLock: () => void;
  onCancelPin: () => void;
}

export const LocationMetricsPanel: React.FC<LocationMetricsPanelProps> = ({
  metrics,
  onSelectPreset,
  onSearchLocation,
  useFahrenheit,
  isPinLocked,
  onTogglePinLock,
  onCancelPin,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      await onSearchLocation(searchQuery);
    } finally {
      setIsSearching(false);
    }
  };

  const tempDisplay = formatTemperature(metrics.tempC, useFahrenheit);
  const isFloodRisk = metrics.seaLevelElevationM <= metrics.seaLevelRiseM;

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 rounded-2xl shadow-2xl flex flex-col gap-4 max-w-sm w-full">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          type="text"
          placeholder="Search city, landmark, or region..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-20 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        <button
          type="submit"
          disabled={isSearching}
          className="absolute right-1.5 top-1.5 px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-[11px] rounded-lg transition disabled:opacity-50"
        >
          {isSearching ? "Searching..." : "Go"}
        </button>
      </form>

      {/* Inspected Header */}
      <div className="flex flex-col gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-rose-500 fill-rose-500/20" />
            <h2 className="text-base font-bold text-slate-100">{metrics.locationName}</h2>
          </div>
          {metrics.country && (
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-medium">
              {metrics.country}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 font-mono">
          Coords: {formatCoordinates(metrics.lat, metrics.lng)}
        </p>

        {/* Pin Lock Control Action Buttons */}
        <div className="flex items-center gap-2 mt-1">
          {isPinLocked ? (
            <button
              onClick={onCancelPin}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-semibold transition"
            >
              <span>📍 Cancel Location Pin</span>
            </button>
          ) : (
            <button
              onClick={onTogglePinLock}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white shadow-lg shadow-rose-950/50 rounded-xl text-xs font-bold transition active:scale-95"
            >
              <span>📍 Lock Pin at Center</span>
            </button>
          )}
        </div>
      </div>

      {/* Flood Warning Banner */}
      {isFloodRisk && (
        <div className="bg-rose-500/20 border border-rose-500/50 p-2.5 rounded-xl flex items-center gap-2 text-rose-300 text-xs font-medium animate-pulse">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Coastal Elevation ({metrics.seaLevelElevationM}m) flooded by +{metrics.seaLevelRiseM}m sea level rise!</span>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Temperature */}
        <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <Thermometer className="w-3.5 h-3.5" />
            <span>Temperature</span>
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono">{tempDisplay}</div>
          <div className="text-[10px] text-slate-500">Surface Thermal Cell</div>
        </div>

        {/* Barometric Pressure */}
        <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Gauge className="w-3.5 h-3.5" />
            <span>Pressure</span>
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono">{metrics.pressureHpa} hPa</div>
          <div className="text-[10px] text-slate-500">
            {metrics.pressureHpa > 1013 ? "High Pressure Cell" : "Low Pressure Cyclone"}
          </div>
        </div>

        {/* Airflow / Wind */}
        <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-cyan-400">
            <Wind className="w-3.5 h-3.5" />
            <span>Airflow Wind</span>
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono">{metrics.windSpeedKmh} km/h</div>
          <div className="text-[10px] text-slate-500">Vector Heading: {metrics.windDirectionDeg}°</div>
        </div>

        {/* Sea Level Elevation */}
        <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-blue-400">
            <Waves className="w-3.5 h-3.5" />
            <span>Elevation</span>
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono">{metrics.seaLevelElevationM}m</div>
          <div className="text-[10px] text-slate-500">Above baseline sea level</div>
        </div>
      </div>

      {/* Summary Box */}
      <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl text-xs text-slate-300 leading-relaxed">
        {metrics.summary}
      </div>

      {/* Quick Location Presets */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Quick Presets</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_LOCATIONS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className="px-2.5 py-1 bg-slate-950 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 rounded-lg text-xs transition"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Data Source Footer */}
      <div className="pt-1 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1 font-mono">
        <span>Free Weather via Open-Meteo & Nominatim</span>
      </div>
    </div>
  );
};
