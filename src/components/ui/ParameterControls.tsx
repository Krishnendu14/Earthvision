import React from "react";
import { CloudRain, Gauge, Layers, Sun, Thermometer, Waves, Wind } from "lucide-react";
import { LayerType } from "../../types";

interface ParameterControlsProps {
  activeLayer: LayerType;
  onLayerChange: (layer: LayerType) => void;
  useFahrenheit: boolean;
  onToggleUnits: () => void;
}

export const ParameterControls: React.FC<ParameterControlsProps> = ({
  activeLayer,
  onLayerChange,
  useFahrenheit,
  onToggleUnits,
}) => {
  const layers: { id: LayerType; label: string; icon: React.ReactNode; desc: string; activeColor: string }[] = [
    { id: "temperature", label: "Temperature", icon: <Thermometer className="w-4 h-4 text-amber-400" />, desc: "Surface & Atmospheric Thermal Heatmaps", activeColor: "bg-amber-500/20 text-amber-300 border-amber-500/50" },
    { id: "pressure", label: "Barometric Pressure", icon: <Gauge className="w-4 h-4 text-emerald-400" />, desc: "Isobars & High/Low Pressure Cells", activeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" },
    { id: "airflow", label: "Airflow Vectors", icon: <Wind className="w-4 h-4 text-cyan-400" />, desc: "Jet Streams & Global Trade Winds", activeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50" },
    { id: "sealevel", label: "Sea Level Rise", icon: <Waves className="w-4 h-4 text-blue-400" />, desc: "Coastal Inundation Risk Map", activeColor: "bg-blue-500/20 text-blue-300 border-blue-500/50" },
    { id: "precipitation", label: "Clouds & Rain", icon: <CloudRain className="w-4 h-4 text-purple-400" />, desc: "Cloud Cover & Convection Storm Radar", activeColor: "bg-purple-500/20 text-purple-300 border-purple-500/50" },
    { id: "uv", label: "UV & Solar Index", icon: <Sun className="w-4 h-4 text-yellow-400" />, desc: "Solar Radiation & Ozone Density", activeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50" },
  ];

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-2xl flex flex-col gap-3 max-w-md w-full">
      {/* Layer Tabs Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider">Climate Layers</h2>
        </div>
        <button
          onClick={onToggleUnits}
          className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition font-mono font-semibold"
        >
          {useFahrenheit ? "°F Units" : "°C Units"}
        </button>
      </div>

      {/* Layer Grid Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {layers.map((l) => {
          const isActive = activeLayer === l.id;
          return (
            <button
              key={l.id}
              onClick={() => onLayerChange(l.id)}
              className={`flex items-start gap-2 p-2 sm:p-2.5 rounded-xl border text-left transition-all ${
                isActive
                  ? l.activeColor + " shadow-lg"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="p-1 rounded-lg bg-slate-800/80 border border-slate-700/50 shrink-0">{l.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold leading-snug truncate">{l.label}</div>
                <div className="text-[10px] text-slate-500 leading-tight line-clamp-1">{l.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

