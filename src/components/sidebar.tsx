"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Anchor,
  Compass,
  Hourglass,
  LineChart,
  Radar,
  ShieldAlert,
  Ship,
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Overview", sub: "Market pulse", icon: Radar },
  { href: "/forecast", label: "Rate Forecast", sub: "ML projections", icon: LineChart },
  { href: "/timing", label: "Entry Timing", sub: "Fixing windows", icon: Hourglass },
  { href: "/optimizer", label: "Vessel Optimizer", sub: "Port-fit engine", icon: Ship },
  { href: "/idle", label: "Idle Planner", sub: "Demand troughs", icon: Anchor },
  { href: "/risk", label: "Risk Radar", sub: "Disruption watch", icon: ShieldAlert },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-line bg-ink-900/85 backdrop-blur-xl md:flex">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand/90 to-[#b06f16] shadow-[0_8px_22px_-6px_rgba(242,166,59,0.55)]">
          <Compass className="h-5 w-5 text-ink-950" strokeWidth={2.4} />
        </div>
        <div>
          <div className="text-[13.5px] font-bold tracking-[0.18em] text-paper">COROMANDEL</div>
          <div className="eyebrow mt-0.5 !text-[9px]">Freight Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
                active ? "bg-ink-700/70 text-paper" : "text-fog hover:bg-ink-800/70 hover:text-mist"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-brand" />
              )}
              <Icon
                className={clsx("h-[17px] w-[17px] transition-colors", active ? "text-brand" : "text-fog group-hover:text-mist")}
                strokeWidth={1.9}
              />
              <span className="flex-1">
                <span className="block text-[13px] font-medium leading-tight">{item.label}</span>
                <span className="block text-[10px] leading-tight text-fog/70">{item.sub}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-5">
        <div className="panel inset-glow rounded-xl p-3.5">
          <div className="flex items-center gap-2">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-teal" />
            <span className="eyebrow !text-[9.5px]">Model v2.4 · Live</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-fog">
            Holt-damped ensemble
            <br />
            44k rate observations
            <br />
            <span className="num text-mist">MAPE ≈ 6–9%</span> holdout
          </p>
        </div>
        <p className="mt-3 px-1 text-[9.5px] leading-relaxed text-fog/50">
          Indicative analytics for chartering strategy. Not investment advice.
        </p>
      </div>
    </aside>
  );
}
