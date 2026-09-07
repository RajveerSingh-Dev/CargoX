import "./env-setup";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  freightRates,
  marketEvents,
  ports,
  routes,
  vesselClasses,
} from "./schema";

// ---------------------------------------------------------------- utilities
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng: () => number) {
  // Box-Muller
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
};

const DAYS = 790; // ~26 months of history
const today = new Date();
today.setUTCHours(0, 0, 0, 0);

// ---------------------------------------------------------------- master data
const PORTS = [
  // India East Coast
  { code: "INVIZ", name: "Visakhapatnam", country: "India", region: "India EC", maxDraftM: 14.5, maxLoaM: 300, maxDwt: 150000, gearedRequired: false, loadRateTpd: 26000, dischargeRateTpd: 21000, portFeeUsd: 68000, congestionDays: 2.4, congestionTrend: "RISING", isIndiaEC: true, notes: "Outer harbour handles large bulkers; inner harbour restricted. Iron ore mechanised loading." },
  { code: "INGAN", name: "Gangavaram", country: "India", region: "India EC", maxDraftM: 17.8, maxLoaM: 310, maxDwt: 205000, gearedRequired: false, loadRateTpd: 32000, dischargeRateTpd: 26000, portFeeUsd: 82000, congestionDays: 1.1, congestionTrend: "STABLE", isIndiaEC: true, notes: "Deepest all-weather port on the coast. Only EC India berth taking fully laden Capesize." },
  { code: "INKAK", name: "Kakinada", country: "India", region: "India EC", maxDraftM: 11.0, maxLoaM: 200, maxDwt: 45000, gearedRequired: true, loadRateTpd: 6500, dischargeRateTpd: 8000, portFeeUsd: 38000, congestionDays: 1.6, congestionTrend: "STABLE", isIndiaEC: true, notes: "Anchorage + barge operations. Vessel cranes essential; slow turnaround." },
  { code: "INKRI", name: "Krishnapatnam", country: "India", region: "India EC", maxDraftM: 16.0, maxLoaM: 300, maxDwt: 165000, gearedRequired: false, loadRateTpd: 35000, dischargeRateTpd: 28000, portFeeUsd: 76000, congestionDays: 1.3, congestionTrend: "EASING", isIndiaEC: true, notes: "Modern deep-water coal hub serving southern power gencos." },
  { code: "INMAA", name: "Chennai", country: "India", region: "India EC", maxDraftM: 14.3, maxLoaM: 280, maxDwt: 120000, gearedRequired: false, loadRateTpd: 22000, dischargeRateTpd: 18000, portFeeUsd: 64000, congestionDays: 1.9, congestionTrend: "STABLE", isIndiaEC: true, notes: " congested urban port; night navigation restrictions on some berths." },
  { code: "INENR", name: "Ennore (Kamarajar)", country: "India", region: "India EC", maxDraftM: 15.0, maxLoaM: 290, maxDwt: 145000, gearedRequired: false, loadRateTpd: 28000, dischargeRateTpd: 24000, portFeeUsd: 62000, congestionDays: 1.7, congestionTrend: "STABLE", isIndiaEC: true, notes: "Dedicated coal berths for TNEB; cleaner channel than Chennai." },
  { code: "INPRT", name: "Paradip", country: "India", region: "India EC", maxDraftM: 14.3, maxLoaM: 290, maxDwt: 130000, gearedRequired: false, loadRateTpd: 30000, dischargeRateTpd: 20000, portFeeUsd: 66000, congestionDays: 4.6, congestionTrend: "RISING", isIndiaEC: true, notes: "Major iron-ore export hub. Current congestion severe — 12+ vessels at anchorage." },
  { code: "INDMT", name: "Dhamra", country: "India", region: "India EC", maxDraftM: 17.8, maxLoaM: 310, maxDwt: 200000, gearedRequired: false, loadRateTpd: 33000, dischargeRateTpd: 25000, portFeeUsd: 80000, congestionDays: 0.9, congestionTrend: "EASING", isIndiaEC: true, notes: "Deep-draft private port between Paradip and Haldia. Cape-capable." },
  { code: "INHAL", name: "Haldia", country: "India", region: "India EC", maxDraftM: 10.5, maxLoaM: 215, maxDwt: 48000, gearedRequired: false, loadRateTpd: 9000, dischargeRateTpd: 12000, portFeeUsd: 52000, congestionDays: 3.2, congestionTrend: "RISING", isIndiaEC: true, notes: "Riverine port on Hooghly — tidal sailing windows, draft critical, frequent silting." },
  { code: "INGOP", name: "Gopalpur", country: "India", region: "India EC", maxDraftM: 14.0, maxLoaM: 270, maxDwt: 110000, gearedRequired: false, loadRateTpd: 16000, dischargeRateTpd: 14000, portFeeUsd: 48000, congestionDays: 0.7, congestionTrend: "STABLE", isIndiaEC: true, notes: "Growing minor port; limited cargo evacuation during NE monsoon." },
  // Foreign load / discharge ports
  { code: "IDTAB", name: "Taboneo Anchorage", country: "Indonesia", region: "SE Asia", maxDraftM: 13.8, maxLoaM: 240, maxDwt: 75000, gearedRequired: true, loadRateTpd: 9500, dischargeRateTpd: 9500, portFeeUsd: 34000, congestionDays: 2.1, congestionTrend: "STABLE", isIndiaEC: false, notes: "Offshore transhipment via floating cranes — vessel gear mandatory." },
  { code: "IDMBR", name: "Muara Berau (Samarinda)", country: "Indonesia", region: "SE Asia", maxDraftM: 13.5, maxLoaM: 235, maxDwt: 70000, gearedRequired: true, loadRateTpd: 11000, dischargeRateTpd: 11000, portFeeUsd: 36000, congestionDays: 2.6, congestionTrend: "RISING", isIndiaEC: false, notes: "River-mouth anchorage on Mahakam; tug/barge loading to geared tonnage." },
  { code: "AUNTL", name: "Newcastle", country: "Australia", region: "EC Australia", maxDraftM: 15.2, maxLoaM: 300, maxDwt: 145000, gearedRequired: false, loadRateTpd: 42000, dischargeRateTpd: 42000, portFeeUsd: 118000, congestionDays: 2.8, congestionTrend: "RISING", isIndiaEC: false, notes: "World's largest coal export terminal; towage industrial action risk." },
  { code: "AUGLA", name: "Gladstone", country: "Australia", region: "EC Australia", maxDraftM: 15.8, maxLoaM: 300, maxDwt: 155000, gearedRequired: false, loadRateTpd: 36000, dischargeRateTpd: 36000, portFeeUsd: 104000, congestionDays: 1.4, congestionTrend: "STABLE", isIndiaEC: false, notes: "RG Tanna + Barney Point terminals; reliable loading." },
  { code: "AUHPT", name: "Hay Point", country: "Australia", region: "EC Australia", maxDraftM: 17.8, maxLoaM: 320, maxDwt: 220000, gearedRequired: false, loadRateTpd: 46000, dischargeRateTpd: 46000, portFeeUsd: 126000, congestionDays: 3.5, congestionTrend: "STABLE", isIndiaEC: false, notes: "DBCT/HPGT — coking coal; Cape-friendly but queues build in cyclone season." },
  { code: "ZARCB", name: "Richards Bay", country: "South Africa", region: "Southern Africa", maxDraftM: 17.5, maxLoaM: 310, maxDwt: 200000, gearedRequired: false, loadRateTpd: 25000, dischargeRateTpd: 25000, portFeeUsd: 98000, congestionDays: 4.1, congestionTrend: "RISING", isIndiaEC: false, notes: "RBCT rail (Transnet) constraints persist; cargo availability erratic." },
  { code: "CNTAO", name: "Qingdao", country: "China", region: "North China", maxDraftM: 18.0, maxLoaM: 330, maxDwt: 250000, gearedRequired: false, loadRateTpd: 40000, dischargeRateTpd: 42000, portFeeUsd: 110000, congestionDays: 2.2, congestionTrend: "STABLE", isIndiaEC: false, notes: "Dongjiakou ore terminal takes Valemax/Cape. Pilot queues in fog season." },
  { code: "AEMSA", name: "Mina Saqr (RAK)", country: "UAE", region: "Arabian Gulf", maxDraftM: 15.5, maxLoaM: 285, maxDwt: 135000, gearedRequired: false, loadRateTpd: 22000, dischargeRateTpd: 22000, portFeeUsd: 88000, congestionDays: 1.2, congestionTrend: "STABLE", isIndiaEC: false, notes: "Limestone/aggregates for Indian cement plants." },
  { code: "MZNAC", name: "Nacala", country: "Mozambique", region: "SE Africa", maxDraftM: 18.0, maxLoaM: 315, maxDwt: 210000, gearedRequired: false, loadRateTpd: 19000, dischargeRateTpd: 19000, portFeeUsd: 92000, congestionDays: 1.8, congestionTrend: "STABLE", isIndiaEC: false, notes: "Deep-water coking coal outlet; rail turnaround improving." },
  { code: "BDCGP", name: "Chattogram (Chittagong)", country: "Bangladesh", region: "Bay of Bengal", maxDraftM: 9.5, maxLoaM: 190, maxDwt: 38000, gearedRequired: true, loadRateTpd: 7000, dischargeRateTpd: 6500, portFeeUsd: 42000, congestionDays: 5.5, congestionTrend: "RISING", isIndiaEC: false, notes: "Monsoon siltation tightens draft; geared Handysize only, chronic congestion." },
];

const CLASSES = [
  { code: "HANDY", name: "Handysize", typicalDwt: 38000, minDwt: 28000, maxDwt: 40000, draftM: 10.2, loaM: 180, geared: true, speedKnots: 12.0, consSeaTpd: 18, consPortTpd: 4, base: 11500, vol: 0.09, phase: 0.4 },
  { code: "SUPRAMAX", name: "Supramax / Ultramax", typicalDwt: 58000, minDwt: 52000, maxDwt: 64000, draftM: 12.8, loaM: 199, geared: true, speedKnots: 12.5, consSeaTpd: 22, consPortTpd: 5, base: 13500, vol: 0.11, phase: 1.3 },
  { code: "PANAMAX", name: "Panamax / Kamsarmax", typicalDwt: 82000, minDwt: 74000, maxDwt: 84000, draftM: 14.3, loaM: 229, geared: false, speedKnots: 13.0, consSeaTpd: 26, consPortTpd: 5, base: 14500, vol: 0.13, phase: 2.1 },
  { code: "CAPE", name: "Capesize", typicalDwt: 180000, minDwt: 160000, maxDwt: 210000, draftM: 17.6, loaM: 292, geared: false, speedKnots: 13.5, consSeaTpd: 42, consPortTpd: 7, base: 21000, vol: 0.21, phase: 3.0 },
];

// [origin, dest, nm, commodity, direction]
const ROUTES: Array<[string, string, number, string, string]> = [
  ["IDTAB", "INKRI", 2050, "Thermal Coal", "IMPORT"],
  ["IDTAB", "INENR", 2150, "Thermal Coal", "IMPORT"],
  ["IDMBR", "INVIZ", 2260, "Thermal Coal", "IMPORT"],
  ["IDTAB", "INKAK", 2080, "Thermal Coal", "IMPORT"],
  ["AUNTL", "INPRT", 4750, "Coking Coal", "IMPORT"],
  ["AUGLA", "INGAN", 4600, "Coking Coal", "IMPORT"],
  ["AUHPT", "INDMT", 4850, "Coking Coal", "IMPORT"],
  ["ZARCB", "INGAN", 4400, "Thermal Coal", "IMPORT"],
  ["ZARCB", "INMAA", 4550, "Thermal Coal", "IMPORT"],
  ["MZNAC", "INVIZ", 3850, "Coking Coal", "IMPORT"],
  ["INPRT", "CNTAO", 2950, "Iron Ore", "EXPORT"],
  ["INDMT", "CNTAO", 3050, "Iron Ore", "EXPORT"],
  ["INHAL", "BDCGP", 430, "Cement Clinker", "COASTAL"],
  ["AEMSA", "INMAA", 1700, "Limestone", "IMPORT"],
];

// Monthly seasonal indices by cargo flow (Jan..Dec)
const SEASON_COAL_IMPORT = [0.98, 0.94, 1.0, 1.02, 1.03, 1.0, 0.98, 1.0, 1.06, 1.08, 1.04, 1.0];
const SEASON_ORE_EXPORT = [1.03, 1.0, 0.99, 0.97, 0.96, 1.02, 0.97, 0.95, 1.0, 1.05, 1.07, 1.04];
const SEASON_GENERIC = [0.98, 0.93, 0.96, 0.99, 1.02, 1.03, 1.02, 1.04, 1.08, 1.06, 1.02, 1.0];
const CLASS_SEASON_AMP: Record<string, number> = { HANDY: 0.6, SUPRAMAX: 0.85, PANAMAX: 1.0, CAPE: 1.5 };

// ---------------------------------------------------------------- main
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Clearing existing data…");
  await db.delete(freightRates);
  await db.delete(marketEvents);
  await db.delete(routes);
  await db.delete(vesselClasses);
  await db.delete(ports);

  console.log("Seeding ports…");
  const portRows = await db.insert(ports).values(PORTS).returning();
  const portId = Object.fromEntries(portRows.map((p) => [p.code, p.id]));

  console.log("Seeding vessel classes…");
  await db.insert(vesselClasses).values(
    CLASSES.map((c) => ({
      code: c.code,
      name: c.name,
      typicalDwt: c.typicalDwt,
      minDwt: c.minDwt,
      maxDwt: c.maxDwt,
      draftM: c.draftM,
      loaM: c.loaM,
      geared: c.geared,
      speedKnots: c.speedKnots,
      consSeaTpd: c.consSeaTpd,
      consPortTpd: c.consPortTpd,
    }))
  );
  const classRows = await Promise.all(
    CLASSES.map(async (c) => {
      const all = await db.select().from(vesselClasses);
      return all.find((r) => r.code === c.code)!;
    })
  );
  const classId = Object.fromEntries(classRows.map((r) => [r.code, r.id]));

  console.log("Seeding routes…");
  const routeRows = await db
    .insert(routes)
    .values(
      ROUTES.map(([o, d, nm, commodity, direction]) => ({
        code: `${o}-${d}`,
        originPortId: portId[o],
        destPortId: portId[d],
        distanceNm: nm,
        commodity,
        direction,
        notes: null,
      }))
    )
    .returning();
  const routeById = new Map(routeRows.map((r) => [r.id, r]));
  const routeDistance = Object.fromEntries(routeRows.map((r) => [r.id, r.distanceNm]));

  // ---------------------------------------------------------- rate engine
  console.log(`Generating ${DAYS} days of rates for ${routeRows.length} routes × ${CLASSES.length} classes…`);
  const seasonFor = (commodity: string, direction: string) => {
    if (commodity.includes("Ore")) return SEASON_ORE_EXPORT;
    if (commodity === "Thermal Coal" || commodity === "Coking Coal") return SEASON_COAL_IMPORT;
    return SEASON_GENERIC;
  };

  const start = addDays(today, -DAYS + 1);
  const rateRows: Array<{ date: string; vesselClassId: number; routeId: number; rateUsd: number }> = [];

  for (const cls of CLASSES) {
    for (const route of routeRows) {
      const r = routeById.get(route.id)!;
      const dist = routeDistance[route.id];
      const season = seasonFor(r.commodity, r.direction);
      const amp = CLASS_SEASON_AMP[cls.code] ?? 1;
      // deterministic per class+route stream
      const hsh = (classId[cls.code] * 7919 + route.id * 104729 + dist) >>> 0;
      const rng = mulberry32(hsh);
      const routeMul = 0.88 + (hsh % 27) / 100; // 0.88–1.14
      // event spikes
      const spikes: Array<{ at: number; len: number; mag: number }> = [];
      for (let s = 0; s < 9; s++) {
        spikes.push({
          at: Math.floor(rng() * (DAYS - 60)) + 20,
          len: 7 + Math.floor(rng() * 22),
          mag: (rng() - 0.42) * 0.34, // mostly up-spikes
        });
      }
      let ar = 0; // AR(1) log-noise state
      let prev = cls.base * routeMul;
      for (let i = 0; i < DAYS; i++) {
        const date = addDays(start, i);
        const dow = date.getUTCDay();
        if (dow === 0 || dow === 6) {
          // weekend: market closes, carry Friday print
          rateRows.push({ date: iso(date), vesselClassId: classId[cls.code], routeId: route.id, rateUsd: Math.round(prev / 50) * 50 });
          continue;
        }
        const month = date.getUTCMonth();
        const sIdx = 1 + (season[month] - 1) * amp;
        const cycle =
          1 +
          0.15 * Math.sin((2 * Math.PI * i) / 545 + cls.phase) +
          0.055 * Math.sin((2 * Math.PI * i) / 138 + cls.phase * 2.2) -
          0.00012 * i; // gentle two-year drift
        ar = 0.914 * ar + gauss(rng) * (cls.vol / Math.sqrt(22));
        let spike = 0;
        for (const sp of spikes) {
          if (i >= sp.at && i < sp.at + sp.len) {
            const k = (i - sp.at) / sp.len;
            spike += sp.mag * Math.sin(Math.PI * k);
          }
        }
        const val = cls.base * routeMul * sIdx * cycle * Math.exp(ar) * (1 + spike);
        prev = Math.max(4200, val);
        rateRows.push({ date: iso(date), vesselClassId: classId[cls.code], routeId: route.id, rateUsd: Math.round(prev / 50) * 50 });
      }
    }
  }

  console.log(`Inserting ${rateRows.length} rate rows in chunks…`);
  const CHUNK = 4000;
  for (let i = 0; i < rateRows.length; i += CHUNK) {
    await db.insert(freightRates).values(rateRows.slice(i, i + CHUNK));
  }

  // ---------------------------------------------------------- events
  console.log("Seeding market events…");
  const d = (offset: number) => iso(addDays(today, offset));
  const capeCls = classId["CAPE"];
  const supraCls = classId["SUPRAMAX"];
  await db.insert(marketEvents).values([
    { type: "CONGESTION", severity: 4, title: "Paradip anchorage queue at 12+ vessels", description: "Berth-plan slippage and rail rake shortages have pushed waiting times to 4–6 days at Paradip. Iron ore export stems piling up.", impact: "+4-6 days idle per call; demurrage exposure on Supramax/Panamax stems", portId: portId["INPRT"], routeId: null, vesselClassId: null, startDate: d(-9), endDate: d(21), active: true },
    { type: "CONGESTION", severity: 3, title: "RBCT rail constraints continue", description: "Transnet Freight Rail derailment recovery ongoing; Richards Bay export availability erratic with vessel bunching.", impact: "Load delays 3–5 days; risk of stem cancellation on SA coal programmes", portId: portId["ZARCB"], routeId: null, vesselClassId: null, startDate: d(-14), endDate: d(24), active: true },
    { type: "WEATHER", severity: 4, title: "Bay of Bengal cyclone watch — active window", description: "IMD models indicate cyclonic development probability in the Bay of Bengal basin over the next 3 weeks. EC India ports may suspend operations on short notice.", impact: "Possible 2–4 day port closures; charter parties should carry robust weather clauses", portId: null, routeId: null, vesselClassId: null, startDate: d(-4), endDate: d(21), active: true },
    { type: "STRIKE", severity: 3, title: "Newcastle towage crews ballot industrial action", description: "Towage operator ballots conclude in ~2 weeks. Protected industrial action would cap Newcastle sailings to daylight windows.", impact: "Potential 30–40% loading throughput cut at world largest coal terminal", portId: portId["AUNTL"], routeId: null, vesselClassId: null, startDate: d(10), endDate: d(38), active: true },
    { type: "REGULATORY", severity: 2, title: "Chattogram draft tightened to 9.5m", description: "Monsoon siltation at the Karnaphuli bar forces another draft cut. Vessels above 38,000 dwt cannot enter fully laden.", impact: "Handysize-only employment; lighterage premiums rising", portId: portId["BDCGP"], routeId: null, vesselClassId: null, startDate: d(-20), endDate: d(40), active: true },
    { type: "BUNKER", severity: 2, title: "Singapore VLSFO +9% week-on-week", description: "Bunker complex rallies on refinery maintenance and crude firmness. TCE sensitivity highest on long-haul Australia/South Africa stems.", impact: "~$1,100/day TCE erosion on 5,000nm round voyages", portId: null, routeId: null, vesselClassId: null, startDate: d(-6), endDate: d(14), active: true },
    { type: "VOLATILITY", severity: 3, title: "Cape FFA curve flips to steep backwardation", description: "Front-month Cape paper trades $3,500/day above Q+2. Physical demand spike from Chinese ore restocking likely to fade.", impact: "Lock period cover now if long Cape exposure beyond 90 days", portId: null, routeId: null, vesselClassId: capeCls, startDate: d(-3), endDate: d(30), active: true },
    { type: "DEMAND", severity: 2, title: "East coast sponge-iron plants lift import appetite", description: "Sponge iron and pellet makers around Vizag/Gangavaram raise coking coal and thermal blend purchases for Q+1 delivery.", impact: "Supramax enquiry tape up 18% w/w ex-Indonesia/Mozambique", portId: null, routeId: null, vesselClassId: supraCls, startDate: d(-8), endDate: d(35), active: true },
    { type: "WEATHER", severity: 2, title: "EC Australia cyclone season outlook elevated", description: "BOM seasonal outlook: above-average cyclone probability in Coral Sea through the quarter. Hay Point and Gladstone load programmes at risk of bunching.", impact: "Cape/Panamax queuing risk; build 3-day buffer into laycans", portId: portId["AUHPT"], routeId: null, vesselClassId: null, startDate: d(-2), endDate: d(60), active: true },
    { type: "CONGESTION", severity: 2, title: "Haldia tidal windows restricted", description: "Dredging at Auckland channel reduces tidal sailing windows to one per day for vessels > 9.8m draft.", impact: "Handymax turnaround +1.5 days; schedule arrivals for springs", portId: portId["INHAL"], routeId: null, vesselClassId: null, startDate: d(-11), endDate: d(18), active: true },
    { type: "DEMAND", severity: 1, title: "Chinese ore inventories rebuild at Qingdao", description: "Port stocks climb 4% — near-term discharge appetite solid for Indian EC ore exports.", impact: "Supportive for Supramax/Panamax ore freights ex-Paradip/Dhamra", portId: portId["CNTAO"], routeId: null, vesselClassId: null, startDate: d(-5), endDate: d(25), active: true },
    { type: "WEATHER", severity: 2, title: "Cyclone aftermath — ports normalised", description: "Operations resumed across Odisha and Andhra coast after passage of the last depression. Backlog largely cleared.", impact: "Monitoring only", portId: null, routeId: null, vesselClassId: null, startDate: d(-48), endDate: d(-33), active: false },
    { type: "VOLATILITY", severity: 1, title: "Paper market liquidity thin into quarter-end", description: "FFA volumes down 22% — physical fixing may overshoot on low liquidity signals.", impact: "Widen confidence bands on < 30-day fixes", portId: null, routeId: null, vesselClassId: null, startDate: d(-2), endDate: d(9), active: true },
  ]);

  console.log("Seed complete ✔");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
