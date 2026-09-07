import { Fragment } from "react";
import clsx from "clsx";
import Link from "next/link";
import { CalendarClock, Hourglass, Layers, PiggyBank } from "lucide-react";
import { Badge, Card, PageHeader, SectionLabel, fmtDateShort, fmtUsd } from "@/components/ui";
import { getMarketBoard } from "@/lib/insights";
import { mean } from "@/lib/forecast";

export const dynamic = "force-dynamic";

function heatColor(deltaPct: number): string {
  // negative delta = cheaper than spot = attractive entry (teal); positive = premium (rose)
  const a = Math.min(1, Math.abs(deltaPct) / 14);
  return deltaPct <= 0
    ? `rgba(43, 217, 199, ${0.08 + a * 0.55})`
    : `rgba(251, 94, 126, ${0.07 + a * 0.5})`;
}

export default async function TimingPage() {
  const board = await getMarketBoard();

  const rows = board.classes.map((c) => {
    const pts = c.fc.points.slice(0, 168);
    const weeks: { delta: number; start: string }[] = [];
    for (let w = 0; w < 12; w++) {
      const slice = pts.slice(w * 7, w * 7 + 7);
      if (!slice.length) break;
      const avg = mean(slice.map((p) => p.p50));
      weeks.push({ delta: ((avg - c.fc.stats.spot) / c.fc.stats.spot) * 100, start: slice[0].date });
    }
    return { c, weeks };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Optimal market entry · spot-to-period transition"
        title="Fix the curve before"
        accent="the curve fixes you."
        description="The engine scans every contiguous 30/60/90-day window of the forecast path and prices the alternative — staying spot with volatility tail-risk — so you can convert rolling fixtures into short and medium-term cover at the cheapest defensible entry."
      />

      {/* verdict cards */}
      <section className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {board.classes.map((c) => {
          const t = c.fc.timing;
          const best90 = t.cheapestWindows.find((w) => w.windowDays === 90) ?? t.cheapestWindows[0];
          return (
            <Card key={c.code} hover className="anim-fade-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hourglass className="h-4 w-4 text-brand-soft" />
                  <span className="text-[13.5px] font-bold text-paper">{c.name}</span>
                </div>
                <Badge tone={t.tone}>{t.verdict}</Badge>
              </div>
              <div className="mt-4">
                <p className="eyebrow !text-[9px]">Optimal 90-day window</p>
                <p className="num mt-1.5 text-[15px] font-bold text-paper">
                  {fmtDateShort(best90.startDate)} → {fmtDateShort(best90.endDate)}
                </p>
                <p className="num mt-0.5 text-[11.5px] text-mist">
                  avg {fmtUsd(best90.avgRate)}/d · <span className={best90.vsSpotPct <= 0 ? "text-teal" : "text-rose"}>{best90.vsSpotPct > 0 ? "+" : ""}{best90.vsSpotPct}% vs spot</span>
                </p>
              </div>
              <div className="mt-4 space-y-1.5 border-t border-line/60 pt-3.5 text-[11px]">
                <div className="flex justify-between"><span className="text-fog">Fixable period ref</span><span className="num text-paper">{fmtUsd(t.spotVsPeriod.fixedRefRate)}/d</span></div>
                <div className="flex justify-between"><span className="text-fog">Spot path 180d (P50)</span><span className="num text-paper">{fmtUsd(t.spotVsPeriod.spotPath180)}/d</span></div>
                <div className="flex justify-between"><span className="text-fog">Tail risk removed</span><span className="num text-teal">{fmtUsd(t.spotVsPeriod.tailRiskCost)}/d</span></div>
                <div className="flex justify-between"><span className="text-fog">Confidence</span><span className="num text-paper">{t.confidence.score}% {t.confidence.label}</span></div>
              </div>
            </Card>
          );
        })}
      </section>

      {/* heatmap */}
      <Card className="anim-fade-up">
        <SectionLabel
          right={
            <div className="flex items-center gap-4 text-[10px] text-fog">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: heatColor(-10) }} /> cheaper than spot — accumulate</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: heatColor(10) }} /> premium — defer / pre-sold</span>
            </div>
          }
        >
          <span className="inline-flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 text-brand" /> Forward curve heat — weekly mean vs today's spot, 12 weeks</span>
        </SectionLabel>

        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[150px_repeat(12,1fr)] gap-1.5">
              <div />
              {rows[0]?.weeks.map((w, i) => (
                <div key={i} className="pb-1 text-center">
                  <span className="num text-[9px] uppercase text-fog">w{i + 1}</span>
                  <span className="num block text-[8.5px] text-fog/60">{fmtDateShort(w.start)}</span>
                </div>
              ))}
              {rows.map(({ c, weeks }) => (
                <Fragment key={c.code}>
                  <Link href={`/forecast?class=${c.code}`} className="flex items-center gap-2 pr-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                    <span className="truncate text-[11.5px] font-semibold text-paper hover:text-brand-soft">{c.name}</span>
                  </Link>
                  {weeks.map((w, i) => (
                    <div
                      key={i}
                      className="heat-cell flex h-10 items-center justify-center rounded-lg"
                      style={{ background: heatColor(w.delta) }}
                      title={`${c.name} w${i + 1}: ${w.delta > 0 ? "+" : ""}${w.delta.toFixed(1)}% vs spot`}
                    >
                      <span className={clsx("num text-[10px] font-semibold", w.delta <= 0 ? "text-teal" : "text-rose/90")}>
                        {w.delta > 0 ? "+" : ""}{w.delta.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-fog">
          Cells mark the projected weekly mean relative to today's spot print per segment. Teal clusters are accumulation zones for period cover; rose cells are where spot flexibility is worth paying for.
        </p>
      </Card>

      {/* spot vs period strategy table */}
      <Card className="anim-fade-up">
        <SectionLabel right={<Layers className="h-3.5 w-3.5 text-fog" />}>Spot → period conversion desk</SectionLabel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-line bg-ink-800/40 text-[9.5px] uppercase tracking-[0.14em] text-fog">
                <th className="px-4 py-3 font-medium">Segment</th>
                <th className="px-4 py-3 font-medium">Verdict</th>
                <th className="px-4 py-3 font-medium">Spot now</th>
                <th className="px-4 py-3 font-medium">6-mo spot path (P50)</th>
                <th className="px-4 py-3 font-medium">Fixable period</th>
                <th className="px-4 py-3 font-medium">Edge</th>
                <th className="px-4 py-3 font-medium">Desk note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {board.classes.map((c) => {
                const t = c.fc.timing;
                const edge = ((t.spotVsPeriod.spotPath180 - t.spotVsPeriod.fixedRefRate) / t.spotVsPeriod.spotPath180) * 100;
                return (
                  <tr key={c.code} className="transition-colors hover:bg-ink-800/40">
                    <td className="px-4 py-3.5">
                      <Link href={`/forecast?class=${c.code}`} className="font-semibold text-paper hover:text-brand-soft">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3.5"><Badge tone={t.tone}>{t.verdict}</Badge></td>
                    <td className="num px-4 py-3.5 text-paper">{fmtUsd(c.fc.stats.spot)}</td>
                    <td className="num px-4 py-3.5 text-paper">{fmtUsd(t.spotVsPeriod.spotPath180)}</td>
                    <td className="num px-4 py-3.5 font-semibold text-brand-soft">{fmtUsd(t.spotVsPeriod.fixedRefRate)}</td>
                    <td className="px-4 py-3.5">
                      <span className={clsx("num inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold", edge >= 0 ? "bg-teal/10 text-teal" : "bg-rose/10 text-rose")}>
                        <PiggyBank className="h-3 w-3" /> {edge >= 0 ? "+" : ""}{edge.toFixed(1)}%
                      </span>
                    </td>
                    <td className="max-w-[340px] px-4 py-3.5 text-[11px] leading-snug text-fog">{t.headline}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
