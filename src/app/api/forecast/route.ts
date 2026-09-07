import { NextRequest, NextResponse } from "next/server";
import { analyzeTiming, forecastSeries } from "@/lib/forecast";
import { getClasses, getRoutes, getSeries } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const classCode = (sp.get("class") ?? "SUPRAMAX").toUpperCase();
  const routeId = Number(sp.get("route") ?? 0);
  const horizon = Math.max(30, Math.min(365, Number(sp.get("horizon") ?? 180)));

  const [classes, routes] = await Promise.all([getClasses(), getRoutes()]);
  const cls = classes.find((c) => c.code === classCode) ?? classes[1] ?? classes[0];
  const route =
    routes.find((r) => r.id === routeId) ??
    // default: a corridor the class can actually trade
    routes.find((r) => cls.draftM <= r.origin.maxDraftM && cls.draftM <= r.dest.maxDraftM) ??
    routes[0];

  const series = await getSeries(cls.id, route.id);
  if (series.length < 200) {
    return NextResponse.json({ error: "Insufficient history for this pairing" }, { status: 404 });
  }
  const fc = forecastSeries(series, horizon);
  const timing = analyzeTiming(fc);

  return NextResponse.json({
    meta: {
      classes: classes.map((c) => ({
        id: c.id, code: c.code, name: c.name, dwt: c.typicalDwt,
        draft: c.draftM, loa: c.loaM, geared: c.geared,
      })),
      routes: routes.map((r) => ({
        id: r.id, code: r.code, nm: r.distanceNm, commodity: r.commodity,
        direction: r.direction,
        origin: { id: r.origin.id, name: r.origin.name, code: r.origin.code },
        dest: { id: r.dest.id, name: r.dest.name, code: r.dest.code },
      })),
    },
    selection: { classCode: cls.code, routeId: route.id, horizon },
    route: {
      code: route.code, commodity: route.commodity, direction: route.direction,
      nm: route.distanceNm, origin: route.origin.name, dest: route.dest.name,
    },
    history: series.slice(-320),
    points: fc.points,
    stats: fc.stats,
    timing,
  });
}
