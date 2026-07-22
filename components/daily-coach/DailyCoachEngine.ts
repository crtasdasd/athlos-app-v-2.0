// ATHLOS — Daily Coach engine.
//
// Ties rules + templates together. Fully deterministic: the same metrics +
// the same (userId, date, refreshNonce) always produce the same copy — there
// is no Math.random() anywhere. Tapping "refresh" in the UI only bumps
// refreshNonce, re-rolling PHRASING without touching the underlying facts,
// so the numbers never change just because the wording did.

import { deriveFacts, type DailyCoachMetrics, type DailyCoachFacts } from "./DailyCoachRules";
import { TITLE, WHY, ACTIVITY, RECOMMENDATION, QUESTION } from "./DailyCoachTemplates";

export interface DailyCoachResult {
  empty: boolean;
  title: string;
  paragraphs: string[];
  question: string;
}

// mulberry32 — tiny, dependency-free seeded PRNG. Good enough for "pick one
// of N phrasing variants," not for anything cryptographic.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function titleBucket(f: DailyCoachFacts): keyof typeof TITLE {
  if (f.recoveryHigh) return "recoveryHigh";
  if (f.recoveryLow) return "recoveryLow";
  if (f.trendImproving) return "trendImproving";
  if (f.trendDeclining) return "trendDeclining";
  return "recoveryMid";
}

function whyBucket(f: DailyCoachFacts): keyof typeof WHY {
  if (f.sleepLow) return "sleepLow";
  if (f.sleepDebtHigh) return "sleepDebtHigh";
  if (f.recoveryBelowAvg) return "recoveryBelowAvg";
  if (f.recoveryAboveAvg) return "recoveryAboveAvg";
  if (f.stressHigh) return "stressHigh";
  if (f.sorenessHigh) return "sorenessHigh";
  if (f.sleepGood) return "sleepGood";
  return "neutral";
}

function activityBucket(f: DailyCoachFacts): keyof typeof ACTIVITY {
  if (f.strainKnown && f.strainAboveTarget) return "strainAboveTarget";
  if (f.strainKnown && f.strainBelowTarget) return "strainBelowTarget";
  if (f.strainKnown) return "strainNeutral";
  if (f.workoutLoggedToday) return "workoutLoggedToday";
  return "noStrainData";
}

function recommendationBucket(f: DailyCoachFacts): keyof typeof RECOMMENDATION {
  if (f.recoveryLow) return "recoveryLow";
  if (f.sleepLow) return "sleepLow";
  if (f.hydrationLow) return "hydrationLow";
  if (f.strainAboveTarget) return "strainAboveTarget";
  if (f.strainBelowTarget) return "strainBelowTarget";
  if (f.recoveryHigh) return "recoveryHigh";
  return "neutral";
}

function questionBucket(f: DailyCoachFacts): keyof typeof QUESTION {
  if (f.recoveryHigh) return "recoveryHigh";
  if (f.recoveryLow) return "recoveryLow";
  return "neutral";
}

export function generateDailyCoach(
  metrics: DailyCoachMetrics,
  seedKey: { userId?: string | null; dateIso: string; refreshNonce?: number }
): DailyCoachResult {
  const facts = deriveFacts(metrics);
  const rng = mulberry32(hashString(`${seedKey.userId || "anon"}|${seedKey.dateIso}|${seedKey.refreshNonce || 0}`));

  if (facts.noData) {
    return {
      empty: true,
      title: pick(TITLE.noData, rng)(metrics),
      paragraphs: [],
      question: pick(QUESTION.noData, rng)(metrics),
    };
  }

  const title = pick(TITLE[titleBucket(facts)], rng)(metrics);
  const why = pick(WHY[whyBucket(facts)], rng)(metrics);
  const activity = pick(ACTIVITY[activityBucket(facts)], rng)(metrics);
  const recommendation = pick(RECOMMENDATION[recommendationBucket(facts)], rng)(metrics);
  const question = pick(QUESTION[questionBucket(facts)], rng)(metrics);

  return { empty: false, title, paragraphs: [why, activity, recommendation], question };
}

// Splits "text **bold** text" into plain/bold runs for the UI to render.
export function splitHighlights(text: string): Array<{ text: string; bold: boolean }> {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => ({ text: part, bold: i % 2 === 1 })).filter((p) => p.text.length);
}
