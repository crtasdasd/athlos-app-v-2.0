// ATHLOS — fetches the real data DailyCoachCard needs, self-contained (not
// tied to any screen's local React state). Used from the AI chat, which
// shows the day's Daily Coach message once per day — see ScreenAI.jsx.

import { listCheckins } from "../../lib/api";
import { readinessFromCheckin } from "../../lib/readiness";
import { hasWhoopDemo, whoopSeries } from "../../lib/readinessLive";
import type { DailyCoachMetrics, Trend } from "./DailyCoachRules";

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function batteryFor(row: any): number {
  return readinessFromCheckin({
    sleepQuality: row.sleep_quality, mood: row.mood, soreness: row.soreness,
    stress: row.stress, sleepH: row.sleep_h, hydration: row.hydration,
  }).battery;
}

export async function getDailyCoachMetrics(userId?: string | null): Promise<{ metrics: DailyCoachMetrics; dateIso: string }> {
  const dateIso = todayIso();
  const rows = await listCheckins(userId, 8).catch(() => []);
  const today = (rows as any[]).find((r) => r.date === dateIso) || null;
  const pastRows = (rows as any[]).filter((r) => r.date !== dateIso);

  const hasData = !!today;
  const { battery, components } = hasData
    ? readinessFromCheckin({
        sleepQuality: today.sleep_quality, mood: today.mood, soreness: today.soreness,
        stress: today.stress, sleepH: today.sleep_h, hydration: today.hydration,
      })
    : { battery: 0, components: [] as { key: string; score: number }[] };
  const recovery = components.find((c: any) => c.key === "recovery");

  const sleepDebtMin = hasData && today.sleep_h != null ? Math.max(0, (8 - today.sleep_h) * 60) : null;

  let trend: Trend = null;
  if (hasData && pastRows.length) {
    const pastBatteries = pastRows.map(batteryFor);
    const avg = pastBatteries.reduce((a, b) => a + b, 0) / pastBatteries.length;
    const diff = battery - avg;
    trend = diff > 5 ? "up" : diff < -5 ? "down" : "flat";
  }

  let strain: number | null = null;
  let strainTarget: number | null = null;
  if (hasWhoopDemo) {
    const series = whoopSeries(8);
    const last = series[series.length - 1];
    strain = typeof last?.strain === "number" ? last.strain : null;
    const past = series.slice(0, -1).map((d: any) => d.strain).filter((v: any) => typeof v === "number");
    strainTarget = past.length ? past.reduce((a: number, b: number) => a + b, 0) / past.length : null;
  }

  const metrics: DailyCoachMetrics = {
    hasData, battery,
    sleepH: today?.sleep_h ?? null,
    sleepDebtMin,
    hydration: today?.hydration ?? null,
    stress: today?.stress ?? null,
    mood: today?.mood ?? null,
    soreness: today?.soreness ?? null,
    recoveryScore: recovery ? (recovery as any).score : null,
    strain, strainTarget, trend,
    workoutToday: null,
  };
  return { metrics, dateIso };
}
