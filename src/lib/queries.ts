import { cache } from "react";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  freightRates,
  marketEvents,
  ports,
  routes,
  vesselClasses,
  type MarketEvent,
  type Port,
  type Route,
  type VesselClass,
} from "@/db/schema";
import type { SeriesPoint } from "./forecast";

export interface RouteWithPorts extends Route {
  origin: Port;
  dest: Port;
}

export const getPorts = cache(async (): Promise<Port[]> => {
  return db.select().from(ports).orderBy(asc(ports.name));
});

export const getClasses = cache(async (): Promise<VesselClass[]> => {
  const rows = await db.select().from(vesselClasses).orderBy(asc(vesselClasses.typicalDwt));
  return rows;
});

export const getRoutes = cache(async (): Promise<RouteWithPorts[]> => {
  const rows = await db
    .select({ route: routes, origin: ports, dest: ports })
    .from(routes)
    .innerJoin(ports, eq(routes.originPortId, ports.id))
    .orderBy(asc(routes.code));
  const dests = await db.select().from(ports);
  const byId = new Map(dests.map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r.route,
    origin: r.origin,
    dest: byId.get(r.route.destPortId)!,
  }));
});

export const getSeries = cache(async (classId: number, routeId: number): Promise<SeriesPoint[]> => {
  const rows = await db
    .select({ date: freightRates.date, value: freightRates.rateUsd })
    .from(freightRates)
    .where(and(eq(freightRates.vesselClassId, classId), eq(freightRates.routeId, routeId)))
    .orderBy(asc(freightRates.date));
  return rows;
});

// Class-wide benchmark index: mean TCE across all active routes
export const getClassSeries = cache(async (classId: number): Promise<SeriesPoint[]> => {
  const rows = await db
    .select({
      date: freightRates.date,
      value: sql<number>`avg(${freightRates.rateUsd})::float`,
    })
    .from(freightRates)
    .where(eq(freightRates.vesselClassId, classId))
    .groupBy(freightRates.date)
    .orderBy(asc(freightRates.date));
  return rows.map((r) => ({ date: r.date, value: Math.round(r.value) }));
});

export const getActiveEvents = cache(async (): Promise<MarketEvent[]> => {
  return db
    .select()
    .from(marketEvents)
    .where(eq(marketEvents.active, true))
    .orderBy(desc(marketEvents.severity), desc(marketEvents.startDate));
});

export interface ClassSnapshot {
  classCode: string;
  className: string;
  spot: number;
  chg7d: number;
  chg30d: number;
  spark: number[];
  latestDate: string;
}

export const getClassSnapshots = cache(async (): Promise<ClassSnapshot[]> => {
  const classes = await getClasses();
  const out: ClassSnapshot[] = [];
  for (const c of classes) {
    const series = await getClassSeries(c.id);
    if (!series.length) continue;
    const n = series.length;
    const spot = series[n - 1].value;
    const dAgo = (k: number) => series[Math.max(0, n - 1 - k)].value;
    out.push({
      classCode: c.code,
      className: c.name,
      spot,
      chg7d: Math.round(((spot - dAgo(7)) / dAgo(7)) * 1000) / 10,
      chg30d: Math.round(((spot - dAgo(30)) / dAgo(30)) * 1000) / 10,
      spark: series.slice(-90).map((p) => p.value),
      latestDate: series[n - 1].date,
    });
  }
  return out;
});

