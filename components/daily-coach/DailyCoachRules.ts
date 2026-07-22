// ATHLOS — Daily Coach rule engine.
//
// Pure, deterministic fact derivation: real ATHLOS metrics in, booleans out.
// Every fact is only ever set when its underlying field is actually present
// (non-null) — a metric ATHLOS doesn't track (steps, calories, distance,
// active minutes, a real device HRV/RHR reading) simply never produces a
// fact, and the templates layer can never reference it. No fact is ever
// guessed or defaulted into existence.

export type Trend = "up" | "down" | "flat" | null;

export interface DailyCoachMetrics {
  hasData: boolean;           // today's check-in has been answered at all
  battery: number | null;     // 0-100 readiness/recovery composite
  sleepH: number | null;      // hours slept
  sleepDebtMin: number | null; // minutes below the athlete's sleep target, this week
  hydration: number | null;   // 0-120 % of recommended fluids
  stress: number | null;      // 1-5, higher = worse
  mood: number | null;        // 1-5, higher = better
  soreness: number | null;    // 1-5, higher = worse
  recoveryScore: number | null; // 0-100 recovery sub-component (HRV/RHR/sleep anchor)
  strain: number | null;      // 0-21 training load for the day
  strainTarget: number | null; // the athlete's typical/target strain
  trend: Trend;                // battery trending up/down/flat over recent days
  workoutToday: boolean | null; // a session was logged/completed today
}

export interface DailyCoachFacts {
  noData: boolean;
  sleepLow: boolean;          // < 6h
  sleepDebtHigh: boolean;     // > 90 min
  sleepGood: boolean;         // >= 7.5h
  recoveryAboveAvg: boolean;  // recovery sub-score reads strong
  recoveryBelowAvg: boolean;
  rhrElevated: boolean;       // recovery sub-score reads weak (proxy — no raw RHR feed exists)
  recoveryHigh: boolean;      // battery > 80
  recoveryLow: boolean;       // battery < 40
  recoveryMid: boolean;       // 40-80
  stressHigh: boolean;        // stress >= 4
  moodLow: boolean;           // mood <= 2
  sorenessHigh: boolean;      // soreness >= 4
  hydrationLow: boolean;      // < 70%
  strainAboveTarget: boolean;
  strainBelowTarget: boolean;
  strainKnown: boolean;
  trendImproving: boolean;
  trendDeclining: boolean;
  workoutLoggedToday: boolean;
}

const num = (v: number | null | undefined): v is number => typeof v === "number" && !Number.isNaN(v);

export function deriveFacts(m: DailyCoachMetrics): DailyCoachFacts {
  const noData = !m.hasData || !num(m.battery);

  const sleepLow = num(m.sleepH) && m.sleepH < 6;
  const sleepGood = num(m.sleepH) && m.sleepH >= 7.5;
  const sleepDebtHigh = num(m.sleepDebtMin) && m.sleepDebtMin > 90;

  const recoveryAboveAvg = num(m.recoveryScore) && m.recoveryScore >= 65;
  const recoveryBelowAvg = num(m.recoveryScore) && m.recoveryScore < 45;
  const rhrElevated = num(m.recoveryScore) && m.recoveryScore < 40;

  const recoveryHigh = num(m.battery) && m.battery > 80;
  const recoveryLow = num(m.battery) && m.battery < 40;
  const recoveryMid = num(m.battery) && m.battery >= 40 && m.battery <= 80;

  const stressHigh = num(m.stress) && m.stress >= 4;
  const moodLow = num(m.mood) && m.mood <= 2;
  const sorenessHigh = num(m.soreness) && m.soreness >= 4;
  const hydrationLow = num(m.hydration) && m.hydration < 70;

  const strainKnown = num(m.strain);
  const strainAboveTarget = strainKnown && num(m.strainTarget) && m.strain > m.strainTarget;
  const strainBelowTarget = strainKnown && num(m.strainTarget) && m.strain < m.strainTarget;

  const trendImproving = m.trend === "up";
  const trendDeclining = m.trend === "down";

  const workoutLoggedToday = m.workoutToday === true;

  return {
    noData,
    sleepLow: !!sleepLow, sleepDebtHigh: !!sleepDebtHigh, sleepGood: !!sleepGood,
    recoveryAboveAvg: !!recoveryAboveAvg, recoveryBelowAvg: !!recoveryBelowAvg, rhrElevated: !!rhrElevated,
    recoveryHigh: !!recoveryHigh, recoveryLow: !!recoveryLow, recoveryMid: !!recoveryMid,
    stressHigh: !!stressHigh, moodLow: !!moodLow, sorenessHigh: !!sorenessHigh, hydrationLow: !!hydrationLow,
    strainAboveTarget: !!strainAboveTarget, strainBelowTarget: !!strainBelowTarget, strainKnown: !!strainKnown,
    trendImproving, trendDeclining,
    workoutLoggedToday,
  };
}
