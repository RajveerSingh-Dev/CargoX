import clsx from "clsx";
import Link from "next/link";
import { Anchor, ArrowRight, Compass, ListChecks, MoonStar, Sailboat, TrendingUp } from "lucide-react";
import { Badge, Card, PageHeader, SectionLabel, fmtDate } from "@/components/ui";
import { buildIdlePlan, getMarketBoard } from "@/lib/insights";

export const dynamic = "force-dynamic";

const OPEX: Record<string, number> = { HANDY: 5600, SUPRAMAX: 6300, PANAMAX: 6900, CAPE: 7900 };

export default async function IdlePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const board = await getMarketBoard();
  const selected = typeof sp.class === "string" && board.classes.some((c) => c.code === sp.class) ? sp.class : "SUPRAMAX";
  const plan = await buildIdlePlan(selected);

  if (!plan) return null;
  const opex = OPEX[selected] ?? 6300;

  const daysUntil = (iso: string) =>
    Math.max(0, Math.round((new Date(iso + "T00:00:00Z").getTime() - new Date(board.todayISO + "T00:00:00Z").getTime()) / 86400000));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Idle scenario management · demand trough forecasting"
        title="Idle ships sink"
        accent="chartering P&L."
        description="Seasonal demand troughs are forecast months ahead so tonnage can be positioned before earnings dry up — docking schedules, COA cover and ballast routes are sequenced to minimise open days and deadheading."
        right={
          <div className="flex flex-wrap gap-1.5">
            {board.classes.map((c) => (
              <Link
                key={c.code}
                href={`/idle?class=${c.code}`}
                className={clsx(
                  "rounded-lg border px-3.5 py-2 text-[12px] font-semibold transition-all",
                  selected === c.code
                    ? "border-brand/50 bg-brand/15 text-brand-soft"
                    : "border-line bg-ink-800/60 text-fog hover:text-mist"
                )}
              >
                {c.code}
              </Link>
            ))}
          </div>
        }
      />

      {/* soft windows + outlook */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="anim-fade-up">
          <SectionLabel right={<MoonStar className="h-3.5 w-3.5 text-brand" />}>
            Forecast low-demand windows · {selected === "SUPRAMAX" ? "Supramax / Ultramax" : selected === "PANAMAX" ? "Panamax / Kamsarmax" : selected === "CAPE" ? "Capesize" : "Handysize"}
          </SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {plan.softMonths.map((m, i) => {
              const d = daysUntil(m.nextDate);
              return (
                <div key={m.name} className={clsx("rounded-xl border p-4", i === 0 ? "border-teal/25 bg-teal/[0.05]" : "border-line bg-ink-800/50")}>
                  <div className="flex items-center justify-between">
                    <span className="display-italic text-[19px] text-paper">{m.name}</span>
                    {i === 0 && <Badge tone="good">Deepest trough</Badge>}
                  </div>
                  <p className="num mt-2 text-[24px] font-bold text-teal">{(m.idx * 100).toFixed(1)}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-fog">seasonal index (100 = trend)</p>
                  <div className="mt-3 border-t border-line/50 pt-2.5 text-[11px] text-fog">
                    Next occurrence <span className="num text-mist">{fmtDate(m.nextDate)}</span>
                    <span className="num block text-brand-soft">T-{d} days</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 rounded-xl border border-line bg-ink-800/50 px-4 py-3.5 text-[12.5px] leading-relaxed text-mist">{plan.demandOutlook}</p>
        </Card>

        {/* cost of idle */}
        <Card className="anim-fade-up flex flex-col">
          <SectionLabel>Cost of doing nothing</SectionLabel>
          <div className="flex flex-1 flex-col justify-center">
            <p className="num text-[44px] font-bold leading-none text-rose">${opex.toLocaleString()}</p>
            <p className="mt-2 text-[11.5px] text-fog">daily cash burn of an idle {selected} (opex + finance, zero revenue)</p>
            <div className="mt-5 space-y-2 text-[12px]">
              {[
                ["10 idle days", `$${(opex * 10 / 1000).toFixed(0)}k lost`],
                ["30 idle days", `$${(opex * 30 / 1000).toFixed(0)}k lost`],
                ["Ballast 6 days + prompt cargo", `≈ -$${Math.max(6, Math.round(opex * 6 / 1000 - 9))}k net better than waiting`],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between border-b border-line/50 pb-2 last:border-0">
                  <span className="text-fog">{l}</span>
                  <span className="num font-medium text-paper">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* repositioning board */}
      <Card className="anim-fade-up">
        <SectionLabel right={<Compass className="h-3.5 w-3.5 text-brand" />}>
          Repositioning board · ranked yield per ballast day
        </SectionLabel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-line bg-ink-800/40 text-[9.5px] uppercase tracking-[0.14em] text-fog">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Corridor</th>
                <th className="px-4 py-3 font-medium">Commodity</th>
                <th className="px-4 py-3 font-medium">Fwd 30d TCE</th>
                <th className="px-4 py-3 font-medium">30d trend</th>
                <th className="px-4 py-3 font-medium">vs fleet median</th>
                <th className="px-4 py-3 font-medium">Ballast leg</th>
                <th className="px-4 py-3 font-medium">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {plan.reposition.map((r, i) => (
                <tr key={r.routeCode} className="transition-colors hover:bg-ink-800/40">
                  <td className="num px-4 py-3.5 font-bold text-fog">{i + 1}</td>
                  <td className="px-4 py-3.5">
                    <span className="font-semibold text-paper">{r.origin}</span>
                    <ArrowRight className="mx-1.5 inline h-3 w-3 text-fog" />
                    <span className="text-mist">{r.dest}</span>
                  </td>
                  <td className="px-4 py-3.5 text-fog">{r.commodity}</td>
                  <td className="num px-4 py-3.5 font-semibold text-paper">${r.fwd30.toLocaleString()}</td>
                  <td className={clsx("num px-4 py-3.5", r.trendPct30 >= 0 ? "text-teal" : "text-rose")}>
                    {r.trendPct30 >= 0 ? "+" : ""}{r.trendPct30}%
                  </td>
                  <td className={clsx("num px-4 py-3.5", r.premiumPct >= 0 ? "text-teal" : "text-rose")}>
                    {r.premiumPct >= 0 ? "+" : ""}{r.premiumPct}%
                  </td>
                  <td className="num px-4 py-3.5 text-mist">{r.ballastDays}d</td>
                  <td className="px-4 py-3.5">
                    <Badge tone={i === 0 ? "good" : i <= 2 ? "neutral" : "mute"}>{i === 0 ? "STRONG" : i <= 2 ? "FAVOUR" : "NEUTRAL"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] text-fog">Score blends forward earnings, momentum and ballast distance from a typical East Coast India discharge. Corridors the selected class physically cannot trade (draft/gear) are excluded automatically.</p>
      </Card>

      {/* action checklist */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="anim-fade-up">
          <SectionLabel right={<ListChecks className="h-3.5 w-3.5 text-brand" />}>Idle-avoidance playbook</SectionLabel>
          <div className="space-y-3">
            {plan.actions.map((a, i) => (
              <div key={i} className="flex items-start gap-3.5 rounded-xl border border-line bg-ink-800/40 px-4 py-3.5">
                <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/15 text-[11px] font-bold text-brand-soft">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[12.5px] leading-relaxed text-mist">{a}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="anim-fade-up">
          <SectionLabel right={<Sailboat className="h-3.5 w-3.5 text-brand" />}>Peak windows — press advantage</SectionLabel>
          <div className="space-y-2.5">
            {plan.peakMonths.map((m) => (
              <div key={m.name} className="flex items-center justify-between rounded-xl border border-line bg-ink-800/50 px-4 py-3">
                <span className="display-italic text-[16px] text-paper">{m.name}</span>
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-rose" />
                  <span className="num text-[13px] font-bold text-rose">{(m.idx * 100).toFixed(1)}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-brand/20 bg-brand/[0.06] px-4 py-3 text-[11.5px] leading-relaxed text-brand-soft">
            Counter-cyclical posture: keep vessels open into peak months for premium re-letting, and pre-commit tonnage only into the troughs where owners get desperate.
          </p>
        </Card>
      </div>

      <div className="anim-fade-up flex items-center gap-3 rounded-xl border border-line bg-ink-900/60 px-5 py-4">
        <Anchor className="h-4 w-4 shrink-0 text-fog" />
        <p className="text-[11.5px] leading-relaxed text-fog">
          Playbook thresholds are model-driven (seasonal index &lt; 97.5% of trend). Combine with the <Link href="/risk" className="font-semibold text-brand-soft hover:text-brand">Risk Radar</Link> before releasing ballast orders, and validate hire references on the <Link href="/forecast" className="font-semibold text-brand-soft hover:text-brand">Rate Forecast</Link>.
        </p>
      </div>
    </div>
  );
}
