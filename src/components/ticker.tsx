import { getClassSnapshots } from "@/lib/queries";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import clsx from "clsx";

export async function RateTicker() {
  const snaps = await getClassSnapshots();
  const composite = snaps.length ? Math.round(snaps.reduce((a, s) => a + s.spot, 0) / snaps.length) : 0;
  const compositeChg = snaps.length
      ? Math.round((snaps.reduce((a, s) => a + s.chg7d, 0) / snaps.length) * 10) / 10
      : 0;

  const items = [
    { label: "CRM COMPOSITE", value: composite, chg: compositeChg },
    ...snaps.map((s) => ({ label: `${s.classCode} 5TC`, value: s.spot, chg: s.chg7d })),
    { label: "VLSFO SGP", value: 645, chg: 1.8 },
    { label: "EC INDIA WAIT", value: 2.3, chg: 4.5, unit: "d" },
  ];
  const loop = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-b border-line bg-ink-900/70 py-2 backdrop-blur-md">
      <div className="ticker-track flex w-max items-center gap-10 px-6">
        {loop.map((it, i) => (
          <span key={i} className="flex items-center gap-2.5 whitespace-nowrap">
            <span className="eyebrow !text-[9px] text-fog">{it.label}</span>
            <span className="num text-[12px] font-semibold text-paper">
              {it.label.includes("WAIT") ? it.value.toFixed(1) : `$${it.value.toLocaleString()}`}
              {it.unit ?? ""}
            </span>
            <span
              className={clsx(
                "num flex items-center gap-0.5 text-[10.5px]",
                it.chg >= 0 ? "text-teal" : "text-rose"
              )}
            >
              {it.chg >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(it.chg).toFixed(1)}%
            </span>
            <span className="h-0.5 w-0.5 rounded-full bg-line-strong" />
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink-900 to-transparent" />
    </div>
  );
}
