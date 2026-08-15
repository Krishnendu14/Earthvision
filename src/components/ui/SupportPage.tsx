import React, { useEffect, useRef } from "react";
import { ArrowLeft, Heart, ExternalLink, Sparkles, ShieldCheck } from "lucide-react";

interface SupportPageProps {
  onBack: () => void;
}

export const SupportPage: React.FC<SupportPageProps> = ({ onBack }) => {
  const adIframeRef = useRef<HTMLIFrameElement>(null);

  // Allow ESC key to return back to Globe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  // Inject ad scripts inside an isolated iframe document so popups NEVER leak to the 3D Globe
  useEffect(() => {
    const iframe = adIframeRef.current;
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body {
                  margin: 0;
                  padding: 8px;
                  background: transparent;
                  color: #94a3b8;
                  font-family: system-ui, -apple-system, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                }
              </style>
              <!-- 1. Push · Immortal tag (zone 11581750) -->
              <script src="https://5gvci.com/act/files/tag.min.js?z=11581750" data-cfasync="false" async></script>
              
              <!-- 2. Multitag · Fabulous tag (zone 270202) -->
              <script src="https://quge5.com/88/tag.min.js" data-zone="270202" async data-cfasync="false"></script>
              
              <!-- 3. In-Page Push · Pleasant tag (zone 11581771) -->
              <script>
                (function(s){s.dataset.zone='11581771',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));
              </script>
              
              <!-- 4. Vignette · Magnificent tag (zone 11578682) -->
              <script>
                (function(s){s.dataset.zone='11578682',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));
              </script>
            </head>
            <body>
              <div style="font-size: 11px; color: #64748b; text-align: center;">Sponsored Partner Content Loaded</div>
            </body>
          </html>
        `);
        doc.close();
      }
    } catch (e) {
      console.warn("Support ad frame setup notice:", e);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 backdrop-blur-2xl text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 flex items-center justify-between max-w-4xl w-full mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700/80 transition shadow-lg group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Globe</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <span className="text-xs font-medium text-slate-300">Support Hub</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-10 flex flex-col items-center justify-center text-center gap-5 sm:gap-6">
        {/* 1. Developer Appreciation Hub Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold animate-pulse">
          <Heart className="w-4 h-4 fill-rose-400 text-rose-400" />
          <span>Developer Appreciation Hub</span>
          <Heart className="w-4 h-4 fill-rose-400 text-rose-400" />
        </div>

        {/* 2. Heading: love you man 😘 */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight bg-gradient-to-r from-rose-400 via-pink-300 to-amber-300 bg-clip-text text-transparent drop-shadow-md">
            love you man
          </h1>
          <span className="text-4xl sm:text-5xl md:text-6xl select-none inline-block animate-bounce drop-shadow-lg">
            😘
          </span>
        </div>

        {/* 3. Sticker Container */}
        <div className="relative group p-3 sm:p-4 rounded-3xl bg-slate-900/80 border border-slate-800/90 shadow-2xl shadow-rose-950/20 max-w-xs sm:max-w-sm w-full flex flex-col items-center overflow-hidden my-1">
          {/* Ambient Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/20 via-cyan-500/20 to-amber-500/20 rounded-3xl blur-xl opacity-75 -z-10" />

          <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-300">
            <img
              src="https://i.ibb.co/k2BGnsMc/STK-20250314-WA0000.webp"
              alt="Love you man sticker"
              className="w-full h-full object-contain select-none"
              loading="eager"
            />
          </div>
        </div>

        {/* 4. Text Description */}
        <div className="flex flex-col gap-2 max-w-lg px-2 text-slate-300 text-sm sm:text-base leading-relaxed">
          <p>
            Thank you so much for supporting the backend servers, 3D physics rendering, and keeping this atmosphere simulator free and fast!
          </p>
          <p className="text-slate-400 text-xs sm:text-sm">
            Your support keeps the high-precision 3D globe and gesture detection running 24/7.
          </p>
        </div>

        {/* 5. Direct Link Sponsor / Partner Support Card */}
        <div className="w-full max-w-md p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900/80 to-slate-900/90 border border-amber-500/30 shadow-xl flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: "4s" }} />
            <span>Golden Partner Sponsor Link</span>
          </div>
          <p className="text-xs text-slate-300">
            Clicking our partner link helps fund server costs and keeps this project 100% free.
          </p>
          <a
            href="https://omg10.com/4/11581761"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Visit Golden Sponsor</span>
            <ExternalLink className="w-4 h-4 text-slate-950" />
          </a>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Verified Sponsor Network (tag 11581761)</span>
          </div>
        </div>

        {/* 6. Isolated Ad Frame Container (Prevents Globe Popups) */}
        <div className="w-full max-w-md rounded-xl overflow-hidden bg-slate-900/50 border border-slate-800/80">
          <iframe
            ref={adIframeRef}
            title="Sponsor Ads"
            className="w-full h-24 border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>

        {/* 7. Gradient Blue Back to Globe Button */}
        <div className="pt-2">
          <button
            onClick={onBack}
            className="px-6 sm:px-8 py-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-sm transition-all shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-200" />
            <span>Back to 3D Earth Globe</span>
          </button>
        </div>
      </main>
    </div>
  );
};
