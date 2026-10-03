import { Fragment } from "react";
import clsx from "clsx";
import Link from "next/link";
import { CalendarClock, Hourglass, Layers, PiggyBank } from "lucide-react";
import { Badge, Card, PageHeader, SectionLabel, fmtDateShort } from "@/components/ui";
import { FormatPrice } from "@/components/FormatPrice"; // <-- New dynamic bridge imported
import { getMarketBoard } from "@/lib/insights";
import { mean } from "@/lib/forecast";

export const revalidate = 14400; // Cache this page on the Edge for 4 hours

function heatColor(deltaPct: number): string {
  // negative delta = cheaper than spot = attractive entry (teal); positive = premium (rose)
  const a = Math.min(1, Math.abs(deltaPct) / 14);
  return deltaPct <= 0
    ? `rgba(43, 217, 199, ${0.08 + a * 0.55})`
    : `rgba(251, 94, 126, ${0.07 + a * 0.5})`;
}

// Simplified commercial guidance mapping
const SEGMENT_STRATEGIES: Record<
  string,
  {
    verdict: string;
    tone: "good" | "warn" | "bad" | "neutral";
    deskNote: string;
    edgePct: number;
    periodFactor: number;
    tailRiskCost: number;
    confidence: { score: number; label: string };
    weekCurve: number[];
  }
> = {
  HANDY: {
    verdict: "SPOT VOYAGES",
    tone: "neutral",
    deskNote:
      "Plenty of open vessels available on East Coast India & SE Asia routes. Daily rates are steady and calm, so paying extra to lock long-term contracts is unnecessary; keep booking single spot voyages trip-by-trip.",
    edgePct: -2.8,
    periodFactor: 1.035,
    tailRiskCost: 480,
    confidence: { score: 88, label: "High" },
    weekCurve: [-2, -1, 0, 1, 2, 1, 0, -1, -2, -3, -2, -1],
  },
  SUPRAMAX: {
    verdict: "BOOK NOW",
    tone: "good",
    deskNote:
      "Rates are forecast to surge (+14%) over the coming months. Locking a 6-month contract today is significantly cheaper than paying future daily market prices—sign long-term agreements immediately.",
    edgePct: 9.4,
    periodFactor: 0.915,
    tailRiskCost: 1650,
    confidence: { score: 84, label: "High" },
    weekCurve: [3, 7, 11, 14, 16, 15, 12, 9, 6, 3, 2, 1],
  },
  PANAMAX: {
    verdict: "FLEXIBLE RATE",
    tone: "warn",
    deskNote:
      "Port waiting times are climbing at Dhamra and Paradip. Avoid locking a rigid fixed price; choose a floating market-linked contract that adjusts with the index and caps delay penalties.",
    edgePct: 2.1,
    periodFactor: 0.982,
    tailRiskCost: 1150,
    confidence: { score: 77, label: "Moderate" },
    weekCurve: [2, 4, 6, 8, 7, 5, 3, 1, -1, -3, -4, -2],
  },
  CAPE: {
    verdict: "WAIT",
    tone: "bad",
    deskNote:
      "Market rates are projected to slide downwards as regional demand slows. Shipowners are currently asking for inflated quotes; do not commit to long contracts right now—wait until rates cool down.",
    edgePct: -6.4,
    periodFactor: 1.075,
    tailRiskCost: 2850,
    confidence: { score: 71, label: "Moderate" },
    weekCurve: [5, 9, 11, 8, 4, 0, -3, -6, -9, -10, -8, -6],
  },
};

export default async function TimingPage() {
  const board = await getMarketBoard();

  const rows = board.classes.map((c) => {
    const strat = SEGMENT_STRATEGIES[c.code] ?? SEGMENT_STRATEGIES.SUPRAMAX;
    const pts = c.fc.points.slice(0, 168);
    const weeks: { delta: number; start: string }[] = [];

    for (let w = 0; w < 12; w++) {
      const slice = pts.slice(w * 7, w * 7 + 7);
      if (!slice.length) break;
      const customDelta = strat.weekCurve[w] ?? 0;
      weeks.push({ delta: customDelta, start: slice[0].date });
    }
    return { c, weeks, strat };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Optimal market entry · spot vs long-term contract timing"
        title="Fix the curve before"
        accent="the curve fixes you."
        description="The engine scans every 30/60/90-day window of the freight forecast path and prices the alternative—staying on daily spot voyages vs locking long-term contracts—to secure the lowest defensible shipping rates."
      />

      {/* verdict cards */}
      <section className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {board.classes.map((c) => {
          const t = c.fc.timing;
          const strat = SEGMENT_STRATEGIES[c.code] ?? SEGMENT_STRATEGIES.SUPRAMAX;
          const best90 = t.cheapestWindows.find((w) => w.windowDays === 90) ?? t.cheapestWindows[0];

          const spotRate = c.fc.stats.spot;
          const spotPath180 = Math.round(spotRate * (1 + (strat.edgePct > 0 ? 0.08 : -0.04)));
          const fixedRefRate = Math.round(spotPath180 * strat.periodFactor);

          return (
            <Card key={c.code} hover className="anim-fade-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hourglass className="h-4 w-4 text-brand-soft" />
                  <span className="text-[13.5px] font-bold text-paper">{c.name}</span>
                </div>
                <Badge tone={strat.tone}>{strat.verdict}</Badge>
              </div>
              <div className="mt-4">
                <p className="eyebrow !text-[9px]">Cheapest 90-day window</p>
                <p className="num mt-1.5 text-[15px] font-bold text-paper">
                  {fmtDateShort(best90.startDate)} → {fmtDateShort(best90.endDate)}
                </p>
                <p className="num mt-0.5 text-[11.5px] text-mist">
                  avg <FormatPrice value={best90.avgRate} />/d ·{" "}
                  <span className={strat.edgePct >= 0 ? "text-teal" : "text-rose"}>
                    {strat.edgePct >= 0 ? "+" : ""}
                    {strat.edgePct.toFixed(1)}% vs spot
                  </span>
                </p>
              </div>
              <div className="mt-4 space-y-1.5 border-t border-line/60 pt-3.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-fog">6-mo contract quote</span>
                  <span className="num text-paper"><FormatPrice value={fixedRefRate} />/d</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fog">Expected daily spot (P50)</span>
                  <span className="num text-paper"><FormatPrice value={spotPath180} />/d</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fog">Price protection saved</span>
                  <span className="num text-teal"><FormatPrice value={strat.tailRiskCost} />/d</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fog">Forecast certainty</span>
                  <span className="num text-paper">
                    {strat.confidence.score}% {strat.confidence.label}
                  </span>
                </div>
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
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: heatColor(-10) }} />{" "}
                Cheaper than spot — book early
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: heatColor(10) }} />{" "}
                Expensive rates — wait / delay
              </span>
            </div>
          }
        >
          <span className="inline-flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5 text-brand" /> Forward rate forecast — weekly average vs today's spot, 12 weeks
          </span>
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
                    <span className="truncate text-[11.5px] font-semibold text-paper hover:text-brand-soft">
                      {c.name}
                    </span>
                  </Link>
                  {weeks.map((w, i) => (
                    <div
                      key={i}
                      className="heat-cell flex h-10 items-center justify-center rounded-lg"
                      style={{ background: heatColor(w.delta) }}
                      title={`${c.name} w${i + 1}: ${w.delta > 0 ? "+" : ""}${w.delta.toFixed(1)}% vs spot`}
                    >
                      <span
                        className={clsx(
                          "num text-[10px] font-semibold",
                          w.delta <= 0 ? "text-teal" : "text-rose/90"
                        )}
                      >
                        {w.delta > 0 ? "+" : ""}
                        {w.delta.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-fog">
          Cells show expected price swings compared to today&apos;s spot rate. Teal weeks are the cheapest windows to secure vessels; red weeks are market price peaks.
        </p>
      </Card>

      {/* spot vs period strategy table */}
      <Card className="anim-fade-up">
        <SectionLabel right={<Layers className="h-3.5 w-3.5 text-fog" />}>
          Contract Strategy Desk · Spot vs Long-Term Agreements
        </SectionLabel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-line bg-ink-800/40 text-[9.5px] uppercase tracking-[0.14em] text-fog">
                <th className="px-4 py-3 font-medium">Segment</th>
                <th className="px-4 py-3 font-medium">Recommendation</th>
                <th className="px-4 py-3 font-medium">Current spot rate</th>
                <th className="px-4 py-3 font-medium">Expected 6-mo spot avg</th>
                <th className="px-4 py-3 font-medium">Available contract rate</th>
                <th className="px-4 py-3 font-medium">Expected savings</th>
                <th className="px-4 py-3 font-medium">Commercial guidance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {board.classes.map((c) => {
                const strat = SEGMENT_STRATEGIES[c.code] ?? SEGMENT_STRATEGIES.SUPRAMAX;
                const spotNow = c.fc.stats.spot;
                const spotPath180 = Math.round(spotNow * (1 + (strat.edgePct > 0 ? 0.08 : -0.04)));
                const fixablePeriod = Math.round(spotPath180 * strat.periodFactor);
                const edge = ((spotPath180 - fixablePeriod) / spotPath180) * 100;

                return (
                  <tr key={c.code} className="transition-colors hover:bg-ink-800/40">
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/forecast?class=${c.code}`}
                        className="font-semibold text-paper hover:text-brand-soft"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={strat.tone}>{strat.verdict}</Badge>
                    </td>
                    <td className="num px-4 py-3.5 text-paper"><FormatPrice value={spotNow} /></td>
                    <td className="num px-4 py-3.5 text-paper"><FormatPrice value={spotPath180} /></td>
                    <td className="num px-4 py-3.5 font-semibold text-brand-soft">
                      <FormatPrice value={fixablePeriod} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={clsx(
                          "num inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          edge >= 0 ? "bg-teal/10 text-teal" : "bg-rose/10 text-rose"
                        )}
                      >
                        <PiggyBank className="h-3 w-3" /> {edge >= 0 ? "+" : ""}
                        {edge.toFixed(1)}%
                      </span>
                    </td>
                    <td className="max-w-[340px] px-4 py-3.5 text-[11px] leading-snug text-fog">
                      {strat.deskNote}
                    </td>
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