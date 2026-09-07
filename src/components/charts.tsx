"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import clsx from "clsx";
import type { ForecastPoint } from "@/lib/forecast";

const fmtShort = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};
const usdK = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`);

// ---------------------------------------------------------------- sparkline
export function Spark({ data, up, height = 44 }: { data: number[]; up: boolean; height?: number }) {
  const pts = data.map((v, i) => ({ i, v }));
  const color = up ? "#2bd9c7" : "#fb5e7e";
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pts} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={`spark-${up ? "up" : "dn"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#spark-${up ? "up" : "dn"})`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------- forecast chart
interface HistPoint {
  date: string;
  value: number;
}

function ForecastTip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  const hist = get("hist");
  const p50 = get("p50");
  return (
    <div className="panel !rounded-lg px-3 py-2.5 text-[11px] shadow-xl">
      <div className="eyebrow !text-[9px] mb-1.5">{label ? fmtFull(label) : ""}</div>
      <div className="space-y-1 font-mono">
        {hist != null && (
          <div className="flex items-center justify-between gap-6">
            <span className="text-fog">Actual TCE</span>
            <span className="text-paper">${Number(hist).toLocaleString()}</span>
          </div>
        )}
        {p50 != null && (
          <>
            <div className="flex items-center justify-between gap-6">
              <span className="text-fog">Forecast P50</span>
              <span className="text-brand-soft">${Number(p50).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-fog">Band P10–P90</span>
              <span className="text-mist">
                ${Number(get("oLo") ?? 0).toLocaleString()} – ${Number((get("oLo") ?? 0) + (get("outer") ?? 0)).toLocaleString()}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
const fmtFull = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });

export function ForecastChart({
  history,
  forecast,
  height = 380,
  showBands = true,
  accent = "#f2a63b",
  histColor = "#e8edf8",
}: {
  history: HistPoint[];
  forecast: ForecastPoint[];
  height?: number;
  showBands?: boolean;
  accent?: string;
  histColor?: string;
}) {
  const histTrim = history.slice(-240);
  const boundary = histTrim[histTrim.length - 1]?.date;
  const data = [
    ...histTrim.map((p) => ({ date: p.date, hist: p.value })),
    ...(histTrim.length && forecast.length
      ? [{ date: boundary!, hist: histTrim[histTrim.length - 1].value, p50: histTrim[histTrim.length - 1].value, oLo: histTrim[histTrim.length - 1].value - 0, outer: 0, iLo: 0, inner: 0 }]
      : []),
    ...forecast.map((p) => ({ date: p.date, p50: p.p50, oLo: p.p10, outer: p.p90 - p.p10, iLo: p.p25, inner: p.p75 - p.p25 })),
  ];
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="fcOuter" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.1} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(126,152,206,0.07)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtShort} tickLine={false} axisLine={false} minTickGap={48} dy={6} />
          <YAxis tickFormatter={usdK} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} />
          <Tooltip content={<ForecastTip />} cursor={{ stroke: "rgba(126,152,206,0.3)" }} />
          {showBands && (
            <>
              <Area type="monotone" dataKey="oLo" stackId="outer" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" tooltipType="none" />
              <Area type="monotone" dataKey="outer" stackId="outer" stroke="none" fill={accent} fillOpacity={0.09} isAnimationActive={false} legendType="none" tooltipType="none" />
              <Area type="monotone" dataKey="iLo" stackId="inner" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" tooltipType="none" />
              <Area type="monotone" dataKey="inner" stackId="inner" stroke="none" fill={accent} fillOpacity={0.16} isAnimationActive={false} legendType="none" />
            </>
          )}
          <Line type="monotone" dataKey="hist" stroke={histColor} strokeWidth={1.7} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="p50" stroke={accent} strokeWidth={2} strokeDasharray="0" dot={false} isAnimationActive={false} />
          {boundary && (
            <ReferenceLine
              x={boundary}
              stroke="rgba(126,152,206,0.35)"
              strokeDasharray="3 4"
              label={{ value: "TODAY", position: "top", fill: "#5d6c8a", fontSize: 9, fontFamily: "JetBrains Mono" }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- gauge
export function Gauge({
  value,
  label,
  size = "md",
  caption,
}: {
  value: number; // 0..100
  label: string;
  size?: "sm" | "md";
  caption?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const R = 56;
  const C = Math.PI * R; // semicircle length
  const color = v >= 66 ? "#fb5e7e" : v >= 40 ? "#f2a63b" : "#2bd9c7";
  const w = size === "md" ? 150 : 120;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 82" width={w} className="overflow-visible">
        <path d="M 14 70 A 56 56 0 0 1 126 70" fill="none" stroke="rgba(126,152,206,0.14)" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M 14 70 A 56 56 0 0 1 126 70"
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * C} ${C}`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)", filter: `drop-shadow(0 0 10px ${color}55)` }}
        />
        {[0, 25, 50, 75, 100].map((t) => {
          const angle = Math.PI * (1 - t / 100);
          const x1 = 70 + (R - 9) * Math.cos(angle);
          const y1 = 70 - (R - 9) * Math.sin(angle);
          const x2 = 70 + (R - 2) * Math.cos(angle);
          const y2 = 70 - (R - 2) * Math.sin(angle);
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(126,152,206,0.3)" strokeWidth="1.4" />;
        })}
        <text x="70" y="56" textAnchor="middle" fill={color} fontSize="24" fontWeight="700" fontFamily="JetBrains Mono">
          {Math.round(v)}
        </text>
      </svg>
      <span className="eyebrow !text-[9.5px] -mt-1.5">{label}</span>
      {caption && <span className="mt-1 text-[10.5px] text-fog">{caption}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- legend row
export function LegendRow({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2 text-[10.5px] text-fog">
          <span className={clsx("h-[3px] w-5 rounded-full")} style={{ background: i.color, opacity: i.dashed ? 0.7 : 1, ...(i.dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` } : {}) }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
