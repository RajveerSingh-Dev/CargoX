"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import ShipMap with SSR disabled so WebGL only runs in the browser
const ShipMap = dynamic(() => import("@/components/shipmap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full min-h-[600px] flex-col items-center justify-center gap-3 bg-slate-950 text-mist">
      <Loader2 className="h-7 w-7 animate-spin text-brand" />
      <span className="num text-[12px] uppercase tracking-wider text-fog">
        Loading 3D Maritime Digital Twin…
      </span>
    </div>
  ),
});

export default function MapPage() {
  return (
    <div className="anim-fade-up relative h-[calc(100vh-140px)] min-h-[600px] w-full overflow-hidden rounded-2xl border border-line shadow-2xl">
      {/* 3D Map Component (Safe from SSR build evaluation) */}
      <ShipMap />

      {/* Data Overlay Card */}
      <div className="pointer-events-none absolute bottom-8 left-8 z-10">
        <div className="panel border border-line-strong bg-ink-900/80 p-5 backdrop-blur-md">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-brand">
            Live Voyage Tracking
          </h4>
          <div className="text-2xl font-extrabold tracking-tight text-paper">
            Gladstone(AU) ➔ Paradip (IN)
          </div>
          <div className="mt-1.5 text-[13px] font-medium text-mist">
            Coking Coal · 165,000 MT · ETA: 4.2 Days
          </div>
        </div>
      </div>
    </div>
  );
}