"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Loader2, Route, Waves } from "lucide-react";
import { Badge, Card, Delta, SectionLabel, fmtDateShort } from "@/components/ui";
import { ForecastChart, LegendRow } from "@/components/charts";

interface ApiPayload {
  meta: {
    classes: { id: number; code: string; name: string; dwt: number; draft: number; loa: number; geared: boolean }[];
    routes: {
      id: number; code: string; nm: number; commodity: string; direction: string;
      origin: { id: number; name: string; code: string };
      dest: { id: number; name: string; code: string };
    }[];
  };
  selection: { classCode: string; routeId: number; horizon: number };
  route: { code: string; commodity: string; direction: string; nm: number; origin: string; dest: string };
  history: { date: string; value: number }[];
  points: { date: string; p10: number; p25: number; p50: number; p75: number; p90: number; monthIdx: number }[];
  stats: {
    spot: number; holdoutMape: number; sigmaPct: number; vol20: number; vol60: number;
    volPercentile: number; trendPct30: number; trendPct90: number; fwd30: number; fwd90: number;
    fwd180: number; spotPercentile: number; monthIndices: number[]; alpha: number; beta: number; phi: number;
    softMonths: { index: number; idx: number }[]; peakMonths: { index: number; idx: number }[];
  };
  timing: {
    verdict: string; tone: "good" | "warn" | "bad"; headline: string; rationale: string[];
    confidence: { score: number; label: string };
    cheapestWindows: { label: string; windowDays: number; startDate: string; endDate: string; avgRate: number; vsSpotPct: number }[];
    spotVsPeriod: { spotPath180: number; fixedRefRate: number; tailRiskCost: number; periodSavingPct: number; recommendation: string };
  };
}

const HORIZONS = [60, 120, 180, 365];
const MONTH_L = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function ForecastExplorer({ initialClass, initialRoute }: { initialClass?: string; initialRoute?: number }) {
  const [classCode, setClassCode] = useState(initialClass ?? "SUPRAMAX");
  const [routeId, setRouteId] = useState<number | null>(initialRoute ?? null);
  const [horizon, setHorizon] = useState(180);
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ class: classCode, horizon: String(horizon) });
    if (routeId) q.set("route", String(routeId));
    fetch(`/api/forecast?${q}`)
      .then((r) => r.json())
      .then((d: ApiPayload) => {
        if (cancelled) return;
        setData(d);
        if (!routeId) setRouteId(d.selection.routeId);
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [classCode, routeId, horizon]);

  const softSet = useMemo(() => new Set((data?.stats.softMonths ?? []).map((m) => m.index)), [data]);
  const peakSet = useMemo(() => new Set((data?.stats.peakMonths ?? []).map((m) => m.index)), [data]);

  return (
    <div className="space-y-4">
      {/* controls */}
      <Card className="anim-fade-up">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div>
            <p className="eyebrow mb-2">Vessel segment</p>
            <div className="flex flex-wrap gap-1.5">
              {(data?.meta.classes ?? [{ code: "HANDY", name: "Handysize" }, { code: "SUPRAMAX", name: "Supramax" }, { code: "PANAMAX", name: "Panamax" }, { code: "CAPE", name: "Capesize" }]).map((c) => (
                <button
                  key={c.code}
                  onClick={() => setClassCode(c.code)}
                  className={clsx(
                    "rounded-lg border px-3.5 py-2 text-[12px] font-semibold transition-all",
                    classCode === c.code
                      ? "border-brand/50 bg-brand/15 text-brand-soft shadow-[0_0_18px_-4px_rgba(242,166,59,0.5)]"
                      : "border-line bg-ink-800/60 text-fog hover:border-line-strong hover:text-mist"
                  )}
                >
                  {"dwt" in c ? c.code : c.code}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-[240px] flex-1">
            <p className="eyebrow mb-2">Trade corridor</p>
            <div className="relative">
              <Route className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
              <select
                value={routeId ?? ""}
                onChange={(e) => setRouteId(Number(e.target.value))}
                className="w-full appearance-none rounded-lg border border-line bg-ink-800/80 py-2.5 pl-9 pr-8 text-[12.5px] font-medium text-paper outline-none transition-colors focus:border-brand/50"
              >
                {(data?.meta.routes ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.origin.name} → {r.dest.name} · {r.commodity} · {r.nm.toLocaleString()}nm
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-fog">▼</span>
            </div>
          </div>

          <div>
            <p className="eyebrow mb-2">Horizon</p>
            <div className="flex rounded-lg border border-line bg-ink-800/60 p-1">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={clsx(
                    "num rounded-md px-3.5 py-1.5 text-[11.5px] font-semibold transition-all",
                    horizon === h ? "bg-brand text-ink-950" : "text-fog hover:text-mist"
                  )}
                >
                  {h}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* chart */}
      <Card className={clsx("anim-fade-up transition-opacity", loading && "opacity-50")}>
        <SectionLabel
          right={
            <div className="flex items-center gap-4">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />}
              <LegendRow
                items={[
                  { color: "#e8edf8", label: "Actual TCE" },
                  { color: "#f2a63b", label: "P50 forecast" },
                  { color: "rgba(242,166,59,0.35)", label: "P25–P75 / P10–P90" },
                ]}
              />
            </div>
          }
        >
          {data ? `${data.route.origin} → ${data.route.dest} · ${data.route.commodity}` : "Loading corridor…"}
        </SectionLabel>

        {data && !("error" in data) ? (
          <>
            <ForecastChart history={data.history} forecast={data.points} height={380} />
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line/60 pt-4 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ["Spot TCE", `$${data.stats.spot.toLocaleString()}`],
                ["Fwd 30d", `$${data.stats.fwd30.toLocaleString()} (${data.stats.trendPct30 > 0 ? "+" : ""}${data.stats.trendPct30}%)`],
                ["Fwd 90d", `$${data.stats.fwd90.toLocaleString()} (${data.stats.trendPct90 > 0 ? "+" : ""}${data.stats.trendPct90}%)`],
                ["Fwd 180d", `$${data.stats.fwd180.toLocaleString()}`],
                ["Holdout MAPE", `${data.stats.holdoutMape}%`],
                ["Vol 20d ann.", `${data.stats.vol20}% · P${data.stats.volPercentile}`],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="eyebrow !text-[9px]">{l}</p>
                  <p className="num mt-1 text-[13px] font-semibold text-paper">{v}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-[380px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        )}
      </Card>

      {data && !("error" in data) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
          {/* timing */}
          <Card className="anim-fade-up">
            <SectionLabel right={<Badge tone={data.timing.tone}>{data.timing.verdict}</Badge>}>Entry timing · this corridor</SectionLabel>
            <p className="display-italic text-[19px] leading-snug text-paper">{data.timing.headline}</p>
            <ul className="mt-3 space-y-2">
              {data.timing.rationale.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed text-mist">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                  {r}
                </li>
              ))}
            </ul>
            <div className="mt-5 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-line bg-ink-800/60 text-[9.5px] uppercase tracking-[0.14em] text-fog">
                    <th className="px-3.5 py-2.5 font-medium">Window</th>
                    <th className="px-3.5 py-2.5 font-medium">Optimal entry</th>
                    <th className="px-3.5 py-2.5 font-medium">Avg rate</th>
                    <th className="px-3.5 py-2.5 text-right font-medium">vs spot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/50">
                  {data.timing.cheapestWindows.map((w) => (
                    <tr key={w.label} className="transition-colors hover:bg-ink-800/40">
                      <td className="num px-3.5 py-2.5 font-semibold text-paper">{w.label}</td>
                      <td className="num px-3.5 py-2.5 text-mist">
                        {fmtDateShort(w.startDate)} → {fmtDateShort(w.endDate)}
                      </td>
                      <td className="num px-3.5 py-2.5 text-paper">${w.avgRate.toLocaleString()}</td>
                      <td className="px-3.5 py-2.5 text-right"><Delta value={w.vsSpotPct} invert /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 rounded-xl border border-teal/20 bg-teal/[0.05] px-3.5 py-3 text-[11.5px] leading-relaxed text-teal/90">
              {data.timing.spotVsPeriod.recommendation}
            </p>
          </Card>

          {/* seasonality + model */}
          <div className="space-y-4">
            <Card className="anim-fade-up">
              <SectionLabel>Seasonal structure</SectionLabel>
              <div className="flex h-[150px] items-end gap-1.5">
                {data.stats.monthIndices.map((v, i) => {
                  const isSoft = softSet.has(i);
                  const isPeak = peakSet.has(i);
                  const h = Math.min(96, Math.max(14, (v - 0.82) * 330));
                  return (
                    <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
                      <span className={clsx("num text-[9px] opacity-0 transition-opacity group-hover:opacity-100", isSoft ? "text-teal" : isPeak ? "text-rose" : "text-fog")}>
                        {(v * 100).toFixed(0)}
                      </span>
                      <div
                        className={clsx(
                          "heat-cell w-full rounded-t-md",
                          isSoft ? "bg-gradient-to-t from-teal/30 to-teal/70" : isPeak ? "bg-gradient-to-t from-rose/30 to-rose/70" : "bg-gradient-to-t from-ink-600 to-mist/30"
                        )}
                        style={{ height: `${h}%` }}
                        title={`Index ${v.toFixed(3)}`}
                      />
                      <span className={clsx("num text-[9.5px]", isSoft ? "text-teal" : isPeak ? "text-rose" : "text-fog")}>{MONTH_L[i]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-5 text-[10px] text-fog">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-teal/70" /> trough — cheap fixing window</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose/70" /> seasonal peak</span>
              </div>
            </Card>

            <Card className="anim-fade-up">
              <SectionLabel right={<Waves className="h-3.5 w-3.5 text-fog" />}>Model internals</SectionLabel>
              <div className="space-y-2.5 text-[12px]">
                {[
                  ["Architecture", "Seasonal × damped-Holt ensemble"],
                  ["Parameters", `α ${data.stats.alpha} · β ${data.stats.beta} · φ ${data.stats.phi}`],
                  ["Residual σ (daily)", `${data.stats.sigmaPct}%`],
                  ["Holdout MAPE (60d)", `${data.stats.holdoutMape}%`],
                  ["Confidence score", `${data.timing.confidence.score}% — ${data.timing.confidence.label}`],
                ].map(([l, v]) => (
                  <div key={l} className="flex items-baseline justify-between gap-4 border-b border-line/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-fog">{l}</span>
                    <span className="num text-right text-paper">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[9.5px] text-fog"><span>accuracy</span><span>error →</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal to-brand"
                    style={{ width: `${Math.max(4, Math.min(100, data.stats.holdoutMape * 4))}%` }}
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
