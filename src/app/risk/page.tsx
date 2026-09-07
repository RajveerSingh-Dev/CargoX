import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CloudLightning,
  Construction,
  Flame,
  Fuel,
  Landmark,
  Minus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Badge, Card, PageHeader, SectionLabel, fmtDateShort } from "@/components/ui";
import { Gauge } from "@/components/charts";
import { getPorts, getRoutes } from "@/lib/queries";
import { computeRouteRisk, getMarketBoard, getRouteForecast } from "@/lib/insights";

export const dynamic = "force-dynamic";

const TYPE_META: Record<string, { icon: typeof Flame; tone: "bad" | "warn" | "neutral" | "good" | "mute" }> = {
  VOLATILITY: { icon: Activity, tone: "warn" },
  CONGESTION: { icon: Construction, tone: "bad" },
  WEATHER: { icon: CloudLightning, tone: "bad" },
  STRIKE: { icon: Users, tone: "warn" },
  BUNKER: { icon: Fuel, tone: "neutral" },
  REGULATORY: { icon: Landmark, tone: "warn" },
  DEMAND: { icon: AlertTriangle, tone: "neutral" },
};

const BAND_TONE = { LOW: "good", GUARDED: "neutral", ELEVATED: "warn", SEVERE: "bad" } as const;

export default async function RiskPage() {
  const [board, routes, ports] = await Promise.all([getMarketBoard(), getRoutes(), getPorts()]);

  // corridor scores on the Supramax reference curve
  const ref = board.classes.find((c) => c.code === "SUPRAMAX") ?? board.classes[0];
  const corridorRisks = [] as Array<{ route: (typeof routes)[number]; risk: ReturnType<typeof computeRouteRisk>; fwd90: number }>;
  await Promise.all(
    routes.map(async (r) => {
      const fc = await getRouteForecast(ref.id, r.id, 90);
      corridorRisks.push({ route: r, risk: computeRouteRisk(r, fc.stats.volPercentile, board.events, board.todayISO), fwd90: fc.stats.trendPct90 });
    })
  );
  corridorRisks.sort((a, b) => b.risk.score - a.risk.score);

  const congested = [...ports].sort((a, b) => b.congestionDays - a.congestionDays).slice(0, 6);
  const maxCong = congested[0]?.congestionDays ?? 1;
  const severeCount = corridorRisks.filter((c) => c.risk.score >= 50).length;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`Early-warning system · ${fmtDateShort(board.todayISO)}`}
        title="See the storm before"
        accent="the fixture."
        description="Realised-volatility regime, live disruption signals, port congestion and Bay of Bengal weather windows are fused into corridor-level risk scores — flagging where chartering decisions need buffers, clauses, or a different berth entirely."
        right={<Badge tone={severeCount >= 4 ? "bad" : severeCount >= 2 ? "warn" : "good"}>{severeCount} corridors ≥ elevated</Badge>}
      />

      {/* gauges */}
      <section className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        {board.classes.map((c) => (
          <Card key={c.code} hover className="anim-fade-up flex flex-col items-center py-6">
            <p className="eyebrow mb-3">{c.name}</p>
            <Gauge
              value={c.fc.stats.volPercentile}
              label="Volatility percentile"
              caption={`20d ${c.fc.stats.vol20}% · 60d ${c.fc.stats.vol60}% ann.`}
            />
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-fog">
              <ShieldAlert className={clsx("h-3.5 w-3.5", c.fc.stats.volPercentile >= 66 ? "text-rose" : c.fc.stats.volPercentile >= 40 ? "text-brand" : "text-teal")} />
              {c.fc.stats.volPercentile >= 66 ? "Unstable regime — widen fixing bands" : c.fc.stats.volPercentile >= 40 ? "Transition regime — hedge selectively" : "Calm regime — fix with confidence"}
            </div>
          </Card>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* corridor matrix */}
        <Card className="anim-fade-up">
          <SectionLabel right={<span className="num text-[10px] text-fog">ref: {ref.name}</span>}>
            Corridor risk matrix · composite score
          </SectionLabel>
          <div className="space-y-2.5">
            {corridorRisks.slice(0, 10).map(({ route, risk, fwd90 }, i) => (
              <div key={route.code} className="group flex items-center gap-4 rounded-xl border border-line bg-ink-800/40 px-4 py-3 transition-colors hover:border-line-strong">
                <span className="num w-5 text-[11px] font-bold text-fog">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[12.5px] font-semibold text-paper">{route.origin.name} → {route.dest.name}</span>
                    <span className="text-[10px] text-fog">{route.commodity}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-fog">{risk.factors.filter((f) => f.tone !== "good")[0]?.detail ?? "All factors benign."}</p>
                </div>
                <span className={clsx("num hidden text-[11px] sm:block", fwd90 >= 0 ? "text-teal" : "text-rose")}>
                  {fwd90 >= 0 ? "+" : ""}{fwd90}%<span className="text-fog">/90d</span>
                </span>
                <div className="w-28 shrink-0">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="num text-[11px] font-bold text-paper">{risk.score}</span>
                    <Badge tone={BAND_TONE[risk.band]} className="!px-2 !py-0.5 !text-[8.5px]">{risk.band}</Badge>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div
                      className={clsx("h-full rounded-full", risk.score >= 70 ? "bg-rose" : risk.score >= 50 ? "bg-brand" : risk.score >= 30 ? "bg-sky" : "bg-teal")}
                      style={{ width: `${risk.score}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-fog">Composite = 40% volatility regime + ≤30% live disruption severity + ≤20% congestion exposure + ≤10% seasonal weather window.</p>
        </Card>

        {/* port congestion */}
        <div className="space-y-4">
          <Card className="anim-fade-up">
            <SectionLabel>Congestion watch</SectionLabel>
            <div className="space-y-3">
              {congested.map((p) => (
                <div key={p.code}>
                  <div className="mb-1 flex items-center justify-between text-[11.5px]">
                    <span className="font-medium text-paper">{p.name} <span className="text-[10px] text-fog">· {p.country}</span></span>
                    <span className="flex items-center gap-2">
                      {p.congestionTrend === "RISING" ? (
                        <ArrowUpRight className="h-3 w-3 text-rose" />
                      ) : p.congestionTrend === "EASING" ? (
                        <ArrowDownRight className="h-3 w-3 text-teal" />
                      ) : (
                        <Minus className="h-3 w-3 text-fog" />
                      )}
                      <span className="num font-semibold text-paper">{p.congestionDays.toFixed(1)}d</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                    <div
                      className={clsx("h-full rounded-full", p.congestionDays >= 4 ? "bg-gradient-to-r from-brand to-rose" : p.congestionDays >= 2 ? "bg-brand/80" : "bg-teal/70")}
                      style={{ width: `${(p.congestionDays / maxCong) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="anim-fade-up">
            <SectionLabel>Factor anatomy</SectionLabel>
            <div className="space-y-2.5">
              {(() => {
                const top = corridorRisks[0];
                if (!top) return null;
                return (
                  <>
                    <p className="text-[11px] text-fog">
                      Decomposition of the highest-risk corridor — <span className="font-semibold text-paper">{top.route.origin.name} → {top.route.dest.name}</span>
                    </p>
                    {top.risk.factors.map((f) => (
                      <div key={f.label} className="rounded-xl border border-line bg-ink-800/50 px-3.5 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11.5px] font-semibold text-paper">{f.label}</span>
                          <span className={clsx("num text-[11px] font-bold", f.tone === "bad" ? "text-rose" : f.tone === "warn" ? "text-brand-soft" : "text-teal")}>
                            +{f.weight}
                          </span>
                        </div>
                        <p className="mt-1 text-[10.5px] leading-snug text-fog">{f.detail}</p>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </Card>
        </div>
      </div>

      {/* event feed */}
      <Card className="anim-fade-up">
        <SectionLabel right={<Badge tone="warn">{board.events.length} live signals</Badge>}>Disruption feed</SectionLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {board.events.map((e) => {
            const meta = TYPE_META[e.type] ?? TYPE_META.DEMAND;
            const Icon = meta.icon;
            return (
              <div key={e.id} className="panel-hover flex gap-3.5 rounded-xl border border-line bg-ink-800/40 p-4">
                <span className={clsx(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                  meta.tone === "bad" ? "border-rose/30 bg-rose/10 text-rose" : meta.tone === "warn" ? "border-brand/30 bg-brand/10 text-brand-soft" : "border-sky/30 bg-sky/10 text-sky"
                )}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[12.5px] font-semibold leading-snug text-paper">{e.title}</p>
                    <div className="flex shrink-0 gap-0.5 pt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={clsx("h-1.5 w-1.5 rounded-full", i < e.severity ? (e.severity >= 4 ? "bg-rose" : e.severity === 3 ? "bg-brand" : "bg-sky") : "bg-ink-600")} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-fog">{e.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                    <span className="num rounded bg-ink-700/70 px-1.5 py-0.5 uppercase tracking-wider text-mist">{e.type}</span>
                    <span className="text-fog">{fmtDateShort(e.startDate)}{e.endDate ? ` → ${fmtDateShort(e.endDate)}` : ""}</span>
                    <span className="truncate text-brand-soft/80">{e.impact}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
