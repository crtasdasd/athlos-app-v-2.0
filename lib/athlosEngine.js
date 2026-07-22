// ATHLOS ENGINE — JS port of athlos_engine.py (V3), line-for-line faithful.
//
// Computes Recovery (0-100), Daily Load (0-10), Recommended Sleep range, and
// Readiness (0-100) from raw device signals (Apple Health / Samsung Health
// style: hrv, rhr, resp, asleep_min, sleep_efficiency, sleep_consistency,
// calories, activities as per-activity HR-zone minutes). No external deps,
// no WHOOP or other borrowed score — everything is derived from the raw
// signals passed in.
//
// Validated (by the Python original) against 415-419 real days vs WHOOP:
// Recovery R²=0.931 (avg error 4.0pts), Load r=0.96 (avg error 0.83/10).
//
// history: array of {date, hrv, rhr, resp, asleep_min, sleep_efficiency,
//   sleep_consistency, calories, activities:[[z1..z5],...]}, oldest→newest.
// Missing values must be null/undefined, never fabricated.

// ── 1. Profile ──────────────────────────────────────────────────────────
export function makeProfile({
  age, weightKg, heightCm, sex = "M", hrRest = null, hrMax = null, sleepTargetMin = 480,
}) {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex.toUpperCase() === "M" ? 5 : -161);
  const banisterK = sex.toUpperCase() === "M" ? [0.64, 1.92] : [0.86, 1.67];
  return { age, weightKg, heightCm, sex, hrRest, hrMax, sleepTargetMin, bmr, banisterK };
}

// ── 2. Calibrated constants ────────────────────────────────────────────
const K_BG = 0.06, L_FLOOR = 35.0, L_REF = 35.0, L_CEILING = 738.0;
const BASELINE_SPAN = 28;
const R_HRV = 0.5151, R_HRV2 = 0.6138;
const R_SLP = 2.3532, R_SLP2 = -1.1384;
const R_SLPDEF = 0.8816;
const R_RHR = 0.0543, R_RESP = 0.0187;
const R_EFF = 0.2530, R_CONS = -0.0271;
const R_INTERCEPT = -119.0109;
const EFF_DEFAULT = 95.0, CONS_DEFAULT = 67.0;
const CORE_NEED = 510.0, DEBT_DECAY = 0.35, DEBT_CAP = 200.0;
const SLEEP_B0 = 499.0, SLEEP_KL = 3.18, SLEEP_KD = 0.31;
const MARGIN_A = 35.0, MARGIN_B = 0.10;
const TAU_ATL = 7, TAU_CTL = 28;
const BETA_FRESH = 0.35, BETA_WELL = 0.15;
const ACWR_THRESH = 1.30, ACWR_K = 40.0;
const REC_GAIN_UP = 0.60, REC_GAIN_DOWN = 0.25;
const WELL_THRESH = 50.0, WELL_PEN_MAX = 0.25, WELL_PEN_REF = 40.0;
const ZONE_MIDPOINTS = [0.55, 0.65, 0.75, 0.85, 0.95];

// ── 3. Helpers ──────────────────────────────────────────────────────────
const clip = (x, lo = 0.0, hi = 100.0) => Math.max(lo, Math.min(hi, x));
const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);

function zoneWeights(profile, hrRest, hrMax) {
  const [k1, k2] = profile.banisterK;
  return ZONE_MIDPOINTS.map((mid) => {
    const hrr = Math.max(0.0, (mid * hrMax - hrRest) / (hrMax - hrRest));
    return hrr * k1 * Math.exp(k2 * hrr);
  });
}

// EWMA mean + std (newer values weigh more), debiased to match pandas ewm(std).
function ewmaMeanSd(values, span) {
  if (!values.length) return null;
  const a = 2.0 / (span + 1.0);
  let mean = values[0];
  let vr = 0.0, sw = 1.0, sw2 = 1.0;
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    const diff = v - mean;
    mean += a * diff;
    vr = (1 - a) * (vr + a * diff * diff);
    sw = (1 - a) * sw + 1.0;
    sw2 = (1 - a) ** 2 * sw2 + 1.0;
  }
  const denom = 1.0 - (sw2 / (sw * sw));
  if (denom > 1e-9) vr = vr / denom;
  return [mean, Math.max(Math.sqrt(Math.max(vr, 0.0)), 1e-6)];
}

// ── 4. Individual formulas ──────────────────────────────────────────────
export function dailyLoad(activities, calories, profile, zw) {
  let Ltrain = 0.0;
  for (const mins of activities || []) {
    for (let i = 0; i < 5; i++) Ltrain += (mins[i] || 0) * zw[i];
  }
  const Lbg = calories != null ? K_BG * Math.max(0.0, calories - profile.bmr) : 0.0;
  const L = L_FLOOR + Ltrain + Lbg;
  const load = Math.min(10.0, 10.0 * Math.log(1 + L / L_REF) / Math.log(1 + L_CEILING / L_REF));
  return [Math.round(load * 10) / 10, L];
}

export function recoveryScore(hrv, rhr, resp, asleepMin, baseline, profile, sleepEfficiency = null, sleepConsistency = null) {
  if (hrv == null || asleepMin == null || !baseline.hrv) return null;
  const zh = (hrv - baseline.hrv[0]) / baseline.hrv[1];
  const hrvS = clip(50 + 15 * zh);
  const slpS = clip(100 * Math.min(asleepMin / profile.sleepTargetMin, 1.0));
  const rhrS = (rhr != null && baseline.rhr) ? clip(50 - 15 * (rhr - baseline.rhr[0]) / baseline.rhr[1]) : 50.0;
  const respS = (resp != null && baseline.resp) ? clip(50 - 15 * (resp - baseline.resp[0]) / baseline.resp[1]) : 50.0;
  const effS = sleepEfficiency != null ? clip(sleepEfficiency) : EFF_DEFAULT;
  const consS = sleepConsistency != null ? clip(sleepConsistency) : CONS_DEFAULT;

  const raw = R_INTERCEPT
    + R_HRV * hrvS + R_HRV2 * (hrvS ** 2) / 100.0
    + R_SLP * slpS + R_SLP2 * (slpS ** 2) / 100.0
    + R_SLPDEF * Math.max(0.0, 60.0 - slpS)
    + R_RHR * rhrS + R_RESP * respS
    + R_EFF * effS + R_CONS * consS;
  return Math.round(clip(raw) * 10) / 10;
}

function updateDebt(debt, asleepMin) {
  const got = asleepMin != null ? asleepMin : CORE_NEED;
  return Math.min(DEBT_CAP, Math.max(0.0, DEBT_DECAY * debt + Math.max(0.0, CORE_NEED - got)));
}

export function recommendedSleep(load, debt) {
  const center = SLEEP_B0 + SLEEP_KL * load + SLEEP_KD * debt;
  const margin = MARGIN_A + MARGIN_B * debt;
  return [Math.round(center - margin), Math.round(center + margin)];
}

function freshness(atl, ctl) {
  const tsb = ctl - atl;
  return [100.0 / (1 + Math.exp(-4.0 * tsb / ctl)), tsb, atl / ctl];
}

function recoveryEff(today, prior7) {
  if (today == null || !prior7.length) return [today, null];
  const base = prior7.reduce((a, b) => a + b, 0) / prior7.length;
  const delta = today - base;
  const g = delta >= 0 ? REC_GAIN_UP : REC_GAIN_DOWN;
  return [clip(base + g * delta), base];
}

// Freshness from a plain daily-load series (0-10 per day, oldest → newest) —
// no HRV/RHR/sleep signals required, just training load. Lets us compute a
// real Freshness for athletes without any wearable connection, driven by
// their actual logged workouts (see getWorkoutLoadSeries in ScreenToday.jsx)
// instead of the fabricated numbers a wearable-only formula would need.
// Same ATL(7)/CTL(28) lag-1 EWMA and TSB→Freshness formula as computeSeries.
export function freshnessFromLoads(loads) {
  if (!loads.length) return null;
  let eA = null, eC = null;
  const aA = 1 - Math.exp(-1.0 / TAU_ATL);
  const aC = 1 - Math.exp(-1.0 / TAU_CTL);
  let atl = null, ctl = null;
  for (const L of loads) {
    atl = eA != null ? eA : L;
    ctl = Math.max(eC != null ? eC : L, 1e-6);
    eA = eA == null ? L : eA + aA * (L - eA);
    eC = eC == null ? L : eC + aC * (L - eC);
  }
  const [F, tsb] = freshness(atl, ctl);
  return { freshness: Math.round(F), atl: Math.round(atl * 10) / 10, ctl: Math.round(ctl * 10) / 10, tsb: Math.round(tsb * 10) / 10 };
}

// ── 5. Main entry — computes the whole series ───────────────────────────
// history: oldest → newest. wellness: optional {"YYYY-MM-DD": 0-100}.
export function computeSeries(history, profile, wellness = {}) {
  const rhrs = history.map((d) => num(d.rhr)).filter((v) => v != null).sort((a, b) => a - b);
  const hrRest = profile.hrRest || (rhrs.length ? rhrs[Math.floor(rhrs.length / 2)] : 60.0);
  const hrMax = profile.hrMax || (220 - profile.age);
  const zw = zoneWeights(profile, hrRest, hrMax);

  const rows = history.map((d) => {
    const [load, L] = dailyLoad(d.activities, num(d.calories), profile, zw);
    return { date: d.date, load, load_raw: L, recovery: null, flags: [] };
  });

  for (let i = 0; i < history.length; i++) {
    const d = history[i];
    const base = {};
    for (const key of ["hrv", "rhr", "resp"]) {
      const past = history.slice(0, i).map((h) => num(h[key])).filter((v) => v != null);
      if (past.length >= 10) base[key] = ewmaMeanSd(past, BASELINE_SPAN);
    }
    const rec = recoveryScore(num(d.hrv), num(d.rhr), num(d.resp), num(d.asleep_min), base, profile,
      num(d.sleep_efficiency), num(d.sleep_consistency));
    rows[i].recovery = rec;
    if (rec == null) rows[i].flags.push("recovery_not_computable");
    if (!base.hrv) rows[i].flags.push("baseline_immature");
  }

  let debt = 0.0;
  let eA = null, eC = null;
  const aA = 1 - Math.exp(-1.0 / TAU_ATL);
  const aC = 1 - Math.exp(-1.0 / TAU_CTL);

  for (let i = 0; i < history.length; i++) {
    const d = history[i];
    const L = rows[i].load_raw;
    const atl = eA != null ? eA : L;
    const ctl = Math.max(eC != null ? eC : L, 1e-6);
    eA = eA == null ? L : eA + aA * (L - eA);
    eC = eC == null ? L : eC + aC * (L - eC);
    const [F, tsb, acwr] = freshness(atl, ctl);

    const prior7 = rows.slice(Math.max(0, i - 7), i).map((r) => r.recovery).filter((v) => v != null);
    const [reff, rbase] = recoveryEff(rows[i].recovery, prior7);
    if (prior7.length < 7) rows[i].flags.push("baseline_under_7d");

    const wDays = [];
    for (let j = Math.max(0, i - 6); j <= i; j++) {
      if (Object.prototype.hasOwnProperty.call(wellness, history[j].date)) wDays.push(wellness[history[j].date]);
    }
    let wEff, guard;
    if (wDays.length) {
      wEff = 0.25 * wDays[wDays.length - 1] + 0.75 * (wDays.reduce((a, b) => a + b, 0) / wDays.length);
      const S = wDays.reduce((a, w) => a + Math.max(0.0, WELL_THRESH - w), 0) / wDays.length;
      guard = Math.max(1 - WELL_PEN_MAX, Math.min(1.0, 1 - WELL_PEN_MAX * (S / WELL_PEN_REF)));
    } else {
      wEff = 50.0; guard = 1.0;
    }
    const wellPen = (1 - guard) * 50.0;
    const overPen = Math.max(0.0, acwr - ACWR_THRESH) * ACWR_K;

    let readiness = null;
    if (reff != null) {
      readiness = Math.round(clip(reff + BETA_FRESH * (F - 50) + BETA_WELL * (wEff - 50) - overPen - wellPen));
    }

    const [lo, hi] = recommendedSleep(rows[i].load, debt);
    Object.assign(rows[i], {
      sleep_debt: Math.round(debt),
      sleep_need: [lo, hi],
      atl: Math.round(atl * 10) / 10, ctl: Math.round(ctl * 10) / 10, tsb: Math.round(tsb * 10) / 10,
      acwr: Math.round(acwr * 100) / 100, freshness: Math.round(F),
      recovery_baseline_7d: rbase == null ? null : Math.round(rbase),
      recovery_eff: reff == null ? null : Math.round(reff),
      overload_penalty: Math.round(overPen * 10) / 10,
      wellness_penalty: Math.round(wellPen * 10) / 10,
      readiness,
    });
    debt = updateDebt(debt, num(d.asleep_min));
  }
  return rows;
}

export function formatHm(minutes) {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}
