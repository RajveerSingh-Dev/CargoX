"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertOctagon,
  Anchor,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Fuel,
  GaugeCircle,
  Loader2,
  ShieldAlert,
  Trophy,
  XCircle,
} from "lucide-react";
import { Badge, Card, SectionLabel } from "@/components/ui";

interface PortMeta {
  id: number; code: string; name: string; country: string; region: string; isIndiaEC: boolean;
  maxDraftM: number; maxLoaM: number; maxDwt: number | null; gearedRequired: boolean;
  congestionDays: number; congestionTrend: string; notes: string | null;
}
interface ClassMeta { id: number; code: string; name: string; dwt: number; draft: number; loa: number; geared: boolean }
interface Check { rule: string; pass: boolean; critical: boolean; detail: string }
interface Plan {
  seaDays: number; loadDays: number; dischargeDays: number; waitDays: number; totalDays: number;
  bunkerSeaT: number; bunkerPortT: number; bunkerCostUsd: number; hireCostUsd: number; portFeesUsd: number;
  totalCostUsd: number; costPerTonUsd: number; dailyHireUsd: number;
}
interface Candidate {
  cls: { id: number; code: string; name: string; typicalDwt: number; draftM: number; loaM: number; geared: boolean };
  feasible: boolean; checks: Check[]; utilizationPct: number; plan: Plan | null; reasons: string[]; warnings: string[];
}
interface Payload {
  meta: { ports: PortMeta[]; classes: ClassMeta[] };
  selection: { origin: string; dest: string; cargoT: number; commodity: string };
  result: {
    distanceNm: number; cargoT: number;
    route: { code: string; commodity: string; direction: string; nm: number } | null;
    candidates: Candidate[]; best: Candidate | null; narrative: string[]; multiFixtureNote: string | null;
  };
}

const CARGO_PRESETS = [27000, 33000, 50000, 55000, 75000, 170000];
const COMMODITIES = ["Thermal Coal", "Coking Coal", "Iron Ore", "Limestone", "Cement Clinker", "Bauxite", "Fertilizer (Urea)", "Steel Products"];

export function OptimizerForm() {
  const [origin, setOrigin] = useState("IDTAB");
  const [dest, setDest] = useState("INKRI");
  const [cargo, setCargo] = useState(55000);
  const [commodity, setCommodity] = useState("Thermal Coal");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      const q = new URLSearchParams({ origin, dest, cargo: String(cargo), commodity });
      fetch(`/api/optimize?${q}`)
        .then((r) => r.json())
        .then((d: Payload) => {
          if (!cancelled) {
            setData(d);
            setLoading(false);
          }
        })
        .catch(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [origin, dest, cargo, commodity]);

  const indiaPorts = useMemo(() => (data?.meta.ports ?? []).filter((p) => p.isIndiaEC), [data]);
  const worldPorts = useMemo(() => (data?.meta.ports ?? []).filter((p) => !p.isIndiaEC), [data]);

  const best = data?.result.best ?? null;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------ form */}
      <Card className="anim-fade-up">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_1.1fr_0.9fr]">
          <div>
            <p className="eyebrow mb-2">Load port</p>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full appearance-none rounded-lg border border-line bg-ink-800/80 px-3.5 py-2.5 text-[12.5px] font-medium text-paper outline-none focus:border-brand/50"
            >
              <optgroup label="India · East Coast">
                {indiaPorts.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </optgroup>
              <optgroup label="International origins">
                {worldPorts.map((p) => <option key={p.code} value={p.code}>{p.name} ({p.country})</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <p className="eyebrow mb-2">Discharge port</p>
            <select
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              className="w-full appearance-none rounded-lg border border-line bg-ink-800/80 px-3.5 py-2.5 text-[12.5px] font-medium text-paper outline-none focus:border-brand/50"
            >
              <optgroup label="India · East Coast">
                {indiaPorts.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </optgroup>
              <optgroup label="International">
                {worldPorts.map((p) => <option key={p.code} value={p.code}>{p.name} ({p.country})</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <p className="eyebrow mb-2">Cargo quantity — tonnes</p>
            <input
              type="number"
              min={5000}
              max={400000}
              step={1000}
              value={cargo}
              onChange={(e) => setCargo(Math.max(5000, Math.min(400000, Number(e.target.value) || 5000)))}
              className="num w-full rounded-lg border border-line bg-ink-800/80 px-3.5 py-2.5 text-[13px] font-semibold text-paper outline-none focus:border-brand/50"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CARGO_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCargo(c)}
                  className={clsx(
                    "num rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors",
                    cargo === c ? "border-brand/50 bg-brand/15 text-brand-soft" : "border-line text-fog hover:text-mist"
                  )}
                >
                  {(c / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-2">Commodity</p>
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              className="w-full appearance-none rounded-lg border border-line bg-ink-800/80 px-3.5 py-2.5 text-[12.5px] font-medium text-paper outline-none focus:border-brand/50"
            >
              {COMMODITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------ recommendation banner */}
      {data && best && best.plan && (
        <Card className={clsx("anim-fade-up relative overflow-hidden !border-brand/25", loading && "opacity-60")}>
          <div className="pointer-events-none absolute -left-20 top-0 h-full w-72 bg-gradient-to-r from-brand/[0.09] to-transparent" />
          <div className="relative flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-[#a86a10] shadow-[0_14px_34px_-8px_rgba(242,166,59,0.65)]">
                <Trophy className="h-6 w-6 text-ink-950" strokeWidth={2.2} />
              </div>
              <div>
                <p className="eyebrow">Recommended employment</p>
                <p className="display-italic mt-1 text-[30px] leading-none text-paper">{best.cls.name}</p>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: CircleDollarSign, l: "All-in freight", v: `$${best.plan.costPerTonUsd.toFixed(2)}/t` },
                { icon: Clock3, l: "Round voyage", v: `${best.plan.totalDays} days` },
                { icon: GaugeCircle, l: "Capacity used", v: `${best.utilizationPct}%` },
                { icon: Fuel, l: "Hire reference", v: `$${best.plan.dailyHireUsd.toLocaleString()}/d` },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-line bg-ink-800/60 px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.14em] text-fog"><s.icon className="h-3 w-3 text-brand-soft" /> {s.l}</p>
                  <p className="num mt-1.5 text-[17px] font-bold text-paper">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mt-4 space-y-1.5 border-t border-line/60 pt-4">
            {data.result.narrative.map((n, i) => (
              <p key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-mist">
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                {n}
              </p>
            ))}
          </div>
        </Card>
      )}

      {data && !best && (
        <Card className="anim-fade-up !border-rose/25">
          <div className="flex items-start gap-4">
            <AlertOctagon className="mt-1 h-6 w-6 shrink-0 text-rose" />
            <div>
              <p className="text-[15px] font-semibold text-paper">No single class clears this pairing</p>
              {data.result.narrative.map((n, i) => (
                <p key={i} className="mt-1.5 text-[12.5px] leading-relaxed text-mist">{n}</p>
              ))}
            </div>
          </div>
        </Card>
      )}

      {data?.result.multiFixtureNote && (
        <div className="anim-fade-up flex items-start gap-3 rounded-xl border border-sky/25 bg-sky/[0.06] px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sky" />
          <p className="text-[12px] leading-relaxed text-sky/90">{data.result.multiFixtureNote}</p>
        </div>
      )}

      {/* ------------------------------------------------ candidate cards */}
      <div className={clsx("grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4", loading && "opacity-60", "transition-opacity")}>
        {loading && !data &&
          [0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-64 animate-pulse">
              <span className="text-fog">Solving…</span>
            </Card>
          ))}
        {data?.result.candidates.map((cand) => {
          const rank = best && cand.feasible ? data.result.candidates.filter((c) => c.feasible && c.plan).sort((a, b) => a.plan!.costPerTonUsd - b.plan!.costPerTonUsd).findIndex((c) => c.cls.id === cand.cls.id) + 1 : null;
          const fails = cand.checks.filter((c) => !c.pass && c.critical);
          return (
            <Card
              key={cand.cls.id}
              hover
              className={clsx(
                "anim-fade-up flex flex-col",
                rank === 1 && "!border-brand/40 shadow-[0_20px_50px_-24px_rgba(242,166,59,0.4)]",
                !cand.feasible && "opacity-90"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {rank === 1 && <Trophy className="h-3.5 w-3.5 text-brand" />}
                    {rank !== null && rank !== undefined && rank > 1 && <span className="num text-[10px] font-bold text-fog">#{rank}</span>}
                    <p className="text-[14.5px] font-bold text-paper">{cand.cls.name}</p>
                  </div>
                  <p className="num mt-0.5 text-[10.5px] text-fog">
                    {cand.cls.typicalDwt.toLocaleString()} dwt · {cand.cls.draftM}m · {cand.cls.loaM}m LOA · {cand.cls.geared ? "GEARED" : "GEARLESS"}
                  </p>
                </div>
                {cand.feasible ? (
                  <Badge tone={rank === 1 ? "warn" : "good"}>{rank === 1 ? "Optimal" : "Feasible"}</Badge>
                ) : (
                  <Badge tone="bad">Infeasible</Badge>
                )}
              </div>

              {cand.feasible && cand.plan ? (
                <>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="num text-[26px] font-bold leading-none text-paper">${cand.plan.costPerTonUsd.toFixed(2)}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-fog">per tonne all-in</p>
                    </div>
                    <div className="text-right">
                      <p className="num text-[13px] font-semibold text-mist">${(cand.plan.totalCostUsd / 1e6).toFixed(2)}M</p>
                      <p className="text-[10px] text-fog">voyage total</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[10px] text-fog">
                      <span>capacity utilisation</span>
                      <span className="num">{cand.utilizationPct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                      <div
                        className={clsx("h-full rounded-full", cand.utilizationPct >= 80 ? "bg-teal" : cand.utilizationPct >= 60 ? "bg-brand" : "bg-rose")}
                        style={{ width: `${Math.min(100, cand.utilizationPct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-1.5 text-center">
                    {[
                      ["Sea", cand.plan.seaDays],
                      ["Cargo ops", cand.plan.loadDays + cand.plan.dischargeDays],
                      ["Waiting", cand.plan.waitDays],
                    ].map(([l, v]) => (
                      <div key={l as string} className="rounded-lg border border-line/70 bg-ink-800/50 px-1 py-1.5">
                        <p className="num text-[12.5px] font-bold text-paper">{v}d</p>
                        <p className="text-[8.5px] uppercase tracking-wider text-fog">{l}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {cand.warnings.slice(0, 2).map((w, i) => (
                      <p key={i} className="flex gap-2 text-[10.5px] leading-snug text-brand-soft/90">
                        <AlertOctagon className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                      </p>
                    ))}
                    {cand.reasons.slice(0, 1).map((r, i) => (
                      <p key={i} className="flex gap-2 text-[10.5px] leading-snug text-mist">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-teal" /> {r}
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-4 space-y-1.5">
                  {fails.map((f, i) => (
                    <p key={i} className="flex gap-2 text-[11px] leading-snug text-rose/90">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {f.detail}
                    </p>
                  ))}
                </div>
              )}

              <details className="group mt-4 border-t border-line/60 pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fog transition-colors hover:text-mist">
                  Constraint matrix ({cand.checks.filter((c) => c.pass).length}/{cand.checks.length} pass)
                  <span className="text-[11px] transition-transform group-open:rotate-90">▸</span>
                </summary>
                <div className="mt-2.5 space-y-1.5">
                  {cand.checks.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10.5px] leading-snug">
                      {c.pass ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-teal/80" /> : <XCircle className={clsx("mt-0.5 h-3 w-3 shrink-0", c.critical ? "text-rose" : "text-brand")} />}
                      <span className="text-mist"><span className="font-medium text-paper/90">{c.rule}.</span> {c.detail}</span>
                    </div>
                  ))}
                </div>
              </details>
            </Card>
          );
        })}
      </div>

      {/* ------------------------------------------------ voyage timeline */}
      {data && best?.plan && (
        <Card className={clsx("anim-fade-up", loading && "opacity-60")}>
          <SectionLabel right={<Anchor className="h-3.5 w-3.5 text-fog" />}>
            Voyage anatomy · {data.result.route ? data.result.route.code : "AD-HOC"} · {data.result.distanceNm.toLocaleString()}nm
          </SectionLabel>
          <div className="flex h-14 w-full overflow-hidden rounded-xl border border-line">
            {[
              { l: `Laden sea · ${best.plan.seaDays}d`, v: best.plan.seaDays, c: "bg-sky/70" },
              { l: `Load ops · ${best.plan.loadDays}d`, v: best.plan.loadDays, c: "bg-teal/70" },
              { l: `Idle / waiting · ${best.plan.waitDays}d`, v: best.plan.waitDays, c: "bg-rose/70" },
              { l: `Discharge · ${best.plan.dischargeDays}d`, v: best.plan.dischargeDays, c: "bg-brand/80" },
            ].map((s) => (
              <div
                key={s.l}
                className={clsx("group relative flex items-center justify-center transition-all", s.c)}
                style={{ width: `${Math.max(7, (s.v / best.plan!.totalDays) * 100)}%` }}
              >
                <span className="px-1 text-center text-[9.5px] font-bold uppercase tracking-wide text-ink-950/90">{s.l}</span>
              </div>
            ))}
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[11.5px] sm:grid-cols-4">
            <div className="flex justify-between border-b border-line/50 pb-1.5"><span className="text-fog">Hire ({best.plan.totalDays}d @ ${best.plan.dailyHireUsd.toLocaleString()})</span><span className="num text-paper">${(best.plan.hireCostUsd / 1000).toFixed(0)}k</span></div>
            <div className="flex justify-between border-b border-line/50 pb-1.5"><span className="text-fog">Bunkers ({(best.plan.bunkerSeaT + best.plan.bunkerPortT).toLocaleString()}t)</span><span className="num text-paper">${(best.plan.bunkerCostUsd / 1000).toFixed(0)}k</span></div>
            <div className="flex justify-between border-b border-line/50 pb-1.5"><span className="text-fog">Port fees both ends</span><span className="num text-paper">${(best.plan.portFeesUsd / 1000).toFixed(0)}k</span></div>
            <div className="flex justify-between border-b border-line/50 pb-1.5"><span className="text-fog font-semibold">Total voyage cost</span><span className="num font-bold text-brand-soft">${(best.plan.totalCostUsd / 1e6).toFixed(2)}M</span></div>
          </div>
        </Card>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-[11px] text-fog">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> Re-solving fleet allocation…
        </div>
      )}
    </div>
  );
}
