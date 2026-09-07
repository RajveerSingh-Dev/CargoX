import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Crosshair,
  GitBranch,
  Ship,
  TrendingUp,
} from "lucide-react";
import { Badge, Card, Delta, PageHeader, SectionLabel, fmtDate, fmtPct, fmtUsd } from "@/components/ui";
import { ForecastChart, Gauge, LegendRow, Spark } from "@/components/charts";
import { analyzeTiming, forecastSeries, mean } from "@/lib/forecast";
import { getClassSeries } from "@/lib/queries";
import { getMarketBoard } from "@/lib/insights";

export const dynamic = "force-dynamic";

const SEV_TONE = (s: number) => (s >= 4 ? "bad" : s === 3 ? "warn" : "neutral") as "bad" | "warn" | "neutral";

export default async function OverviewPage() {
  const board = await getMarketBoard();
  const seriesByClass = await Promise.all(board.classes.map((c) => getClassSeries(c.id)));

  // composite benchmark across all sizes
  const dates = seriesByClass[0]?.map((p) => p.date) ?? [];
  const compositeSeries = dates.map((d, i) => ({
    date: d,
    value: Math.round(mean(seriesByClass.map((s) => s[i]?.value ?? 0))),
  }));
  const compositeFc = forecastSeries(compositeSeries, 180);
  const compositeTiming = analyzeTiming(compositeFc);

  const spotNow = compositeSeries[compositeSeries.length - 1]?.value ?? 0;
  const activeSev = board.events.reduce((a, e) => a + e.severity, 0);
  const marketRisk = Math.min(100, compositeFc.stats.volPercentile * 0.5 + activeSev * 1.9 + 8);
  const topEvents = board.events.slice(0, 5);
  const fixNowCount = board.classes.filter((c) => c.fc.timing.verdict === "FIX NOW").length;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`Market pulse · ${fmtDate(board.todayISO)} · India East Coast dry bulk`}
        title="From reactive fixing to"
        accent="predictive chartering."
        description="A decision layer over 44 000 rate observations: seasonal decomposed Holt ensembles forecast earnings per vessel class and corridor, then translate them into fixing windows, vessel choice and risk posture."
        right={
          <div className="flex gap-3">
            <Link href="/optimizer" className="group inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-ink-950 shadow-[0_10px_30px_-8px_rgba(242,166,59,0.6)] transition-transform hover:-translate-y-0.5">
              <Ship className="h-4 w-4" strokeWidth={2.2} />
              Optimise a cargo
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        }
      />

      {/* class cards */}
      <section className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {board.classes.map((c) => {
          const snapSeries = seriesByClass.find((s) => s.length && board.classes[seriesByClass.indexOf(s)].id === c.id);
          const spark = snapSeries?.slice(-90).map((p) => p.value) ?? [];
          const chg7 =
            spark.length > 8 ? Math.round(((spark[spark.length - 1] - spark[spark.length - 8]) / spark[spark.length - 8]) * 1000) / 10 : 0;
          return (
            <Link key={c.code} href={`/forecast?class=${c.code}`}>
              <Card hover className="anim-fade-up h-full">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="eyebrow">{c.code === "SUPRAMAX" ? "SUPRAMAX / UMAX" : c.code === "PANAMAX" ? "PANAMAX / KMSMX" : c.code}</p>
                    <p className="mt-1 text-[12px] text-fog">{c.name}</p>
                  </div>
                  <Badge tone={c.fc.timing.tone}>{c.fc.timing.verdict}</Badge>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="num text-[26px] font-bold leading-none tracking-tight text-paper">{fmtUsd(c.fc.stats.spot)}</p>
                    <p className="mt-1.5 text-[10.5px] text-fog">TCE / day · fwd 90d {fmtPct(c.fc.stats.trendPct90)}</p>
                  </div>
                  <div className="w-[104px] shrink-0">
                    <Spark data={spark} up={c.fc.stats.trendPct30 >= 0} />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                  <span className="text-[10.5px] text-fog">7d move</span>
                  <Delta value={chg7} />
                  <span className="text-[10.5px] text-fog">vol regime</span>
                  <span className="num text-[11px] font-medium text-mist">P{c.fc.stats.volPercentile}</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>

      {/* composite forecast + strategy */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card className="anim-fade-up">
          <SectionLabel
            right={
              <LegendRow
                items={[
                  { color: "#e8edf8", label: "Actual composite TCE (all classes)" },
                  { color: "#f2a63b", label: "P50 forecast", dashed: false },
                  { color: "rgba(242,166,59,0.35)", label: "P25–P75 / P10–P90 bands" },
                ]}
              />
            }
          >
            CRM Composite · Forward 180-day path
          </SectionLabel>
          <ForecastChart history={compositeSeries} forecast={compositeFc.points} height={360} />
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line/60 pt-4 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ["Spot now", fmtUsd(spotNow)],
              ["Fwd 30d", `${fmtUsd(compositeFc.stats.fwd30)} (${fmtPct(compositeFc.stats.trendPct30)})`],
              ["Fwd 90d", `${fmtUsd(compositeFc.stats.fwd90)} (${fmtPct(compositeFc.stats.trendPct90)})`],
              ["Fwd 180d", fmtUsd(compositeFc.stats.fwd180)],
              ["Holdout MAPE", `${compositeFc.stats.holdoutMape}%`],
              ["Vol 20d ann.", `${compositeFc.stats.vol20}%`],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="eyebrow !text-[9px]">{l}</p>
                <p className="num mt-1 text-[13px] font-semibold text-paper">{v}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {/* strategy card */}
          <Card className="anim-fade-up relative overflow-hidden">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/[0.07] blur-2xl" />
            <SectionLabel>Spot → Period transition strategy</SectionLabel>
            <div className="flex items-center gap-3">
              <Badge tone={compositeTiming.tone}>{compositeTiming.verdict}</Badge>
              <span className="text-[11px] text-fog">
                model confidence {compositeTiming.confidence.score}% · {compositeTiming.confidence.label}
              </span>
            </div>
            <p className="display-italic mt-4 text-[21px] leading-snug text-paper">{compositeTiming.headline}</p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mist">{compositeTiming.spotVsPeriod.recommendation}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { l: "Spot path 180d", v: fmtUsd(compositeTiming.spotVsPeriod.spotPath180) },
                { l: "Fixable period", v: fmtUsd(compositeTiming.spotVsPeriod.fixedRefRate) },
                { l: "Tail premium removed", v: fmtUsd(compositeTiming.spotVsPeriod.tailRiskCost) },
              ].map((x) => (
                <div key={x.l} className="rounded-xl border border-line bg-ink-800/60 px-3 py-2.5">
                  <p className="eyebrow !text-[8.5px]">{x.l}</p>
                  <p className="num mt-1 text-[14px] font-bold text-paper">{x.v}</p>
                </div>
              ))}
            </div>
            <Link href="/timing" className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-soft hover:text-brand">
              Open fixing-window board <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          {/* risk posture */}
          <Card className="anim-fade-up">
            <SectionLabel right={<Badge tone={marketRisk >= 60 ? "bad" : marketRisk >= 40 ? "warn" : "good"}>{marketRisk >= 60 ? "SEVERE" : marketRisk >= 40 ? "ELEVATED" : "GUARDED"}</Badge>}>
              Composite risk posture
            </SectionLabel>
            <div className="flex items-center justify-around">
              <Gauge value={marketRisk} label="Market risk" caption="vol + events + congestion" />
              <Gauge value={compositeFc.stats.volPercentile} label="Vol percentile" caption={`20d ${compositeFc.stats.vol20}% ann.`} />
              <Gauge value={Math.min(100, activeSev * 4.4)} label="Alert load" caption={`${board.events.length} live signals`} />
            </div>
          </Card>
        </div>
      </section>

      {/* alerts + process */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="anim-fade-up">
          <SectionLabel
            right={
              <Link href="/risk" className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-soft hover:text-brand">
                Risk radar <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <span className="inline-flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-brand" /> Disruption watch</span>
          </SectionLabel>
          <div className="divide-y divide-line/50">
            {topEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-4 py-3.5 first:pt-0 last:pb-0">
                <Badge tone={SEV_TONE(e.severity)} className="mt-0.5 shrink-0">SEV {e.severity}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-snug text-paper">{e.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-fog">{e.description}</p>
                </div>
                <span className="num shrink-0 text-[10px] uppercase tracking-wider text-fog">{e.type}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="anim-fade-up">
          <SectionLabel>The operating loop</SectionLabel>
          <div className="space-y-4">
            {[
              { icon: TrendingUp, t: "Forecast", d: `${fixNowCount} of ${board.classes.length} segments currently screen FIX NOW on the forward curve.`, href: "/forecast", cta: "Rate explorer" },
              { icon: CalendarClock, t: "Time the entry", d: "Cheapest contiguous 30/60/90-day windows ranked against the fixing calendar.", href: "/timing", cta: "Entry board" },
              { icon: Ship, t: "Pick the hull", d: "Hard port constraints — draft, LOA, gear — resolved against voyage economics.", href: "/optimizer", cta: "Optimizer" },
              { icon: Crosshair, t: "De-risk", d: "Volatility percentile, congestion and Bay of Bengal weather fused into a corridor score.", href: "/risk", cta: "Risk radar" },
            ].map((s) => (
              <Link key={s.t} href={s.href} className="group flex items-start gap-3.5 rounded-xl border border-transparent p-2 transition-colors hover:border-line hover:bg-ink-800/50">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-ink-800 text-brand-soft">
                  <s.icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <span>
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-paper">
                    {s.t}
                    <ArrowRight className="h-3 w-3 text-fog transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-fog">{s.d}</span>
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-brand/20 bg-brand/[0.06] px-3.5 py-3">
            <GitBranch className="h-4 w-4 shrink-0 text-brand" />
            <p className="text-[11.5px] leading-relaxed text-brand-soft">
              Objective: migrate rolling spot fixtures into 3–12 month cover where the curve justifies it — the platform flags the windows.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
