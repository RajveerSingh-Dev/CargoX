"use client";

import React from 'react';
// Import the ShipMap component from your components folder
import ShipMap from "@/components/shipmap.jsx";

export default function MapPage() {
  return (
    <div className="anim-fade-up relative w-full h-[calc(100vh-140px)] min-h-[600px] rounded-2xl overflow-hidden border border-line shadow-2xl">
      
      {/* 3D Map Component */}
      <ShipMap />
      
      {/* Data Overlay Card */}
      <div className="absolute bottom-8 left-8 z-10 pointer-events-none">
        <div className="panel p-5 bg-ink-900/80 backdrop-blur-md border border-line-strong">
          <h4 className="text-[11px] font-bold text-brand uppercase tracking-[0.1em] mb-2">
            Live Voyage Tracking
          </h4>
          <div className="text-2xl font-extrabold text-paper tracking-tight">
            Newcastle (AU) ➔ Paradip (IN)
          </div>
          <div className="text-[13px] font-medium text-mist mt-1.5">
            Coking Coal · 75,000 MT · ETA: 14.2 Days
          </div>
        </div>
      </div>
      
    </div>
  );
}