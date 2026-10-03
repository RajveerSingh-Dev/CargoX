import { cache } from "react";
import type { MarketEvent, Port } from "@/db/schema";
import {
  analyzeTiming,
  forecastSeries,
  monthName,
  type ForecastResult,
  type TimingAdvice,
} from "./forecast";
import {
  getActiveEvents,
  getClassSeries,
  getClasses,
  getRoutes,
  getSeries,
  type RouteWithPorts,
} from "./queries";

// ------------------------------------------------------------ cached models
export const getRouteForecast = cache(
  async (classId: number, routeId: number, horizon = 180): Promise<ForecastResult & { timing: TimingAdvice }> => {
    const series = await getSeries(classId, routeId);
    const fc = forecastSeries(series, horizon);
    return { ...fc, timing: analyzeTiming(fc) };
  }
);

export const getClassForecast = cache(
  async (classId: number, horizon = 180): Promise<ForecastResult & { timing: TimingAdvice }> => {
    const series = await getClassSeries(classId);
    const fc = forecastSeries(series, horizon);
    return { ...fc, timing: analyzeTiming(fc) };
  }
);

// --------------------------------------------------------------- cyclones
// Bay of Bengal: pre-monsoon (Apr–Jun) & post-monsoon (Oct–Dec) windows.
export function cycloneExposure(dateISO: string): number {
  const m = new Date(dateISO + "T00:00:00Z").getUTCMonth();
  if ([9, 10, 11].includes(m)) return 1.0; // Oct–Dec peak
  if ([3, 4].includes(m)) return 0.85; // Apr–May
  if ([2, 5, 8].includes(m)) return 0.4;
  return 0.12;
}

// ------------------------------------------------------------- risk scores
export interface RiskFactor {
  label: string;
  detail: string;
  weight: number; // 0..100 contribution
  tone: "good" | "warn" | "bad";
}
export interface RouteRisk {
  score: number;
  band: "LOW" | "GUARDED" | "ELEVATED" | "SEVERE";
  factors: RiskFactor[];
}

const BAY_PORTS = ["India EC", "Bay of Bengal"];

export function computeRouteRisk(
  route: RouteWithPorts,
  volPercentile: number,
  events: MarketEvent[],
  todayISO: string
): RouteRisk {
  const factors: RiskFactor[] = [];

  const volW = Math.round(volPercentile * 0.4);
  factors.push({
    label: "Freight volatility regime",
    detail: `Realised vol at the ${volPercentile}th percentile of the trailing two years.`,
    weight: volW,
    tone: volPercentile >= 70 ? "bad" : volPercentile >= 40 ? "warn" : "good",
  });

  const touch = events.filter(
    (e) =>
      e.portId === route.originPortId ||
      e.portId === route.destPortId ||
      e.portId === null
  );
  const evSev = touch.reduce((a, e) => a + e.severity, 0);
  const evW = Math.min(30, Math.round(evSev * 3.4));
  factors.push({
    label: `${touch.length} active disruption signal${touch.length === 1 ? "" : "s"}`,
    detail: touch.length
      ? touch.slice(0, 3).map((e) => e.title).join(" · ")
      : "No live alerts touching this corridor.",
    weight: evW,
    tone: evW >= 20 ? "bad" : evW >= 10 ? "warn" : "good",
  });

  const cong = route.origin.congestionDays + route.dest.congestionDays;
  const congW = Math.min(20, Math.round((cong / 10) * 20));
  factors.push({
    label: "Congestion exposure",
    detail: `${route.origin.name} ${route.origin.congestionDays}d + ${route.dest.name} ${route.dest.congestionDays}d of average waiting.`,
    weight: congW,
    tone: cong >= 6 ? "bad" : cong >= 3 ? "warn" : "good",
  });

  const touchesBay = BAY_PORTS.includes(route.origin.region) || BAY_PORTS.includes(route.dest.region);
  const cyc = touchesBay ? cycloneExposure(todayISO) : 0.1;
  const cycW = Math.round(cyc * 10);
  factors.push({
    label: "Bay of Bengal weather window",
    detail: touchesBay
      ? cyc >= 0.8
        ? "Corridor sits inside an active cyclone season window — carry weather rerouting clauses."
        : cyc >= 0.4
          ? "Shoulder season — monitor IMD bulletins before fixing open laycans."
          : "Outside the primary cyclone windows."
      : "Corridor largely outside Bay of Bengal cyclone tracks.",
    weight: cycW,
    tone: cyc >= 0.8 ? "bad" : cyc >= 0.4 ? "warn" : "good",
  });

  const score = Math.min(100, factors.reduce((a, f) => a + f.weight, 0));
  const band = score >= 70 ? "SEVERE" : score >= 50 ? "ELEVATED" : score >= 30 ? "GUARDED" : "LOW";
  return { score, band, factors };
}

// ------------------------------------------------------------ idle engine
export interface RepositionOption {
  routeCode: string;
  origin: string;
  dest: string;
  commodity: string;
  fwd30: number;
  trendPct30: number;
  premiumPct: number; // vs class median fwd30
  ballastDays: number; // implied positioning from an EC India discharge
  score: number;
}

export interface IdlePlan {
  classCode: string;
  softMonths: { name: string; idx: number; nextDate: string }[];
  peakMonths: { name: string; idx: number }[];
  demandOutlook: string;
  reposition: RepositionOption[];
  actions: string[];
}

const IDLE_OPEX: Record<string, number> = { HANDY: 5600, SUPRAMAX: 6300, PANAMAX: 6900, CAPE: 7900 };

export const buildIdlePlan = cache(async (classCode: string): Promise<IdlePlan | null> => {
  const classes = await getClasses();
  const cls = classes.find((c) => c.code === classCode);
  if (!cls) return null;
  const fc = await getClassForecast(cls.id, 120);
  const routes = await getRoutes();
  const todayISO = new Date().toISOString().slice(0, 10);

  // seasonal soft windows with next occurrence dates
  const soft = fc.stats.softMonths.slice(0, 3).map((m) => {
    const now = new Date(todayISO + "T00:00:00Z");
    let d = new Date(Date.UTC(now.getUTCFullYear(), m.index, 15));
    if (d < now) d = new Date(Date.UTC(now.getUTCFullYear() + 1, m.index, 15));
    return { name: monthName(m.index), idx: m.idx, nextDate: d.toISOString().slice(0, 10) };
  });

  // per-route forward means → repositioning board
  const perRoute: RepositionOption[] = [];
  for (const r of routes) {
    // skip routes the class physically cannot trade (draft hard failure both ends)
    if (cls.draftM > r.origin.maxDraftM || cls.draftM > r.dest.maxDraftM) continue;
    if ((r.origin.gearedRequired && !cls.geared) || (r.dest.gearedRequired && !cls.geared)) continue;
    const rf = await getRouteForecast(cls.id, r.id, 90);
    const ballastNm = r.distanceNm * 0.45;
    perRoute.push({
      routeCode: r.code,
      origin: r.origin.name,
      dest: r.dest.name,
      commodity: r.commodity,
      fwd30: rf.stats.fwd30,
      trendPct30: rf.stats.trendPct30,
      premiumPct: 0,
      ballastDays: Math.round((ballastNm / (cls.speedKnots * 24)) * 10) / 10,
      score: 0,
    });
  }
  const med = [...perRoute].sort((a, b) => a.fwd30 - b.fwd30)[Math.floor(perRoute.length / 2)];
  for (const r of perRoute) {
    r.premiumPct = med && med.fwd30 > 0 ? Math.round(((r.fwd30 - med.fwd30) / med.fwd30) * 1000) / 10 : 0;
    r.score = Math.round(r.fwd30 / Math.max(3, 1 + r.ballastDays) + r.premiumPct * 22);
  }
  const reposition = perRoute.sort((a, b) => b.score - a.score).slice(0, 6);

  const softNames = soft.map((s) => s.name).join(" / ") || "—";
  const actions: string[] = [
    soft.length
      ? `Schedule dockings, surveys and crew change into the ${softNames} soft patch — expect market earnings ~${Math.round((1 - soft[0].idx) * 100)}% below trend.`
      : "No material seasonal trough ahead — keep tonnage continuously employed.",
    reposition.length
      ? `Highest-yield repositioning: ballast toward ${reposition[0].origin} for ${reposition[0].commodity} stems — forward 30-day earnings run ${reposition[0].premiumPct >= 0 ? "+" : ""}${reposition[0].premiumPct}% vs fleet median with ${reposition[0].ballastDays} ballast days.`
      : "Hold current position — no corridor shows a meaningful earnings premium.",
    fc.stats.trendPct30 < -2
      ? `Tape softening ${Math.abs(fc.stats.trendPct30).toFixed(1)}% into next month — favour short hauls and quick redelivery over long repositioning gambles.`
      : fc.stats.trendPct30 > 2
        ? `Tape firming ${fc.stats.trendPct30.toFixed(1)}% — trade prompt and re-let at higher levels rather than locking long commitments.`
        : `Flat tape — prioritise certainty of employment over speculative positioning.`,
    `Pre-book laycans 10–14 days forward when idle probability rises; an idle ${cls.name} burns ~$${(IDLE_OPEX[cls.code] ?? 6500).toLocaleString()}/day in opex + finance with zero revenue.`,
  ];

  const demandOutlook =
    fc.stats.trendPct90 < -3
      ? `Demand pipeline for the ${cls.name} segment weakens over the quarter — proactively line up COA cover and guard against open positions.`
      : fc.stats.trendPct90 > 3
        ? `Cargo enquiry tape points to a tightening ${cls.name} market across the quarter — idle risk is low; leverage for rate.`
        : `Balanced demand outlook for ${cls.name} tonnage — idle risk concentrates around the ${softNames} seasonal trough.`;

  return {
    classCode,
    softMonths: soft,
    peakMonths: fc.stats.peakMonths.slice(0, 3).map((m) => ({ name: monthName(m.index), idx: m.idx })),
    demandOutlook,
    reposition,
    actions,
  };
});

// ------------------------------------------------------- market-wide board
export interface MarketBoard {
  classes: {
    id: number;
    code: string;
    name: string;
    fc: ForecastResult & { timing: TimingAdvice };
  }[];
  events: MarketEvent[];
  todayISO: string;
}

export const getMarketBoard = cache(async (): Promise<MarketBoard> => {
  const [classes, events] = await Promise.all([getClasses(), getActiveEvents()]);
  const out: MarketBoard["classes"] = [];
  for (const c of classes) {
    out.push({ id: c.id, code: c.code, name: c.name, fc: await getClassForecast(c.id) });
  }
  const latest = out[0]?.fc.points[0];
  void latest;
  const todayISO = new Date().toISOString().slice(0, 10);
  return { classes: out, events, todayISO };
});

export type { Port };
