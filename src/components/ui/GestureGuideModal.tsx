import React from "react";
import { Hand, Sparkles, X } from "lucide-react";

interface GestureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GestureGuideModal: React.FC<GestureGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const gestures = [
    {
      sign: "🖐",
      name: "Open Palm",
      action: "Direct Globe Rotation",
      desc: "Extend all fingers facing camera. Move your palm to directly rotate the 3D Earth. Motion stops instantly when closed.",
      color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    },
    {
      sign: "✊",
      name: "Closed Fist",
      action: "Input Disengaged (Reset)",
      desc: "Curl fingers into a fist. All gesture input is ignored so you can reposition your hand without moving the globe.",
      color: "border-slate-600/40 bg-slate-800/40 text-slate-300",
    },
    {
      sign: "👍",
      name: "Thumbs Up",
      action: "Steady Zoom In",
      desc: "Point thumb upwards with fingers folded. Triggers a constant, steady camera Zoom In until gesture is released.",
      color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    },
    {
      sign: "👎",
      name: "Thumbs Down",
      action: "Steady Zoom Out",
      desc: "Point thumb downwards with fingers folded. Triggers a constant, steady camera Zoom Out until gesture is released.",
      color: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    },
    {
      sign: "☝️",
      name: "Pointing Finger",
      action: "Lock / Unlock Red Pin",
      desc: "Extend index finger only. Locks the red location pin on the globe surface or unlocks back to center target.",
      color: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    },
    {
      sign: "✌️",
      name: "Peace Sign",
      action: "Cycle Climate Layer",
      desc: "Extend index and middle fingers. Automatically cycles between Temperature, Pressure, Airflow, Sea Level, and UV layers.",
      color: "border-purple-500/40 bg-purple-500/10 text-purple-300",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <Hand className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Hand Gesture Controls Guide</h2>
              <p className="text-xs text-slate-400">Use live camera hand signs or mouse drag to manipulate the 3D globe.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gestures Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {gestures.map((g, idx) => (
            <div key={idx} className={`p-3.5 rounded-xl border flex flex-col gap-1.5 ${g.color}`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl">{g.sign}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                  {g.name}
                </span>
              </div>
              <div className="text-xs font-bold leading-tight">{g.action}</div>
              <div className="text-[11px] text-slate-400 leading-normal">{g.desc}</div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" /> Mouse / Touch controls (click & drag, wheel zoom) are always available as fallback.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
