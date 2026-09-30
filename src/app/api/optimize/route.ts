import { NextRequest, NextResponse } from "next/server";
import { getClasses, getPorts, getRoutes } from "@/lib/queries";
import { estDistanceNm, optimizeFleet } from "@/lib/voyage";
import { getClassForecast, getRouteForecast } from "@/lib/insights";

// 1. OPTIMIZATION: Remove force-dynamic to allow Edge caching
export const revalidate = 3600; // Cache unique parameter combinations for 1 hour

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const originCode = (sp.get("origin") ?? "IDTAB").toUpperCase();
  const destCode = (sp.get("dest") ?? "INKRI").toUpperCase();
  const cargoT = Math.max(5000, Math.min(400000, Number(sp.get("cargo") ?? 55000)));
  const commodity = sp.get("commodity") ?? "Thermal Coal";

  const [ports, classes, routes] = await Promise.all([getPorts(), getClasses(), getRoutes()]);
  const origin = ports.find((p) => p.code === originCode) ?? ports[0];
  const dest = ports.find((p) => p.code === destCode) ?? ports[1];

  if (origin.id === dest.id) {
    return NextResponse.json({ error: "Origin and discharge port must differ" }, { status: 400 });
  }

  const route = routes.find((r) => r.originPortId === origin.id && r.destPortId === dest.id) ?? null;
  const distanceNm = estDistanceNm(origin, dest, route?.distanceNm);

  // 2. OPTIMIZATION: Execute all forecast ML logic in parallel
  const hireByClass: Record<string, number> = {};
  await Promise.all(
    classes.map(async (cls) => {
      try {
        const fc = route ? await getRouteForecast(cls.id, route.id, 60) : await getClassForecast(cls.id, 90);
        hireByClass[cls.code] = fc.stats.fwd30;
      } catch {
        hireByClass[cls.code] = 0;
      }
    })
  );

  const result = optimizeFleet(classes, route, origin, dest, distanceNm, cargoT, hireByClass);

  // 3. OPTIMIZATION: Tell Cloudflare to cache the final output instantly
  return NextResponse.json({
    meta: {
      ports: ports.map((p) => ({
        id: p.id, code: p.code, name: p.name, country: p.country, region: p.region,
        isIndiaEC: p.isIndiaEC, maxDraftM: p.maxDraftM, maxLoaM: p.maxLoaM, maxDwt: p.maxDwt,
        gearedRequired: p.gearedRequired, congestionDays: p.congestionDays, congestionTrend: p.congestionTrend,
        notes: p.notes,
      })),
      classes: classes.map((c) => ({ id: c.id, code: c.code, name: c.name, dwt: c.typicalDwt, draft: c.draftM, loa: c.loaM, geared: c.geared })),
    },
    selection: { origin: origin.code, dest: dest.code, cargoT, commodity },
    result: {
      ...result,
      route: route ? { code: route.code, commodity: route.commodity, direction: route.direction, nm: route.distanceNm } : null,
    },
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    }
  });
}