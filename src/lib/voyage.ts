import type { Port, VesselClass } from "@/db/schema";
import type { RouteWithPorts } from "./queries";

export const BUNKER_PRICE_USD = 645; // VLSFO $/t reference (Singapore/Colombo blend)

export interface ConstraintCheck {
  rule: string;
  pass: boolean;
  critical: boolean;
  detail: string;
}

export function checkConstraints(
  cls: VesselClass,
  origin: Port,
  dest: Port,
  cargoT: number
): ConstraintCheck[] {
  const checks: ConstraintCheck[] = [];
  const fmt = (n: number) => n.toLocaleString();

  // Draft — laden arrival at load port, laden departure, and laden arrival at discharge
  for (const [label, port] of [
    ["load", origin],
    ["discharge", dest],
  ] as const) {
    const margin = port.maxDraftM - cls.draftM;
    checks.push({
      rule: `Draft @ ${label} — ${port.name}`,
      pass: margin >= 0.05,
      critical: true,
      detail:
        margin >= 0.05
          ? `${cls.name} laden draft ${cls.draftM}m clears ${port.maxDraftM}m restriction (+${margin.toFixed(1)}m margin)`
          : `${cls.name} draws ${cls.draftM}m vs ${port.maxDraftM}m max — ${Math.abs(margin).toFixed(1)}m overstressed; would require lighterage`,
    });
  }
  // LOA
  for (const [label, port] of [
    ["load", origin],
    ["discharge", dest],
  ] as const) {
    const ok = cls.loaM <= port.maxLoaM;
    checks.push({
      rule: `LOA @ ${label} — ${port.name}`,
      pass: ok,
      critical: true,
      detail: ok
        ? `${cls.loaM}m ≤ ${port.maxLoaM}m berth limit`
        : `${cls.loaM}m exceeds ${port.maxLoaM}m berth limit — cannot tie up`,
    });
  }
  // DWT ceiling
  for (const [label, port] of [
    ["load", origin],
    ["discharge", dest],
  ] as const) {
    if (!port.maxDwt) continue;
    const ok = cls.typicalDwt <= port.maxDwt;
    checks.push({
      rule: `Size ceiling @ ${label} — ${port.name}`,
      pass: ok,
      critical: true,
      detail: ok
        ? `${fmt(cls.typicalDwt)} dwt within ${fmt(port.maxDwt)} dwt port ceiling`
        : `${fmt(cls.typicalDwt)} dwt above ${fmt(port.maxDwt)} dwt port ceiling`,
    });
  }
  // Gear requirement
  for (const [label, port] of [
    ["load", origin],
    ["discharge", dest],
  ] as const) {
    if (!port.gearedRequired) continue;
    checks.push({
      rule: `Ship's gear @ ${label} — ${port.name}`,
      pass: cls.geared,
      critical: true,
      detail: cls.geared
        ? `${port.name} has no shore bulk handling — ${cls.name} cranes handle the cargo`
        : `${port.name} requires geared tonnage; ${cls.name} is gearless — disallowed`,
    });
  }
  // Parcel fit
  const ul = cargoT / cls.typicalDwt;
  checks.push({
    rule: "Parcel fit",
    pass: ul <= 1.02 && ul >= 0.45,
    critical: ul > 1.02,
    detail:
      ul > 1.02
        ? `${fmt(cargoT)}t exceeds a single ${cls.name} lift (${fmt(cls.typicalDwt)}t) — needs ${Math.ceil(ul)} fixtures or a split`
        : ul < 0.45
          ? `${fmt(cargoT)}t uses only ${Math.round(ul * 100)}% of ${cls.name} capacity — deadfreight risk`
          : `${fmt(cargoT)}t = ${Math.round(ul * 100)}% capacity utilisation`,
  });
  return checks;
}

export interface VoyagePlan {
  seaDays: number;
  loadDays: number;
  dischargeDays: number;
  waitDays: number;
  totalDays: number;
  bunkerSeaT: number;
  bunkerPortT: number;
  bunkerCostUsd: number;
  hireCostUsd: number;
  portFeesUsd: number;
  totalCostUsd: number;
  costPerTonUsd: number;
  dailyHireUsd: number;
}

export function calcVoyage(
  cls: VesselClass,
  route: RouteWithPorts,
  cargoT: number,
  dailyHireUsd: number,
  bunkerPrice = BUNKER_PRICE_USD
): VoyagePlan {
  const seaDays = route.distanceNm / (cls.speedKnots * 24);
  const loadDays = cargoT / route.origin.loadRateTpd;
  const dischargeDays = cargoT / route.dest.dischargeRateTpd;
  const waitDays = route.origin.congestionDays + route.dest.congestionDays;
  const operational = 1.4; // berthing, docs, surveys both ends
  const totalDays = seaDays + loadDays + dischargeDays + waitDays + operational;

  const bunkerSeaT = seaDays * cls.consSeaTpd;
  const bunkerPortT = (loadDays + dischargeDays + waitDays + operational) * cls.consPortTpd;
  const bunkerCostUsd = (bunkerSeaT + bunkerPortT) * bunkerPrice;
  const hireCostUsd = totalDays * dailyHireUsd;
  const portFeesUsd = route.origin.portFeeUsd + route.dest.portFeeUsd;
  const totalCostUsd = hireCostUsd + bunkerCostUsd + portFeesUsd;

  return {
    seaDays: Math.round(seaDays * 10) / 10,
    loadDays: Math.round(loadDays * 10) / 10,
    dischargeDays: Math.round(dischargeDays * 10) / 10,
    waitDays: Math.round(waitDays * 10) / 10,
    totalDays: Math.round(totalDays * 10) / 10,
    bunkerSeaT: Math.round(bunkerSeaT),
    bunkerPortT: Math.round(bunkerPortT),
    bunkerCostUsd: Math.round(bunkerCostUsd),
    hireCostUsd: Math.round(hireCostUsd),
    portFeesUsd,
    totalCostUsd: Math.round(totalCostUsd),
    costPerTonUsd: Math.round((totalCostUsd / cargoT) * 100) / 100,
    dailyHireUsd,
  };
}

export interface Candidate {
  cls: VesselClass;
  feasible: boolean;
  checks: ConstraintCheck[];
  utilizationPct: number;
  plan: VoyagePlan | null;
  reasons: string[];
  warnings: string[];
}

export interface OptimizationResult {
  origin: Port;
  dest: Port;
  route: RouteWithPorts | null;
  distanceNm: number;
  cargoT: number;
  candidates: Candidate[];
  best: Candidate | null;
  narrative: string[];
  multiFixtureNote: string | null;
}

export function optimizeFleet(
  classes: VesselClass[],
  route: RouteWithPorts | null,
  origin: Port,
  dest: Port,
  distanceNm: number,
  cargoT: number,
  hireByClass: Record<string, number>
): OptimizationResult {
  const effectiveRoute: RouteWithPorts =
    route ??
    ({
      id: 0,
      code: "ADHOC",
      originPortId: origin.id,
      destPortId: dest.id,
      distanceNm,
      commodity: "General Bulk",
      direction: "IMPORT",
      notes: null,
      origin,
      dest,
    } as RouteWithPorts);

  const candidates: Candidate[] = classes.map((cls) => {
    const checks = checkConstraints(cls, origin, dest, cargoT);
    const hardFails = checks.filter((c) => c.critical && !c.pass);
    const feasible = hardFails.length === 0;
    const util = cargoT / cls.typicalDwt;
    const hire = hireByClass[cls.code] ?? 0;
    const plan = feasible ? calcVoyage(cls, effectiveRoute, cargoT, hire) : null;

    const reasons: string[] = [];
    const warnings: string[] = [];
    if (feasible && plan) {
      reasons.push(
        `Completes the ${distanceNm.toLocaleString()}nm round voyage in ${plan.totalDays} days at an all-in $${plan.costPerTonUsd.toFixed(2)}/t (hire $${hire.toLocaleString()}/day forward).`
      );
      const minDraft = Math.min(
        origin.maxDraftM - cls.draftM,
        dest.maxDraftM - cls.draftM
      );
      if (minDraft > 2.5) warnings.push(`${minDraft.toFixed(1)}m worst draft margin — comfortably inside restrictions but paying for unused depth.`);
      if (util < 0.7) warnings.push(`Only ${Math.round(util * 100)}% of the ${cls.name} parcel is used — deadfreight inflates $/t.`);
      if (origin.gearedRequired || dest.gearedRequired)
        reasons.push(`Self-sustaining cranes discharging ${cls.geared ? "" : "(n/a)"} at ${(origin.gearedRequired ? origin.name : dest.name)} — no shore-gear dependency or idle standby.`);
      const worstCong = origin.congestionDays > dest.congestionDays ? origin : dest;
      if (worstCong.congestionDays >= 3)
        warnings.push(`${worstCong.name} congestion running ${worstCong.congestionDays} days — ${Math.round((worstCong.congestionDays / plan.totalDays) * 100)}% of voyage time could be idle; demurrage cover advised.`);
    } else {
      for (const f of hardFails) reasons.push(f.detail);
    }
    return {
      cls,
      feasible,
      checks,
      utilizationPct: Math.round(util * 100),
      plan,
      reasons,
      warnings,
    };
  });

  const feas = candidates
    .filter((c) => c.feasible && c.plan)
    .sort((a, b) => (a.plan!.costPerTonUsd - b.plan!.costPerTonUsd) || (b.utilizationPct - a.utilizationPct));
  const best = feas[0] ?? null;

  const narrative: string[] = [];
  let multiFixtureNote: string | null = null;
  const maxLift = Math.max(...classes.map((c) => c.maxDwt));
  if (cargoT > maxLift * 1.02) {
    multiFixtureNote = `${cargoT.toLocaleString()}t exceeds any single fixture (${maxLift.toLocaleString()} dwt ceiling). Programme splits into ${Math.ceil(cargoT / maxLift)} stem${Math.ceil(cargoT / maxLift) > 2 ? "s" : ""} — rankings below are computed per-parcel on a pro-rata basis.`;
  }
  if (best && best.plan) {
    const alt = feas[1];
    narrative.push(
      `${best.cls.name} is the optimal employment: $${best.plan.costPerTonUsd.toFixed(2)}/t all-in, ${best.plan.totalDays}-day turn, ${best.utilizationPct}% capacity utilisation.`
    );
    if (alt?.plan) {
      const diff = alt.plan.costPerTonUsd - best.plan.costPerTonUsd;
      narrative.push(
        diff > 0.4
          ? `Nearest alternative (${alt.cls.name}) is $${diff.toFixed(2)}/t dearer — a firm reject unless laycans force the issue.`
          : `${alt.cls.name} is within $${diff.toFixed(2)}/t — keep both quotes live to preserve negotiating leverage.`
      );
    }
    const both = [origin, dest].filter((p) => p.congestionDays >= 3);
    if (both.length)
      narrative.push(
        `Congestion at ${both.map((p) => p.name).join(" & ")} adds ~${both.reduce((a, p) => a + p.congestionDays, 0).toFixed(1)} idle days — consider re-sequencing discharge or rival berths to protect the schedule.`
      );
  } else {
    narrative.push("No single vessel class satisfies every hard constraint on this pairing. Review the violations below — the practical fix is a geared segment or a transhipment hub.");
  }

  return {
    origin, dest, route: route ?? null, distanceNm, cargoT,
    candidates, best, narrative, multiFixtureNote,
  };
}

// Haversine fallback when an ad-hoc pair has no curated route distance
export function estDistanceNm(a: Port, b: Port, base?: number): number {
  if (base) return base;
  // regional proxy: Bay of Bengal short-sea < 800, ISC < 2500, EC Aus/SAf 3,800-5,000
  const sameRegion = a.region === b.region;
  if (sameRegion) return 850;
  const deepSea = ["EC Australia", "Southern Africa", "SE Africa", "North China"];
  if (deepSea.includes(a.region) || deepSea.includes(b.region)) return 4500;
  return 2200;
}
