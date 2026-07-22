// ATHLOS — Daily Coach template bank.
//
// Every template is a function of the real metrics (never a hardcoded single
// string) so it can embed the athlete's actual numbers. `**...**` marks the
// span DailyCoachCard bolds — this file never touches JSX/styling directly,
// keeping copy fully separate from rendering (DailyCoachAnimations/Card own
// the visuals). English-only — the app has no user-facing language switch
// (see lib/i18n.js), so these strings are the source of truth directly,
// not routed through t().

import type { DailyCoachMetrics } from "./DailyCoachRules";

type Tpl = (m: DailyCoachMetrics) => string;

const pct = (n: number) => `${Math.round(n)}%`;
const hrs = (h: number) => {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins > 0 ? `${whole}h ${mins}min` : `${whole}h`;
};
const one = (n: number) => n.toFixed(1);

// ── TITLE — the one-line opener ─────────────────────────────────────────
export const TITLE: Record<string, Tpl[]> = {
  noData: [
    () => "No check-in yet today — a couple of minutes, and ATHLOS can tell you where you stand.",
    () => "Your day is still waiting for its first read. Fill in the morning check-in below.",
  ],
  recoveryHigh: [
    (m) => `You landed almost exactly where your body expected today — **${pct(m.battery!)} readiness**.`,
    (m) => `Great recovery today: **${pct(m.battery!)}**. Your body is ready for a tougher day.`,
    (m) => `Green light — readiness sits at **${pct(m.battery!)}** today.`,
  ],
  recoveryMid: [
    (m) => `You recovered decently, but a few markers are still holding you back — **${pct(m.battery!)}** today.`,
    (m) => `Moderate readiness today (**${pct(m.battery!)}**) — your body is somewhere in between.`,
    (m) => `Today's story is more about balance than a standout day — **${pct(m.battery!)}** readiness.`,
  ],
  recoveryLow: [
    (m) => `Your body is calling for rest today — readiness is at **${pct(m.battery!)}**.`,
    (m) => `Low readiness today (**${pct(m.battery!)}**) — the real story isn't load, it's recovery.`,
    (m) => `Your body is defending more than it's charging today — **${pct(m.battery!)}**.`,
  ],
  trendImproving: [
    () => "Recovery is climbing after a lighter load yesterday.",
    () => "The trend is heading up — the last few days are paying off.",
  ],
  trendDeclining: [
    () => "Today's real story isn't load — it's consistency.",
    () => "Recovery has been slipping the last few days — worth a look at why.",
  ],
};

// ── WHY — paragraph 2, the explanation ──────────────────────────────────
export const WHY: Record<string, Tpl[]> = {
  sleepLow: [
    (m) => `Sleep remains the main limiting factor — only **${hrs(m.sleepH!)}** last night.`,
    (m) => `With **${hrs(m.sleepH!)}** of sleep, your body didn't get enough time to fully recover.`,
  ],
  sleepDebtHigh: [
    (m) => `On top of that, sleep debt has built up — **${Math.round(m.sleepDebtMin!)} min** short of this week's target.`,
  ],
  sleepGood: [
    (m) => `**${hrs(m.sleepH!)}** of sleep was enough — consistent sleep pays off.`,
  ],
  recoveryAboveAvg: [
    (m) => `The recovery side of your markers is above your usual level (**${pct(m.recoveryScore!)}**) — your nervous system is recovered.`,
  ],
  recoveryBelowAvg: [
    (m) => `The recovery side of your markers is below your usual level (**${pct(m.recoveryScore!)}**) — a sign of lingering fatigue.`,
  ],
  stressHigh: [
    () => "Stress and mood are dragging things down today — mental load counts just as much as physical.",
  ],
  sorenessHigh: [
    () => "Muscle tightness from your last session is still present.",
  ],
  neutral: [
    (m) => `Your markers are close to your recent average today (**${pct(m.battery!)}**).`,
  ],
};

// ── ACTIVITY — paragraph 3, today's training/strain ─────────────────────
export const ACTIVITY: Record<string, Tpl[]> = {
  strainAboveTarget: [
    (m) => `Today's load (**${one(m.strain!)}**) is above your usual target — your body put in work.`,
  ],
  strainBelowTarget: [
    (m) => `Today's load (**${one(m.strain!)}**) was below your usual target — a lighter day.`,
  ],
  strainNeutral: [
    (m) => `Today's load (**${one(m.strain!)}**) was in line with expectations.`,
  ],
  workoutLoggedToday: [
    () => "A session is logged for today — it'll show up in tomorrow's numbers.",
  ],
  noStrainData: [
    () => "No load data yet for today.",
  ],
};

// ── RECOMMENDATION — paragraph 4, the action ─────────────────────────────
export const RECOMMENDATION: Record<string, Tpl[]> = {
  recoveryLow: [
    () => "Today's a real opportunity to recover — a lighter day will pay off tomorrow.",
    () => "Consider a recovery day instead of a full session.",
  ],
  sleepLow: [
    () => "An earlier bedtime tonight would make the biggest difference.",
    () => "Get to bed a bit earlier — it's the fastest way back.",
  ],
  hydrationLow: [
    () => "Get more fluids in before tomorrow.",
  ],
  strainAboveTarget: [
    () => "After a day like that, your body deserves an easier one tomorrow.",
  ],
  strainBelowTarget: [
    () => "There's room for more — your body could handle a tougher session.",
  ],
  recoveryHigh: [
    () => "The system recommends a full session — your body is ready.",
    () => "A good day to push harder.",
  ],
  neutral: [
    () => "A moderate effort today is a reasonable choice.",
    () => "Listen to your body and adjust intensity as you go.",
  ],
};

// ── QUESTION — closing, conversational ───────────────────────────────────
export const QUESTION: Record<string, Tpl[]> = {
  recoveryHigh: [
    () => "Planning another session today?",
    () => "Feeling recovered enough for a tough session tomorrow?",
  ],
  recoveryLow: [
    () => "Will you prioritize rest today?",
    () => "Think you'll be in bed before midnight tonight?",
  ],
  neutral: [
    () => "Want to push tomorrow, or focus on recovery?",
    () => "How's your body feeling compared to yesterday?",
  ],
  noData: [
    () => "How are you feeling today?",
  ],
};
