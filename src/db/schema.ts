import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const ports = pgTable("ports", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  region: text("region").notNull(),
  // Physical restrictions
  maxDraftM: real("max_draft_m").notNull(),
  maxLoaM: integer("max_loa_m").notNull(),
  maxDwt: integer("max_dwt"),
  gearedRequired: boolean("geared_required").notNull().default(false),
  // Productivity
  loadRateTpd: integer("load_rate_tpd").notNull(), // tonnes per day
  dischargeRateTpd: integer("discharge_rate_tpd").notNull(),
  portFeeUsd: integer("port_fee_usd").notNull().default(45000),
  // Live operational snapshot
  congestionDays: real("congestion_days").notNull().default(0.5),
  congestionTrend: text("congestion_trend").notNull().default("STABLE"), // RISING | STABLE | EASING
  isIndiaEC: boolean("is_india_ec").notNull().default(false),
  notes: text("notes"),
});

export const vesselClasses = pgTable("vessel_classes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // HANDY | SUPRAMAX | PANAMAX | CAPE
  name: text("name").notNull(),
  typicalDwt: integer("typical_dwt").notNull(),
  minDwt: integer("min_dwt").notNull(),
  maxDwt: integer("max_dwt").notNull(),
  draftM: real("draft_m").notNull(),
  loaM: integer("loa_m").notNull(),
  geared: boolean("geared").notNull(),
  speedKnots: real("speed_knots").notNull().default(12.5),
  consSeaTpd: real("cons_sea_tpd").notNull().default(24),
  consPortTpd: real("cons_port_tpd").notNull().default(5),
});

export const routes = pgTable(
  "routes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    originPortId: integer("origin_port_id")
      .notNull()
      .references(() => ports.id),
    destPortId: integer("dest_port_id")
      .notNull()
      .references(() => ports.id),
    distanceNm: integer("distance_nm").notNull(),
    commodity: text("commodity").notNull(),
    direction: text("direction").notNull().default("IMPORT"), // IMPORT | EXPORT | COASTAL
    notes: text("notes"),
  },
  (t) => [uniqueIndex("routes_pair_idx").on(t.originPortId, t.destPortId)]
);

export const freightRates = pgTable(
  "freight_rates",
  {
    id: serial("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    vesselClassId: integer("vessel_class_id")
      .notNull()
      .references(() => vesselClasses.id),
    routeId: integer("route_id")
      .notNull()
      .references(() => routes.id),
    // Time-charter equivalent earnings, USD/day
    rateUsd: integer("rate_usd").notNull(),
  },
  (t) => [
    uniqueIndex("rates_unique_idx").on(t.date, t.vesselClassId, t.routeId),
    index("rates_lookup_idx").on(t.vesselClassId, t.routeId, t.date),
  ]
);

export const marketEvents = pgTable(
  "market_events",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(), // CONGESTION | WEATHER | STRIKE | VOLATILITY | BUNKER | REGULATORY | DEMAND
    severity: integer("severity").notNull().default(2), // 1..5
    title: text("title").notNull(),
    description: text("description").notNull(),
    impact: text("impact").notNull(),
    portId: integer("port_id").references(() => ports.id),
    routeId: integer("route_id").references(() => routes.id),
    vesselClassId: integer("vessel_class_id").references(() => vesselClasses.id),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("events_active_idx").on(t.active, t.startDate)]
);

export type Port = typeof ports.$inferSelect;
export type VesselClass = typeof vesselClasses.$inferSelect;
export type Route = typeof routes.$inferSelect;
export type FreightRate = typeof freightRates.$inferSelect;
export type MarketEvent = typeof marketEvents.$inferSelect;
