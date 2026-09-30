import { cache } from "react";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
  try {
    const rows = await db.select().from(vesselClasses).orderBy(asc(vesselClasses.typicalDwt));
    return rows;
  } catch (error) {
    console.error("REAL DB ERROR:", error);
    console.warn("Database connection failed during build/fetch. Returning empty array.");
    return [];
  }
});

export const getRoutes = cache(async (): Promise<RouteWithPorts[]> => {
  // 1. OPTIMIZATION: Use Drizzle aliases to join the ports table twice in SQL
  // This eliminates the JS Map() loop and stops the server from downloading all ports twice
  const originPorts = alias(ports, "origin_ports");
  const destPorts = alias(ports, "dest_ports");

  const rows = await db
    .select({ route: routes, origin: originPorts, dest: destPorts })
    .from(routes)
    .innerJoin(originPorts, eq(routes.originPortId, originPorts.id))
    .innerJoin(destPorts, eq(routes.destPortId, destPorts.id))
    .orderBy(asc(routes.code));

  return rows.map((r) => ({
    ...r.route,
    origin: r.origin,
    dest: r.dest,
  }));
});

export const getSeries = cache(async (classId: number, routeId: number): Promise<SeriesPoint[]> => {
  return db
    .select({ date: freightRates.date, value: freightRates.rateUsd })
    .from(freightRates)
    .where(and(eq(freightRates.vesselClassId, classId), eq(freightRates.routeId, routeId)))
    .orderBy(asc(freightRates.date));
});

export const getClassSeries = cache(async (classId: number): Promise<SeriesPoint[]> => {
  // 2. OPTIMIZATION: Push rounding to Postgres using ROUND(AVG())
  // This removes the need for a CPU-heavy .map() array loop in JavaScript
  return db
    .select({
      date: freightRates.date,
      value: sql<number>`ROUND(AVG(${freightRates.rateUsd}))::integer`,
    })
    .from(freightRates)
    .where(eq(freightRates.vesselClassId, classId))
    .groupBy(freightRates.date)
    .orderBy(asc(freightRates.date));
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
  
  // 3. OPTIMIZATION: Use Promise.all to fetch all class series simultaneously
  // This runs 4 database queries in parallel instead of waiting sequentially in a for...of loop
  const snapshots = await Promise.all(
    classes.map(async (c) => {
      const series = await getClassSeries(c.id);
      if (!series.length) return null;
      
      const n = series.length;
      const spot = series[n - 1].value;
      const dAgo = (k: number) => series[Math.max(0, n - 1 - k)].value;
      
      return {
        classCode: c.code,
        className: c.name,
        spot,
        chg7d: Math.round(((spot - dAgo(7)) / dAgo(7)) * 1000) / 10,
        chg30d: Math.round(((spot - dAgo(30)) / dAgo(30)) * 1000) / 10,
        spark: series.slice(-90).map((p) => p.value),
        latestDate: series[n - 1].date,
      };
    })
  );

  // Filter out any nulls from empty classes
  return snapshots.filter(Boolean) as ClassSnapshot[];
});