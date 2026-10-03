"use client";
import { CurrencyToggle } from "@/components/currencyToggle"; // Adjust path if necessary
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  TrendingUp,
  CalendarClock,
  Anchor,
  Clock,
  AlertTriangle,
  Globe,
  Bot,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "Overview", sub: "Market pulse & ROI", icon: Compass },
  { href: "/forecast", label: "Rate Forecast", sub: "ML projections", icon: TrendingUp },
  { href: "/timing", label: "Entry Timing", sub: "Fixing windows", icon: CalendarClock },
  { href: "/optimizer", label: "Vessel Optimizer", sub: "Port-fit engine", icon: Anchor },
  { href: "/idle", label: "Idle Planner", sub: "Demand troughs", icon: Clock },
  { href: "/risk", label: "Risk Radar", sub: "Disruption watch", icon: AlertTriangle },
  { href: "/map", label: "Live Operations", sub: "3D geospatial tracking", icon: Globe },
  { href: "/chat", label: "Copilot AI", sub: "Interactive assistant", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-line bg-ink-900/80 backdrop-blur-xl md:flex">
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-ink-950 shadow-[0_0_16px_rgba(242,166,59,0.35)]">
          <Anchor className="h-5 w-5" strokeWidth={2.4} />
        </div>
        <div>
          <div className="flex items-center gap-1 text-[15px] font-extrabold tracking-wide text-paper">
            <span>Cargo<span className="text-brand">X</span></span>
          </div>
          <div className="eyebrow !text-[9px] text-fog">Freight Intelligence</div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 transition-all ${
                isActive
                  ? "border-brand bg-brand/[0.08] text-paper shadow-sm"
                  : "border-transparent text-mist hover:border-line-strong hover:bg-ink-800/50 hover:text-paper"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive ? "text-brand" : "text-fog group-hover:text-mist"
                }`}
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`text-[13px] font-medium leading-none ${
                    isActive ? "font-semibold text-paper" : ""
                  }`}
                >
                  {item.label}
                </div>
                <div className="mt-1 truncate text-[10.5px] text-fog">
                  {item.sub}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Settings & Status Footer */}
      <div className="space-y-4 border-t border-line p-4">
        {/* Appearance Toggle */}
        <CurrencyToggle />
        <ThemeToggle />

        {/* Live Model Indicator */}
        <div className="border-t border-line/60 pt-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal"></span>
            </span>
            <span className="eyebrow !text-[9.5px] font-bold text-mist">
              MODEL V2.4 · LIVE
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-fog">
            Local offline-first ensemble
            <br />
            44k rate observations
          </p>
        </div>
      </div>
    </aside>
  );
}