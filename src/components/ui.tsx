import type { ReactNode } from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

// --------------------------------------------------------------- format
export const fmtUsd = (n: number, digits = 0) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
export const fmtPct = (n: number, signed = true) =>
  `${signed && n > 0 ? "+" : ""}${n.toFixed(1)}%`;
export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtDateShort = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

// --------------------------------------------------------------- atoms
export function Card({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={clsx("panel inset-glow p-5", hover && "panel-hover", className)}>{children}</div>;
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="h-px w-5 bg-brand/70" />
        <span className="eyebrow">{children}</span>
      </div>
      {right}
    </div>
  );
}

export function Delta({ value, suffix = "%", invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  const pos = value >= 0;
  const good = invert ? !pos : pos;
  const Icon = Math.abs(value) < 0.05 ? Minus : pos ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={clsx(
        "num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        good ? "bg-teal/10 text-teal" : "bg-rose/10 text-rose"
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {fmtPct(Math.abs(value), false)}
      {suffix !== "%" && suffix}
    </span>
  );
}

const TONES = {
  good: { dot: "bg-teal", text: "text-teal", ring: "border-teal/30 bg-teal/10" },
  warn: { dot: "bg-brand", text: "text-brand-soft", ring: "border-brand/30 bg-brand/10" },
  bad: { dot: "bg-rose", text: "text-rose", ring: "border-rose/30 bg-rose/10" },
  neutral: { dot: "bg-sky", text: "text-sky", ring: "border-sky/30 bg-sky/10" },
  mute: { dot: "bg-fog", text: "text-fog", ring: "border-line bg-ink-700/60" },
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof TONES; className?: string }) {
  const t = TONES[tone];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]", t.ring, t.text, className)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}

export function PageHeader({
  kicker,
  title,
  accent,
  description,
  right,
}: {
  kicker: string;
  title: string;
  accent?: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="anim-fade-up mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="eyebrow mb-3">{kicker}</p>
        <h1 className="text-[34px] font-bold leading-[1.05] tracking-tight text-paper md:text-[42px]">
          {title} {accent && <span className="display-italic font-normal text-brand-soft">{accent}</span>}
        </h1>
        {description && <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-mist">{description}</p>}
      </div>
      {right}
    </div>
  );
}

export function StatRow({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-4 border-b border-line/60 py-2 last:border-0", className)}>
      <span className="text-[12px] text-fog">{label}</span>
      <span className="num text-[13px] font-medium text-paper">{value}</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="display-italic text-2xl text-brand-soft">{title}</span>
      <span className="max-w-sm text-[12.5px] text-fog">{hint}</span>
    </div>
  );
}
