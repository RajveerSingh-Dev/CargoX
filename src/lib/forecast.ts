// ---------------------------------------------------------------------------
// Coromandel Freight Intelligence — forecasting engine
// Robust seasonal decomposition (calendar-month indices on a detrended ratio)
// + damped-trend Holt exponential smoothing with grid-search parameter
// optimisation against one-step holdout MAPE. Bands widen with sqrt(horizon).
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface ForecastPoint {
  date: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  monthIdx: number;
}

export interface ForecastResult {
  points: ForecastPoint[];
  horizon: number;
  stats: {
    spot: number;
    holdoutMape: number; // % — one figure for "model accuracy"
    sigmaPct: number; // daily residual dispersion
    vol20: number; // annualised realised vol, 20d (%)
    vol60: number;
    volPercentile: number; // 0..100 vs trailing 2y
    trendPct30: number; // fwd 30d mean vs spot (%)
    trendPct90: number;
    fwd30: number;
    fwd90: number;
    fwd180: number;
    spotPercentile: number; // spot vs trailing 2y, 0..100
    monthIndices: number[]; // 12, normalised mean=1
    alpha: number;
    beta: number;
    phi: number;
    softMonths: { index: number; idx: number }[]; // seasonal troughs (idx<0.97)
    peakMonths: { index: number; idx: number }[];
  };
}

// ------------------------------------------------------------------ helpers
export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < sorted.length) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  return quantile([...xs].sort((a, b) => a - b), 0.5);
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1));
}

export function logReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0 && values[i] > 0) out.push(Math.log(values[i] / values[i - 1]));
  }
  return out;
}

export function percentileRank(values: number[], x: number): number {
  const below = values.filter((v) => v <= x).length;
  return Math.round((below / values.length) * 100);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const monthName = (i: number) => MONTH_NAMES[i];

function addDaysISO(dateISO: string, n: number): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const monthOf = (iso: string) => new Date(iso + "T00:00:00Z").getUTCMonth();

// ------------------------------------------------ seasonal monthly indices
// OLS dummy regression on log-rates: log(y) = a + b·t + Σ βₘ·D_m
// (January baseline). Unbiased monthly factors — no moving-average absorption.
function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / (M[i][i] || 1e-12));
}

export function monthlyIndices(series: SeriesPoint[]): number[] {
  const n = series.length;
  const p = 13; // intercept + linear trend + 11 month dummies
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const XtY: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    const t = i / 365.25;
    const m = monthOf(series[i].date); // 0=Jan
    const x: number[] = new Array(p).fill(0);
    x[0] = 1;
    x[1] = t;
    if (m > 0) x[1 + m] = 1; // months 1..11 → params 2..12
    const y = Math.log(Math.max(series[i].value, 1));
    for (let r = 0; r < p; r++) {
      if (x[r] === 0) continue;
      XtY[r] += x[r] * y;
      for (let c = 0; c <= r; c++) XtX[r][c] += x[r] * x[c];
    }
  }
  for (let r = 0; r < p; r++) for (let c = 0; c < r; c++) XtX[c][r] = XtX[r][c];
  const beta = solveLinear(XtX, XtY);
  const idx: number[] = [1];
  for (let m = 1; m < 12; m++) idx.push(Math.exp(beta[1 + m] ?? 0));
  const m = mean(idx);
  return idx.map((v) => v / m);
}

// -------------------------------------------------- damped Holt core
interface HoltFit {
  level: number;
  trend: number;
  oneStepPctErr: number[];
}
function holtFit(y: number[], alpha: number, beta: number, phi: number): HoltFit {
  let l = y[0];
  let b = y.length > 1 ? y[1] - y[0] : 0;
  const errs: number[] = [];
  for (let t = 1; t < y.length; t++) {
    const f = l + phi * b;
    if (f > 0) errs.push((y[t] - f) / f);
    const lNew = alpha * y[t] + (1 - alpha) * (l + phi * b);
    const bNew = beta * (lNew - l) + (1 - beta) * phi * b;
    l = lNew;
    b = bNew;
  }
  return { level: l, trend: b, oneStepPctErr: errs };
}

function optimiseHolt(y: number[]): { alpha: number; beta: number; phi: number } {
  let best = { alpha: 0.3, beta: 0.05, phi: 0.95, score: Infinity };
  const alphas = [0.15, 0.23, 0.31, 0.39, 0.47, 0.55];
  const betas = [0.01, 0.04, 0.07, 0.11, 0.16];
  const phis = [0.9, 0.95, 1.0];
  const tail = y.slice(-Math.min(240, y.length)); // weight the recent regime
  for (const a of alphas)
    for (const b of betas)
      for (const p of phis) {
        const fit = holtFit(tail, a, b, p);
        const mape = mean(fit.oneStepPctErr.map((e) => Math.abs(e)));
        if (mape < best.score) best = { alpha: a, beta: b, phi: p, score: mape };
      }
  return { alpha: best.alpha, beta: best.beta, phi: best.phi };
}

// -------------------------------------------------------------- main entry
export function forecastSeries(series: SeriesPoint[], horizon = 180): ForecastResult {
  const n = series.length;
  const idx = monthlyIndices(series);
  const deseas = series.map((p) => p.value / idx[monthOf(p.date)]);

  // parameter optimisation + holdout validation (last 60 days)
  const { alpha, beta, phi } = optimiseHolt(deseas);
  const holdoutN = Math.min(60, Math.floor(n / 3));
  const train = deseas.slice(0, n - holdoutN);
  const holdFit = holtFit(train, alpha, beta, phi);
  // multi-step holdout errors
  const holdErrs: number[] = [];
  for (let h = 1; h <= holdoutN; h++) {
    const dampedSum = phi === 1 ? h : (phi * (1 - Math.pow(phi, h))) / (1 - phi);
    const fDeseas = holdFit.level + dampedSum * holdFit.trend;
    const actual = deseas[n - holdoutN + (h - 1)];
    holdErrs.push(Math.abs(actual - fDeseas) / Math.max(actual, 1));
  }
  const holdoutMape = mean(holdErrs) * 100;

  // final fit on full history
  const fit = holtFit(deseas, alpha, beta, phi);
  const sigmaPct = std(fit.oneStepPctErr);

  const points: ForecastPoint[] = [];
  const lastLevel = fit.level;
  for (let h = 1; h <= horizon; h++) {
    const dampedSum = phi === 1 ? h : (phi * (1 - Math.pow(phi, h))) / (1 - phi);
    const fDeseas = lastLevel + dampedSum * fit.trend;
    const dateISO = addDaysISO(series[n - 1].date, h);
    const seasonal = idx[monthOf(dateISO)];
    const p50 = Math.max(500, fDeseas * seasonal);
    const w = sigmaPct * Math.sqrt(h) * 1.15;
    points.push({
      date: dateISO,
      p50: Math.round(p50 / 25) * 25,
      p25: Math.round((p50 * (1 - 0.674 * w)) / 25) * 25,
      p75: Math.round((p50 * (1 + 0.674 * w)) / 25) * 25,
      p10: Math.round((Math.max(200, p50 * (1 - 1.28 * w))) / 25) * 25,
      p90: Math.round((p50 * (1 + 1.28 * w)) / 25) * 25,
      monthIdx: seasonal,
    });
  }

  const values = series.map((p) => p.value);
  const spot = values[n - 1];
  const fwdMean = (h: number) => (h <= 0 ? spot : mean(points.slice(0, Math.min(h, points.length)).map((p) => p.p50)));
  const lr = logReturns(values);
  const realizedVol = (k: number) => std(lr.slice(-k)) * Math.sqrt(252) * 100;
  // vol percentile: distribute trailing vol20 observations
  const volTrail: number[] = [];
  for (let i = 60; i < lr.length; i += 5) volTrail.push(std(lr.slice(Math.max(0, i - 20), i)) * Math.sqrt(252) * 100);
  const vol20 = realizedVol(20);

  const softMonths = idx.map((v, i) => ({ index: i, idx: v })).filter((m) => m.idx < 0.975).sort((a, b) => a.idx - b.idx);
  const peakMonths = idx.map((v, i) => ({ index: i, idx: v })).filter((m) => m.idx > 1.025).sort((a, b) => b.idx - a.idx);
  const f30 = fwdMean(30);
  const f90 = fwdMean(90);

  return {
    points,
    horizon,
    stats: {
      spot: Math.round(spot),
      holdoutMape: Math.round(holdoutMape * 10) / 10,
      sigmaPct: Math.round(sigmaPct * 1000) / 10,
      vol20: Math.round(vol20 * 10) / 10,
      vol60: Math.round(realizedVol(60) * 10) / 10,
      volPercentile: percentileRank(volTrail, vol20),
      trendPct30: Math.round(((f30 - spot) / spot) * 1000) / 10,
      trendPct90: Math.round(((f90 - spot) / spot) * 1000) / 10,
      fwd30: Math.round(f30),
      fwd90: Math.round(f90),
      fwd180: Math.round(fwdMean(180)),
      spotPercentile: percentileRank(values, spot),
      monthIndices: idx.map((v) => Math.round(v * 1000) / 1000),
      alpha,
      beta,
      phi,
      softMonths,
      peakMonths,
    },
  };
}

// --------------------------------------------------------------- timing AI
export interface TimingAdvice {
  verdict: "FIX NOW" | "STAGE COVER" | "WAIT";
  tone: "good" | "warn" | "bad";
  horizonDays: number;
  headline: string;
  rationale: string[];
  cheapestWindows: { label: string; windowDays: number; startDate: string; endDate: string; avgRate: number; vsSpotPct: number }[];
  spotVsPeriod: {
    spotPath180: number;
    fixedRefRate: number;
    tailRiskCost: number; // p90-p50 mean over 180d — what period cover insures
    periodSavingPct: number;
    recommendation: string;
  };
  confidence: { score: number; label: string };
}

export function analyzeTiming(fc: ForecastResult, contractDays = 180): TimingAdvice {
  const s = fc.stats;
  const pts = fc.points;
  const rationale: string[] = [];

  const firming = s.trendPct90 > 1.5;
  const softening = s.trendPct90 < -1.5;
  const highVol = s.volPercentile >= 70;

  let verdict: TimingAdvice["verdict"];
  let tone: TimingAdvice["tone"];
  if (firming || (s.spotPercentile < 35 && !softening)) {
    verdict = "FIX NOW";
    tone = "good";
  } else if (softening && !highVol) {
    verdict = "WAIT";
    tone = "bad";
  } else {
    verdict = "STAGE COVER";
    tone = "warn";
  }

  rationale.push(
    firming
      ? `Forward curve firms ${s.trendPct90.toFixed(1)}% over 90 days — each week of delay raises expected fixture cost.`
      : softening
        ? `Forecast softens ${Math.abs(s.trendPct90).toFixed(1)}% over 90 days — patience is rewarded while the tape holds.`
        : `Forward curve broadly flat (${s.trendPct90 >= 0 ? "+" : ""}${s.trendPct90.toFixed(1)}% / 90d) — split cover across staggered fixings.`
  );
  rationale.push(
    s.spotPercentile <= 30
      ? `Spot prints in the ${s.spotPercentile}th percentile of the trailing 2 years — historically cheap compensation for owners.`
      : s.spotPercentile >= 70
        ? `Spot already elevated at the ${s.spotPercentile}th percentile — chasing physical tonnage now locks in the crest.`
        : `Spot sits mid-range (${s.spotPercentile}th percentile) versus the trailing 2-year distribution.`
  );
  if (s.softMonths.length) {
    const m = monthName(s.softMonths[0].index);
    rationale.push(`Seasonal trough detected in ${m} (index ${s.softMonths[0].idx.toFixed(3)}) — programme cargoes that can slip should target this window.`);
  }
  if (highVol) rationale.push(`Realised volatility is in the top ${100 - s.volPercentile}% of the 2-year regime — widen decision bands and favour staggered entries.`);

  // cheapest contiguous windows
  const windows = [30, 60, 90].map((w) => {
    let bestSum = Infinity;
    let bestStart = 0;
    let run = 0;
    for (let i = 0; i < pts.length; i++) {
      run += pts[i].p50;
      if (i >= w) run -= pts[i - w].p50;
      if (i >= w - 1 && run < bestSum) {
        bestSum = run;
        bestStart = i - w + 1;
      }
    }
    const avg = bestSum / w;
    return {
      label: `${w}-day`, windowDays: w,
      startDate: pts[bestStart].date,
      endDate: pts[Math.min(bestStart + w - 1, pts.length - 1)].date,
      avgRate: Math.round(avg),
      vsSpotPct: Math.round(((avg - s.spot) / s.spot) * 1000) / 10,
    };
  });

  // spot vs period strategy
  const span = Math.min(contractDays, pts.length);
  const p50Mean = mean(pts.slice(0, span).map((p) => p.p50));
  const p90Mean = mean(pts.slice(0, span).map((p) => p.p90));
  const fixedRef = Math.round((p50Mean * 0.985) / 25) * 25; // ind. period fixture ≈ fwd mean at modest discount
  const tailRisk = p90Mean - p50Mean;
  const periodSavingPct = Math.round(((p50Mean - fixedRef) / p50Mean) * 1000) / 10;

  const recommendation =
    verdict === "FIX NOW"
      ? `Convert rolling spot exposure into a ${Math.round(contractDays / 30)}–${Math.round(contractDays / 30) + 3}-month period fixture near $${fixedRef.toLocaleString()}/day. Locks cost below the expected spot path and removes ~$${Math.round(tailRisk).toLocaleString()}/day of tail-risk (P90 scenario).`
      : verdict === "WAIT"
        ? `Retain spot flexibility for the next 30–45 days; pre-authorise period cover at $${fixedRef.toLocaleString()}/day to trigger automatically if the curve inflects. Expected saving vs immediate fixing: ${Math.abs(periodSavingPct).toFixed(1)}%.`
        : `Stage the book: fix 40–50% of the ${Math.round(contractDays / 30)}-month requirement now near $${fixedRef.toLocaleString()}/day, review the balance at the next seasonal inflection.`;

  const confidenceScore = Math.max(35, Math.min(95, Math.round(100 - s.holdoutMape * 2.2 - s.volPercentile * 0.12)));
  const confidence = {
    score: confidenceScore,
    label: confidenceScore >= 80 ? "HIGH" : confidenceScore >= 60 ? "MODERATE" : "LOW",
  };

  const headline =
    verdict === "FIX NOW"
      ? `Period cover is cheap — expected forward path exceeds today's fixable levels.`
      : verdict === "WAIT"
        ? `Defer major commitments — the model expects cheaper tonnage within the quarter.`
        : `Neutral curve, elevated dispersion — build cover in tranches.`;

  return {
    verdict, tone, horizonDays: contractDays, headline, rationale,
    cheapestWindows: windows,
    spotVsPeriod: { spotPath180: Math.round(p50Mean), fixedRefRate: fixedRef, tailRiskCost: Math.round(tailRisk), periodSavingPct, recommendation },
    confidence,
  };
}
