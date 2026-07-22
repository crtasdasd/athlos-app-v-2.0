import React, { useState, useEffect, useRef, useMemo } from "react";
import gsap from "gsap";
import { Moon, Smile, Zap, Dumbbell, Brain, Bandage, ScrollText, Scale, ChevronRight, HeartPulse } from "lucide-react";
import { useTheme } from "../theme";
import { Mono, Card, SectionLabel, StatTile, PrimaryBtn, MetricCard } from "../components/UI";
import { useT, useLang } from "../lib/i18n";
import { readinessFromCheckin, recommendation, DEFAULT_CHECKIN } from "../lib/readiness";
import { readinessFromWhoop, hasWhoopDemo, whoopSeries } from "../lib/readinessLive";
import { checkinPendingToday, unreadNotificationCount } from "../lib/notifications";
import { takeIntent } from "../lib/intent";
import {
  syncMyClubCard, saveCheckin, getTodayCheckin, listCheckins,
  saveBodyWeight, listBodyWeights, saveInjuryReport, getActiveInjury, listWorkouts,
} from "../lib/api";
import { loadWellness, markWellnessDone, adoptLocalWellness, syncWellnessFromCheckins } from "./widgets/CheckinCard";
import DailyCoachCard from "../components/daily-coach/DailyCoachCard";
import { getDailyCoachMetrics } from "../components/daily-coach/getDailyCoachMetrics";
import { freshnessFromLoads } from "../lib/athlosEngine";
import LiquidGauge from "../components/LiquidGauge";

// PDF Upgrade 4 · Freshness — built from the athlete's REAL logged workouts
// (lib/api.js `workouts` table: date, duration_sec, sets_done), not a
// wearable feed this app doesn't have. A rest day still carries a small
// floor load (never literally 0 — matches athlos_engine.py's L_FLOOR
// concept: background/NEAT load exists even without a session).
const REST_FLOOR_LOAD = 2.5;
function buildLoadSeries(workouts, days = 42) {
  const byDate = new Map();
  for (const w of workouts) {
    const prev = byDate.get(w.date) || { durationSec: 0, setsDone: 0 };
    byDate.set(w.date, {
      durationSec: prev.durationSec + (w.duration_sec || 0),
      setsDone: prev.setsDone + (w.sets_done || 0),
    });
  }
  const series = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const day = byDate.get(iso);
    const load = day
      ? Math.max(0, Math.min(10, REST_FLOOR_LOAD + (day.durationSec / 60) / 12 + day.setsDone * 0.25))
      : REST_FLOOR_LOAD;
    series.push(load);
  }
  return series;
}

// Neutral slider positions — shown until the user actually drags something.
// Not fed into the readiness score until `touched` is true (see below), so
// a brand-new athlete never gets a flattering score they didn't earn.
const NEUTRAL_CHECKIN = { sleepH: 7, sleepQuality: 3, mood: 3, soreness: 3, stress: 3, hydration: 60 };

const CHECKIN_KEY = "athlos:checkin";
const loadCheckin = () => {
  try { return { ...DEFAULT_CHECKIN, ...NEUTRAL_CHECKIN, touched: false, ...JSON.parse(localStorage.getItem(CHECKIN_KEY) || "{}") }; }
  catch { return { ...DEFAULT_CHECKIN, ...NEUTRAL_CHECKIN, touched: false }; }
};

// Light tactile confirmation on the primary taps (sheet-openers, nav) — this
// is a phone app, not a website, so touch feedback (not hover) is the actual
// premium-feel lever. Same 8ms tick as ScreenCommunity.jsx, for consistency.
const haptic = () => { try { navigator.vibrate?.(8); } catch {} };

const DAYS_SL = ["NED", "PON", "TOR", "SRE", "ČET", "PET", "SOB"];
const DAYS_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS_SL = ["JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AVG", "SEP", "OKT", "NOV", "DEC"];
const MONTHS_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];


function useCountUp(target, dur = 900, delay = 200) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start - delay) / dur, 1);
      if (p < 0) { raf = requestAnimationFrame(tick); return; }
      setN(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return n;
}

// ── Icon set — Lucide throughout (one premium, consistent library instead of
// scattered hand-drawn SVGs), thin 1.6 stroke to match the app's line weight.
const IconMoon     = ({ size = 18, color }) => <Moon size={size} color={color} strokeWidth={1.6} />;
const IconFace     = ({ size = 18, color }) => <Smile size={size} color={color} strokeWidth={1.6} />;
const IconBolt     = ({ size = 18, color }) => <Zap size={size} color={color} strokeWidth={1.6} />;
const IconDumbbell = ({ size = 20, color }) => <Dumbbell size={size} color={color} strokeWidth={1.6} />;
const IconBrain    = ({ size = 20, color }) => <Brain size={size} color={color} strokeWidth={1.6} />;
const IconHeal     = ({ size = 20, color }) => <Bandage size={size} color={color} strokeWidth={1.6} />;
const IconScroll   = ({ size = 20, color }) => <ScrollText size={size} color={color} strokeWidth={1.6} />;
const IconScales   = ({ size = 20, color }) => <Scale size={size} color={color} strokeWidth={1.6} />;

// Premium circular liquid-fill metric — now the shared LiquidGauge
// (src/components/LiquidGauge.jsx), reused as-is by the coach app's roster
// list. Thin wrapper here just maps the app's theme object onto the
// portable primitive props so every call site in this file stays unchanged.
function LiquidMetric({ value, max, label, color, decimals = 0, fillAlpha = 0.62, C, size = 122 }) {
  return (
    <LiquidGauge
      value={value} max={max} label={label} color={color} decimals={decimals} fillAlpha={fillAlpha} size={size}
      dark={C.name === "dark"} headingFont={C.heading} monoFont={C.mono} mutedColor={C.muted}
    />
  );
}

// Smooth mini sparkline for the half-width stat cards (stroke only + end dot).
function MiniSpark({ data, color, C, h = 44 }) {
  const W = 130, PAD = 5;
  const minV = Math.min(...data), maxV = Math.max(...data);
  const rng = (maxV - minV) || 1;
  const toX = (i) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const toY = (v) => PAD + (1 - (v - minV) / rng) * (h - PAD * 2);
  const pts = data.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const d = pts.reduce((s, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const px = pts[i - 1], cx = ((px.x + p.x) / 2).toFixed(1);
    return `${s} C${cx},${px.y.toFixed(1)} ${cx},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, "");
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="3.4" fill={color} stroke={C.name === "dark" ? "#101010" : "#FFFFFF"} strokeWidth="1.6" />
    </svg>
  );
}

// 1–5 answer selector for the Morning Check-in.
//
// Deliberately NOT accent-coloured. Two reasons:
//  · The sheet's one green element is the CTA. A green-filled chip sitting
//    directly above a green button put all the colour at one end of the sheet
//    and made the two compete.
//  · Green means "good" everywhere else in ATHLOS, but this is an ordinal
//    scale where 1 is a BAD answer. Painting a 1 or a 2 green states the
//    opposite of what the answer means.
// A picked chip is therefore solid ink-on-white (C.text fill, C.bg glyph):
// maximum contrast, unmistakably selected, no hue.
//
// The row itself also encodes its own direction — the resting fill ramps up
// across the five chips, so left reads lighter than right before the user has
// touched anything. That is the POOR→GREAT axis stated by the control instead
// of only by its end labels.
function AnswerScale({ value, onChange, C, t, count = 5 }) {
  const dark = C.name === "dark";
  const ring = dark ? "rgba(255,255,255,0.10)" : C.border2;
  const restFill = (n) => {
    const k = (n - 1) / (count - 1); // 0 → 1 across the scale
    return dark
      ? `rgba(255,255,255,${(0.035 + k * 0.06).toFixed(3)})`
      : `rgba(16,24,40,${(0.028 + k * 0.045).toFixed(3)})`;
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
          const on = value === n;
          return (
            <button key={n} onClick={() => onChange(n)} aria-label={String(n)} aria-pressed={on} style={{
              flex: "1 1 0", aspectRatio: "1 / 1", maxWidth: 56, borderRadius: "50%", cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `1.5px solid ${on ? C.text : ring}`,
              background: on ? C.text : restFill(n),
              color: on ? C.bg : C.muted,
              fontFamily: C.display, fontWeight: on ? 800 : 700, fontSize: 15,
              boxShadow: "none",
              transform: on ? "scale(1.04)" : "scale(1)",
              WebkitTapHighlightColor: "transparent",
              transition: "transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.18s, border-color 0.18s, color 0.18s",
            }}>{n}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 2px" }}>
        <Mono style={{ color: C.muted2, fontSize: 8 }}>{t("SLABO")}</Mono>
        <Mono style={{ color: C.muted2, fontSize: 8 }}>{t("ODLIČNO")}</Mono>
      </div>
    </div>
  );
}

// ── Morning Check-in — dedicated flagship flow (Header → progress → one
// question at a time → premium answer scale → Continue/Back), instead of a
// dense all-at-once list buried in the readiness breakdown sheet. Reuses the
// exact same `checkin` state and `setC` setter (no business-logic changes) —
// this only redesigns how those same four answers get collected.
function MorningCheckinFlow({ checkin, setC, onClose, C, t }) {
  const [step, setStep] = useState(0);
  const STEPS = [
    { key: "sleepQuality", title: t("Kako si spal?"), sub: t("Kakovost spanja vpliva na okrevanje čez noč.") },
    { key: "mood", title: t("Kakšno je tvoje počutje?"), sub: t("Splošno razpoloženje in energija danes.") },
    { key: "soreness", title: t("Kako boleče so mišice?"), sub: t("Napetost ali bolečina po zadnjem treningu.") },
    { key: "stress", title: t("Kako stresen je dan?"), sub: t("Psihična obremenitev vpliva na regeneracijo.") },
  ];
  const total = STEPS.length;
  const cur = STEPS[step];
  const value = checkin[cur.key];
  const pct = Math.round(((step + 1) / total) * 100);
  const isLast = step === total - 1;

  const next = () => { if (value == null) return; if (isLast) onClose(); else setStep((s) => s + 1); };
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(20,18,14,0.55)" }}>
      <DragSheet onClose={onClose} style={{
        position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "88%", overflowY: "auto",
        background: C.bg, borderRadius: "28px 28px 0 0", padding: "11px 20px",
        paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))",
        animation: "athlosRise 0.32s cubic-bezier(0.22,1,0.36,1)",
      }}>
        <style>{`@keyframes athlosCkStepIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }`}</style>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border2, margin: "0 auto 22px" }} />

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: step === 0 ? 8 : 22 }}>
          {/* muted, not accent — the sheet spends its green on the CTA alone */}
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.3em" }}>{t("JUTRANJI CHECK-IN")}</Mono>
          <h2 style={{ fontFamily: C.heading, fontWeight: 800, fontSize: 21, color: C.text, margin: "8px 0 0", letterSpacing: "-0.01em" }}>
            {t("Kako se počutiš danes?")}
          </h2>
        </div>

        {step === 0 && (
          <p style={{ fontFamily: C.display, fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 1.5, margin: "0 0 22px" }}>
            {t("Odgovori na 4 kratka vprašanja — ATHLOS iz njih izračuna tvojo pravo pripravljenost.")}
          </p>
        )}

        {/* Progress */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <Mono style={{ color: C.muted, fontSize: 9 }}>{t("VPRAŠANJE")} {step + 1} {t("OD")} {total}</Mono>
            <Mono style={{ color: C.muted2, fontSize: 9 }}>{pct}%</Mono>
          </div>
          {/* white fill, not accent — progress is a fact, not the action */}
          <div style={{ height: 4, borderRadius: 999, background: C.surface3, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: C.text, transition: "width 0.5s cubic-bezier(.22,1,.36,1)" }} />
          </div>
        </div>

        {/* Question card — remounts per step (key=cur.key) so it slides/fades in fresh */}
        <div key={cur.key} style={{ animation: "athlosCkStepIn 0.32s cubic-bezier(.22,1,.36,1)" }}>
          <Card pad={22} style={{ marginBottom: 20 }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, color: C.text, letterSpacing: "-0.01em" }}>{cur.title}</div>
              <div style={{ fontFamily: C.display, fontWeight: 500, fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>{cur.sub}</div>
            </div>
            <AnswerScale value={value} onChange={(v) => setC(cur.key, v)} C={C} t={t} />
          </Card>
        </div>

        {/* Disabled is a quiet surface, not 50%-opacity green — a translucent
            green button reads broken, a grey one reads "not yet". Same
            treatment as the assessment flow's CTA. */}
        <PrimaryBtn onClick={next} disabled={value == null} style={value == null ? {
          background: C.name === "dark" ? "rgba(255,255,255,0.055)" : "rgba(16,24,40,0.05)",
          color: C.muted2, boxShadow: "none",
        } : undefined}>
          {isLast ? t("Dokončaj") : t("Naprej")}
        </PrimaryBtn>
        {step > 0 && (
          <button onClick={back} style={{ width: "100%", background: "none", border: "none", padding: "13px 0 2px", color: C.muted, fontFamily: C.display, fontWeight: 600, fontSize: 13, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            {t("Nazaj")}
          </button>
        )}
      </DragSheet>
    </div>
  );
}

// ── "+" quick-add sheet — PDF Upgrade 1: Poškodba (Injury report, reuses the
// onboarding-style body-part/grade/note flow) · Uredi trening (Edit session,
// routes to today's ScreenTrain) · Tehtanje (Weight, saved for real and
// reflected immediately in the weight tile/graph).
function QuickAddSheet({ C, t, onClose, onSave, onEditSession, onSaveWeight, lastWeight }) {
  const [step, setStep] = useState(0); // 0 menu · 1 injury form · 2 weight form
  const [form, setForm] = useState({ part: "", customPart: "", grade: 2, note: "" });
  const [weightKg, setWeightKg] = useState(lastWeight || 75);
  const PARTS = ["Hamstring", "Koleno", "Gleženj", "Mečna", "Križ", "Ramo", "Komolec", "Drugo"];
  // "Drugo" needs a free-text body part before it can be saved
  const valid = form.part && (form.part !== "Drugo" || form.customPart.trim());
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,0.55)", animation: "athlosFade 0.22s ease" }} onClick={onClose}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.bg, borderRadius: "28px 28px 0 0", padding: "0 13px 20px", maxHeight: "88vh", overflowY: "auto", animation: "athlosRise 0.32s cubic-bezier(0.22,1,0.36,1)" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: C.border2, margin: "14px auto 20px" }} />
        {step === 0 && (
          <>
            <Mono style={{ color: C.muted, fontSize: 10, letterSpacing: "0.12em", marginBottom: 11, display: "block" }}>{t("HITRI VNOS")}</Mono>
            {[
              { icon: <IconHeal size={22} color={C.accent} />, label: t("Poškodba"), sub: t("Zabeleži poškodbo ali bolečino"), action: () => setStep(1) },
              { icon: <IconScroll size={22} color={C.muted} />, label: t("Uredi trening"), sub: t("Zamenjaj ali odstrani vaje za danes"), action: () => { onEditSession?.(); onClose(); } },
              { icon: <IconScales size={22} color={C.muted} />, label: t("Tehtanje"), sub: t("Zabeleži telesno težo"), action: () => setStep(2) },
            ].map(({ icon, label, sub, action }, i) => (
              <button key={i} onClick={action} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", marginBottom: 8, background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 14, cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: `${C.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontFamily: C.display, fontWeight: 700, fontSize: 15, color: C.text }}>{label}</span>
                  <Mono style={{ color: C.muted, fontSize: 9 }}>{sub}</Mono>
                </span>
                <span style={{ color: C.muted }}>›</span>
              </button>
            ))}
          </>
        )}
        {step === 1 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
              <button onClick={() => setStep(0)} style={{ background: "none", border: `1px solid ${C.border2}`, borderRadius: 8, cursor: "pointer", color: C.muted, fontSize: 15, padding: "4px 8px", lineHeight: 1, WebkitTapHighlightColor: "transparent" }}>←</button>
              <Mono style={{ color: C.muted, fontSize: 10, letterSpacing: "0.12em" }}>{t("NOVA POŠKODBA")}</Mono>
            </div>
            <Mono style={{ color: C.muted, fontSize: 9, marginBottom: 6, display: "block" }}>{t("DEL TELESA")}</Mono>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 13 }}>
              {PARTS.map(p => (
                <button key={p} onClick={() => setForm(f => ({ ...f, part: p }))} style={{ padding: "6px 9px", borderRadius: 999, border: `1px solid ${form.part === p ? C.accent : C.border2}`, background: form.part === p ? `${C.accent}1f` : "transparent", color: form.part === p ? C.accent : C.text2, fontFamily: C.display, fontWeight: 600, fontSize: 12, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{t(p)}</button>
              ))}
            </div>
            {form.part === "Drugo" && (
              <div style={{ animation: "athlosFade 0.2s ease", marginBottom: 13 }}>
                <Mono style={{ color: C.muted, fontSize: 9, marginBottom: 6, display: "block" }}>{t("KJE JE POŠKODBA")}</Mono>
                <input value={form.customPart} onChange={e => setForm(f => ({ ...f, customPart: e.target.value }))} placeholder={t("npr. Zapestje, Trebušna mišica...")} autoFocus style={{ width: "100%", padding: "9px 10px", borderRadius: 10, border: `1px solid ${C.border2}`, background: C.surface, color: C.text, fontFamily: C.display, fontWeight: 600, fontSize: "16px", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}
            <Mono style={{ color: C.muted, fontSize: 9, marginBottom: 6, display: "block" }}>{t("STOPNJA")}</Mono>
            <div style={{ display: "flex", gap: 6, marginBottom: 13 }}>
              {[[1, t("LAHKA"), C.accent], [2, t("ZMERNA"), C.yellow || "#f59e0b"], [3, t("HUDA"), C.red || "#ef4444"]].map(([g, label, col]) => (
                <button key={g} onClick={() => setForm(f => ({ ...f, grade: g }))} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: `1px solid ${form.grade === g ? col : C.border2}`, background: form.grade === g ? `${col}1f` : "transparent", color: form.grade === g ? col : C.muted, fontFamily: C.display, fontWeight: 700, fontSize: 11, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{g} · {label}</button>
              ))}
            </div>
            <Mono style={{ color: C.muted, fontSize: 9, marginBottom: 5, display: "block" }}>{t("OPIS")}</Mono>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={t("Opiši simptome ali lokacijo bolečine...")} rows={3} style={{ width: "100%", padding: "9px 10px", borderRadius: 10, border: `1px solid ${C.border2}`, background: C.surface, color: C.text, fontFamily: C.display, fontSize: "14px", resize: "none", outline: "none", marginBottom: 13, boxSizing: "border-box" }} />
            <button onClick={() => { if (!valid) return; const partLabel = form.part === "Drugo" ? form.customPart.trim() : t(form.part); onSave({ name: `${t("Poškodba")} · ${partLabel}`, bodyPart: partLabel, grade: form.grade, phase: 0, progressNote: form.note || t("Sveža poškodba — začetek protokola."), returnWeeks: form.grade * 2, returnDate: `${t("za")} ${form.grade * 2} ${t("tedna")}`, coachNote: "" }); onClose(); }} style={{ width: "100%", padding: "11px", borderRadius: 999, border: "none", background: valid ? C.btn : C.surface3, color: valid ? C.btnText : C.muted, fontFamily: C.display, fontWeight: 800, fontSize: 14, cursor: valid ? "pointer" : "default", letterSpacing: "0.04em", WebkitTapHighlightColor: "transparent" }}>{t("SHRANI POŠKODBO")}</button>
          </>
        )}
        {step === 2 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <button onClick={() => setStep(0)} style={{ background: "none", border: `1px solid ${C.border2}`, borderRadius: 8, cursor: "pointer", color: C.muted, fontSize: 15, padding: "4px 8px", lineHeight: 1, WebkitTapHighlightColor: "transparent" }}>←</button>
              <Mono style={{ color: C.muted, fontSize: 10, letterSpacing: "0.12em" }}>{t("TEHTANJE")}</Mono>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 22 }}>
              <button onClick={() => setWeightKg(w => Math.max(30, +(w - 0.1).toFixed(1)))} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.border2}`, background: C.surface2, color: C.text, fontSize: 22, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>−</button>
              <div style={{ minWidth: 120, textAlign: "center" }}>
                <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 38, color: C.text, letterSpacing: "-0.02em" }}>{weightKg.toFixed(1)}</span>
                <span style={{ fontFamily: C.mono, fontSize: 13, color: C.muted, marginLeft: 6 }}>kg</span>
              </div>
              <button onClick={() => setWeightKg(w => +(w + 0.1).toFixed(1))} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.border2}`, background: C.surface2, color: C.text, fontSize: 22, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>+</button>
            </div>
            <button onClick={() => { onSaveWeight?.(weightKg); onClose(); }} style={{ width: "100%", padding: "11px", borderRadius: 999, border: "none", background: C.btn, color: C.btnText, fontFamily: C.display, fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: "0.04em", WebkitTapHighlightColor: "transparent" }}>{t("SHRANI TEŽO")}</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Body stats (tapping the readiness circle) ────────────────
const STAT_METRICS = [
  {
    key: "weight", label: "Teža", labelEn: "Weight", unit: "kg", color: "#1F7A52",
    data: [83.2, 82.8, 82.5, 82.1, 81.9, 82.3, 81.7, 81.4, 81.1, 80.9, 80.6, 80.8, 80.3, 80.1],
    trendSL: "−3.1 kg za 14 dni", trendEN: "−3.1 kg over 14 days", good: "down",
  },
  {
    key: "sleep", label: "Spanje", labelEn: "Sleep", unit: "h", color: "#7A8B5C",
    data: [7.2, 6.5, 8.1, 7.8, 6.9, 7.5, 8.2, 7.0, 6.8, 7.9, 8.0, 7.3, 7.6, 7.4],
    trendSL: "Ø 7.4h / noč", trendEN: "Avg 7.4h / night", good: "up",
  },
  {
    key: "hrv", label: "HRV", labelEn: "HRV", unit: "ms", color: "#00C878",
    data: [62, 58, 65, 71, 68, 55, 60, 63, 67, 72, 69, 64, 66, 70],
    trendSL: "+13% za 14 dni", trendEN: "+13% over 14 days", good: "up",
  },
  {
    key: "soreness", label: "Sornost", labelEn: "Soreness", unit: "/5", color: "#C95A3F",
    data: [3, 2, 4, 3, 2, 1, 3, 4, 3, 2, 2, 3, 2, 2],
    trendSL: "Povprečje 2.6/5", trendEN: "Average 2.6/5", good: "down",
  },
  {
    key: "recovery", label: "Okrevanje", labelEn: "Recovery", unit: "%", color: "#00C878",
    data: [58, 62, 55, 68, 71, 64, 60, 66, 72, 69, 65, 70, 74, 71],
    trendSL: "Povprečje 66%", trendEN: "Average 66%", good: "up",
  },
  {
    key: "mood", label: "Počutje", labelEn: "Mood", unit: "/5", color: "#C9A727",
    data: [3, 4, 3, 4, 5, 4, 3, 4, 4, 5, 4, 3, 4, 5],
    trendSL: "Povprečje 3.9/5", trendEN: "Average 3.9/5", good: "up",
  },
];

function SparkChart({ data, color, C, metricKey }) {
  const W = 320, H = 150;
  const PAD = { top: 16, right: 8, bottom: 28, left: 36 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const minV = Math.min(...data), maxV = Math.max(...data);
  const rng = (maxV - minV) || 1;
  const yMin = minV - rng * 0.2, yMax = maxV + rng * 0.2;
  const toX = i => PAD.left + (i / (data.length - 1)) * cW;
  const toY = v => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * cH;
  const pts = data.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const line = pts.reduce((s, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const px = pts[i - 1], cx = ((px.x + p.x) / 2).toFixed(1);
    return `${s} C${cx},${px.y.toFixed(1)} ${cx},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, "");
  const bot = (PAD.top + cH).toFixed(1);
  const area = `${line} L${pts[pts.length-1].x.toFixed(1)},${bot} L${pts[0].x.toFixed(1)},${bot} Z`;
  const gid = `sg-${metricKey}`;
  const yLabels = [minV, (minV + maxV) / 2, maxV];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yLabels.map((v, i) => (
        <line key={i} x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)} stroke={C.border} strokeWidth="1" strokeDasharray="3 5" opacity="0.5" />
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => {
        const isLast = i === pts.length - 1;
        if (i % 3 !== 0 && !isLast) return null;
        return <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={isLast ? 5 : 3.5} fill={isLast ? color : C.bg} stroke={color} strokeWidth={isLast ? 0 : 2} />;
      })}
      {yLabels.map((v, i) => (
        <text key={i} x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fontSize="9" fill={C.muted} fontFamily="monospace">{Math.round(v * 10) / 10}</text>
      ))}
      {data.map((_, i) => {
        if (i % 4 !== 0 && i !== data.length - 1) return null;
        const d = new Date(); d.setDate(d.getDate() - (data.length - 1 - i));
        return <text key={i} x={toX(i).toFixed(1)} y={H - 4} textAnchor="middle" fontSize="9" fill={C.muted} fontFamily="monospace">{d.getDate()}/{d.getMonth() + 1}</text>;
      })}
    </svg>
  );
}

function StatsSheet({ C, lang, onClose, initialMetric = "weight" }) {
  const [metric, setMetric] = useState(initialMetric);
  const m = STAT_METRICS.find(x => x.key === metric);
  const current = m.data[m.data.length - 1];
  const diff = Math.round((current - m.data[0]) * 10) / 10;
  const avg = Math.round((m.data.reduce((s, v) => s + v, 0) / m.data.length) * 10) / 10;
  const minV = Math.round(Math.min(...m.data) * 10) / 10;
  const maxV = Math.round(Math.max(...m.data) * 10) / 10;
  const isGood = (m.good === "down" && diff <= 0) || (m.good === "up" && diff >= 0);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.bg, borderRadius: "28px 28px 0 0", padding: "0 13px 30px", maxHeight: "92vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: C.border2, margin: "14px auto 20px" }} />
        <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.12em", display: "block", marginBottom: 14 }}>
          {lang === "en" ? "BODY STATS · 14 DAYS" : "TELESNA STATISTIKA · 14 DNI"}
        </Mono>
        {/* Metric tabs */}
        <div style={{ display: "flex", gap: 5, marginBottom: 16, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {STAT_METRICS.map(sm => (
            <button key={sm.key} onClick={() => setMetric(sm.key)} style={{
              flexShrink: 0, padding: "6px 11px", borderRadius: 999,
              border: `1.5px solid ${metric === sm.key ? sm.color : C.border}`,
              background: metric === sm.key ? `${sm.color}22` : "transparent",
              color: metric === sm.key ? sm.color : C.muted,
              fontFamily: C.display, fontWeight: 700, fontSize: 13,
              cursor: "pointer", transition: "all 0.15s", WebkitTapHighlightColor: "transparent",
            }}>
              {lang === "en" ? sm.labelEn : sm.label}
            </button>
          ))}
        </div>
        {/* Current value + diff */}
        <div style={{ marginBottom: 15 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 40, color: C.text, letterSpacing: "-0.03em", lineHeight: 1 }}>{current}</span>
            <span style={{ fontFamily: C.display, fontWeight: 500, fontSize: 17, color: C.muted }}>{m.unit}</span>
            <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15, color: isGood ? C.accent : C.red, marginLeft: 4 }}>
              {diff > 0 ? "+" : ""}{diff}{m.unit}
            </span>
          </div>
          <div style={{ fontFamily: C.display, fontSize: 13, color: C.muted, marginTop: 4 }}>
            {lang === "en" ? m.trendEN : m.trendSL}
          </div>
        </div>
        {/* Chart */}
        <div style={{ marginBottom: 15 }}>
          <SparkChart data={m.data} color={m.color} C={C} metricKey={m.key} />
        </div>
        {/* Min / Avg / Max */}
        <div style={{ display: "flex", gap: 6 }}>
          {[["MIN", minV], [lang === "en" ? "AVG" : "POVP", avg], ["MAX", maxV]].map(([lbl, val]) => (
            <div key={lbl} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "9px 6px", textAlign: "center" }}>
              <Mono style={{ color: C.muted, fontSize: 8.5, display: "block" }}>{lbl}</Mono>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text, marginTop: 4 }}>{val} {m.unit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── RECOVERY DETAIL — PDF Upgrade 2: tapping the Recovery quick-stat tile
// opens this instead of the generic body-stats sheet. Shows what's actually
// real: avg sleep + the recovery sub-score (both from checkins), and a short
// interpretation. Avg HRV/RHR need a wearable feed this app doesn't ingest
// yet (no Apple Health / Samsung Health connection) — shown honestly as
// "not connected" rather than a fabricated number, unless the bundled demo
// Whoop series is active, in which case that real series is used.
function RecoveryDetailSheet({ C, t, onClose, avgSleep, avgRecovery, hasData, recText, hrv, rhr }) {
  const rows = [
    { label: t("POVP. HRV"), value: hrv != null ? `${hrv} ms` : t("Ni povezano"), muted: hrv == null },
    { label: t("POVP. RHR"), value: rhr != null ? `${rhr} bpm` : t("Ni povezano"), muted: rhr == null },
    { label: t("POVP. SPANEC"), value: avgSleep != null ? `${avgSleep.toFixed(1)}h` : "—", muted: avgSleep == null },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.bg, borderRadius: "28px 28px 0 0", padding: "0 13px 26px", maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: C.border2, margin: "14px auto 20px" }} />
        <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.12em", display: "block", marginBottom: 4 }}>{t("OKREVANJE · 7 DNI")}</Mono>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
          <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 34, color: C.text, letterSpacing: "-0.02em" }}>
            {avgRecovery != null ? Math.round(avgRecovery) : "—"}
          </span>
          <span style={{ fontFamily: C.display, fontWeight: 500, fontSize: 15, color: C.muted }}>%</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "9px 6px", textAlign: "center" }}>
              <Mono style={{ color: C.muted, fontSize: 8, display: "block" }}>{r.label}</Mono>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: r.muted ? 10.5 : 14, color: r.muted ? C.muted2 : C.text, marginTop: 4 }}>{r.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 0 9px" }}>
          <span style={{ fontFamily: C.heading, fontWeight: 700, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: C.text }}>{t("RAZLAGA")}</span>
          <span style={{ flex: 1, height: 1, background: C.border }} />
        </div>
        <p style={{ fontFamily: C.display, fontStyle: "italic", fontSize: 13.5, color: C.text2, lineHeight: 1.6, margin: 0 }}>
          {hasData ? t(recText) : t("Izpolni check-in, da dobiš razlago svojega okrevanja.")}
        </p>
      </div>
    </div>
  );
}

// Bottom sheet that can be dismissed either by tapping the backdrop or by
// pulling down once its content is scrolled to the top — the same gesture
// as iOS/Google Maps sheets ("scroll down and it goes away").
function DragSheet({ children, onClose, style }) {
  const scrollRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Native non-passive listeners: React registers its touch handlers as
  // passive, so e.preventDefault() there can't stop the native scroll — and
  // without it the dismiss drag and the scroll fight over the same gesture.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const g = { startX: 0, startY: 0, active: false, decided: false, dy: 0 };
    const onStart = (e) => {
      // the sheet owns its touches — nothing behind it (pull-to-refresh,
      // tab swipes) may react to them
      e.stopPropagation();
      g.startX = e.touches[0].clientX;
      g.startY = e.touches[0].clientY;
      g.active = false;
      g.decided = false;
      g.dy = 0;
    };
    const onMove = (e) => {
      e.stopPropagation();
      const dx = e.touches[0].clientX - g.startX;
      const dy = e.touches[0].clientY - g.startY;
      if (!g.active) {
        if (!g.decided && dy > 6 && Math.abs(dx) < dy && el.scrollTop <= 0) {
          // downward pull with the content at the top → dismiss drag;
          // rebase so the sheet follows from where the pull was armed
          g.active = true;
          g.startY = e.touches[0].clientY;
          setDragging(true);
        } else {
          // horizontal move (sliders), upward move or scrolled content →
          // a normal gesture; stay out of the way until the finger lifts
          if (Math.abs(dx) > 8 || dy < -8 || el.scrollTop > 0) g.decided = true;
          return;
        }
      }
      e.preventDefault(); // the drag owns the gesture — no scroll under it
      g.dy = Math.max(0, e.touches[0].clientY - g.startY);
      setDragY(g.dy);
    };
    const onEnd = (e) => {
      e.stopPropagation();
      if (g.active && g.dy > 90) {
        setDragY(800); // slide fully off, then unmount
        setTimeout(() => closeRef.current(), 220);
      } else {
        setDragY(0);
      }
      g.active = false;
      setDragging(false);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      className="athlos-scroll"
      style={{
        ...style,
        overscrollBehavior: "contain",
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transition: dragging ? "none" : "transform 0.28s cubic-bezier(.22,1,.36,1)",
      }}
    >
      {children}
    </div>
  );
}

export default function ScreenToday({ go, profile, user, chatUnread = 0 }) {
  const C = useTheme();
  const t = useT();
  const lang = useLang();
  const [openStats, setOpenStats] = useState(false);
  const [statsMetric, setStatsMetric] = useState("weight"); // which tab StatsSheet opens on
  const [openBattery, setOpenBattery] = useState(false); // battery-info sheet (tap the score)
  const [openCheckin, setOpenCheckin] = useState(false);  // dedicated Morning Check-in flow
  const [openQuickAdd, setOpenQuickAdd] = useState(false); // "+" menu — injury / edit session / weight
  const [openRecoveryDetail, setOpenRecoveryDetail] = useState(false); // Recovery tile → detail sheet
  // Real per-user weigh-ins (Upgrade 3 · Kilaža) — empty until the athlete
  // logs one via the "+" menu, never a fabricated series.
  const [bodyWeights, setBodyWeights] = useState([]);
  const reloadBodyWeights = () => { listBodyWeights(user?.id, 30).then(setBodyWeights).catch(() => {}); };
  useEffect(() => { if (user?.id) reloadBodyWeights(); }, [user?.id]);
  // Active injury (Upgrade 5 · dynamic widget) — null when the athlete has no
  // open report, in which case the widget below falls back to Daily Coach.
  const [activeInjury, setActiveInjury] = useState(null);
  const reloadActiveInjury = () => { getActiveInjury(user?.id).then(setActiveInjury).catch(() => {}); };
  useEffect(() => { if (user?.id) reloadActiveInjury(); }, [user?.id]);
  // Freshness (PDF Upgrade 4 · replaces Fatigue) — real ATL/CTL/TSB computed
  // from the athlete's actual logged workouts (see buildLoadSeries above),
  // not a wearable feed this app doesn't have.
  const [freshness, setFreshness] = useState(null);
  useEffect(() => {
    let live = true;
    listWorkouts(user?.id, 90).then((rows) => {
      if (!live) return;
      const series = buildLoadSeries(rows);
      setFreshness(freshnessFromLoads(series));
    }).catch(() => {});
    return () => { live = false; };
  }, [user?.id]);
  // Daily Coach metrics for the non-injured branch of the dynamic widget
  // (Upgrade 5) — same real-data source already used on the AI chat screen.
  const [coachMetrics, setCoachMetrics] = useState(null);
  // Tapping a day in the week strip shows THAT day's readiness instead of
  // navigating away — null means "today" (the live, editable check-in).
  // Tapping the same day again (or today) returns to the live view.
  const [selectedIso, setSelectedIso] = useState(null);
  // Full check-in rows (not just the boolean "done" dot) for the current
  // week, so a past day's readiness can be recomputed the same way today's
  // is — from real sleep/mood/soreness/stress/hydration answers, not guessed.
  const [weekCheckinRows, setWeekCheckinRows] = useState({});
  const [checkin, setCheckin] = useState(loadCheckin);
  useEffect(() => { try { localStorage.setItem(CHECKIN_KEY, JSON.stringify(checkin)); } catch {} }, [checkin]);
  useEffect(() => {
    let live = true;
    getDailyCoachMetrics(user?.id).then((r) => { if (live) setCoachMetrics(r); }).catch(() => {});
    return () => { live = false; };
  }, [user?.id, checkin.touched]);
  useEffect(() => {
    let live = true;
    listCheckins(user?.id, 8)
      .then((rows) => {
        if (!live) return;
        const map = {};
        rows.forEach((r) => { map[r.date] = r; });
        setWeekCheckinRows(map);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [user?.id, checkin.touched]);

  const rootRef = useRef(null);

  // Restore today's real check-in from the account (cross-device) — only
  // overrides the local draft if the cloud actually has today's row, so it
  // never clobbers an in-progress edit on this device.
  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    getTodayCheckin(user.id).then((row) => {
      if (!live || !row) return;
      setCheckin((p) => ({
        ...p, touched: true,
        sleepH: row.sleep_h ?? p.sleepH, sleepQuality: row.sleep_quality ?? p.sleepQuality,
        mood: row.mood ?? p.mood, soreness: row.soreness ?? p.soreness,
        stress: row.stress ?? p.stress, hydration: row.hydration ?? p.hydration,
      }));
    }).catch(() => {});
    return () => { live = false; };
  }, [user?.id]);

  // "Has today's check-in been answered?" — real state, not a bare
  // localStorage read in the render body. The old form recomputed only as a
  // side effect of some *other* re-render happening to occur, so the card
  // could keep claiming the check-in was pending after it had been answered.
  // Seeded from storage, re-synced when the account id resolves, and set to
  // false the moment an answer is recorded.
  const [checkinPending, setCheckinPending] = useState(() => checkinPendingToday(user?.id));
  // Streak / week-dot source, same real-state treatment as `checkinPending`
  // and for the same reason: nothing here may fall back to a bare
  // localStorage read that only happens to refresh when some UNRELATED
  // re-render occurs. Every place that rewrites the wellness store below
  // calls its setter explicitly.
  const [wellDays, setWellDays] = useState(() => loadWellness(user?.id).days);

  useEffect(() => {
    // Claim anything recorded before the id existed, then re-read.
    adoptLocalWellness(user?.id);
    setCheckinPending(checkinPendingToday(user?.id));
    setWellDays(loadWellness(user?.id).days);
  }, [user?.id]);

  // Reconcile the local streak/week-dot store with the account's real history.
  //
  // saveCheckin() already writes every answer to Supabase's `checkins` table
  // (lib/api.js), so the DATA has never actually been at risk. But streak,
  // the week dots and checkinPendingToday() all read a separate, LOCAL-ONLY
  // "done" map (lib/widgets/CheckinCard.jsx) that nothing ever fed from the
  // account — so a fresh device, a cleared browser, or a reinstall forgot
  // every day the athlete had ever logged: streak back to 0, and today's
  // check-in reported as still pending even when it was already done on
  // another device. This pulls the account's check-in dates down once per
  // login and folds them in (gaps only — never overwrites a local answer).
  //
  // 60 days is a pragmatic window, not a hard limit: markWellnessDone() keeps
  // writing locally on every check-in regardless, so only a login on a device
  // that has NEVER logged a given day locally depends on this fetch — and a
  // streak long enough to outrun a 60-day resync already survived on the
  // device(s) that built it.
  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    listCheckins(user.id, 60).then((rows) => {
      if (!live) return;
      if (syncWellnessFromCheckins(user.id, rows)) {
        setWellnessTick((n) => n + 1);
        setCheckinPending(checkinPendingToday(user.id));
      }
    }).catch(() => {});
    return () => { live = false; };
  }, [user?.id]);

  // Any real interaction marks today as checked-in — from then on the score
  // reflects what was actually entered, persisted to the account and to the
  // streak/notifications storage.
  //
  // The writes deliberately do NOT live inside the setCheckin updater. An
  // updater must be pure: StrictMode double-invokes it, and React may replay
  // the update queue, so a `saveCheckin()` in there fires a duplicate network
  // write per tap and `markWellnessDone()` runs twice. Doing the effects here
  // runs each exactly once per answer.
  const setC = (k, v) => {
    const next = { ...checkin, [k]: v, touched: true };
    setCheckin(next);
    markWellnessDone(user?.id, next);
    saveCheckin(user?.id, next).catch(() => {});
    // Flip the flag explicitly rather than waiting for the next render to
    // re-read localStorage — see the checkinPending state below.
    setCheckinPending(false);
  };

  const now = new Date();
  const DAYS = lang === "en" ? DAYS_EN : DAYS_SL;
  const MONTHS = lang === "en" ? MONTHS_EN : MONTHS_SL;
  const dateStr = `${DAYS[now.getDay()]} · ${now.getDate()}. ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // A brand-new athlete has entered nothing yet — readiness is honestly 0,
  // not a borrowed or fabricated number, until they touch the check-in.
  const hasData = !!checkin.touched;
  // V2 "sidrna" engine (SPEC-formule-tehnicno.md) when wearable history is
  // bundled — Recovery anchor + Freshness (load balance) + today's wellness.
  // Falls back to the simple composite when there's no wearable series.
  const engine = hasWhoopDemo ? readinessFromWhoop : readinessFromCheckin;
  const { battery, components, season } = hasData
    ? engine(checkin)
    : { battery: 0, components: [], season: checkin.season };
  // Strain / training load (0–21) for the second gauge. Today's load is 0 on a
  // rest day, which reads as an empty/broken gauge — so fall back to the most
  // recent training day in the last week for a representative "recent load".
  const strain = hasWhoopDemo ? (() => {
    const s = whoopSeries(8);
    if (!s.length) return null;
    const today = s[s.length - 1].strain || 0;
    if (today > 0.5) return today;
    for (let i = s.length - 1; i >= 0; i--) if (s[i].strain > 0.5) return s[i].strain;
    return today;
  })() : null;
  // Push the score onto the club card so the coach dashboard shows live data.
  // Always today's real battery, regardless of which day is being BROWSED
  // below — the coach dashboard must never learn a past day's number here.
  useEffect(() => { if (user?.id) syncMyClubCard(user.id, { readiness: hasData ? battery : null }); }, [user?.id, battery, hasData]);

  const rec = hasData
    ? recommendation(battery)
    : { key: "none", text: "Izpolni svoj prvi check-in, da vidiš pravo pripravljenost.", tone: "yellow" };
  const tone = rec.tone === "accent" ? C.accent : rec.tone === "yellow" ? C.yellow : C.red;
  const shown = useCountUp(battery);

  // ── Viewing a past day (tapped in the week strip) ──────────────────────
  // Recomputed from that day's REAL stored check-in (checkins table), the
  // same engine used for today — never a guess. Every `view*` variable below
  // is a PARALLEL copy used only by the two gauges, the Recovery Insight
  // card and the STATUS row — `rec`/`tone`/`battery`/`components`/`recScore`
  // above stay today-only and untouched, since the battery-info sheet and
  // Quick Stats further down are deliberately always about today regardless
  // of what's being browsed here.
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const viewingPast = !!(selectedIso && selectedIso !== todayIso);
  const pastRow = viewingPast ? weekCheckinRows[selectedIso] : null;
  const viewHasData = viewingPast ? !!pastRow : hasData;
  const { battery: viewBattery, components: viewComponents } = viewingPast
    ? (pastRow
        ? readinessFromCheckin({
            sleepQuality: pastRow.sleep_quality, mood: pastRow.mood, soreness: pastRow.soreness,
            stress: pastRow.stress, sleepH: pastRow.sleep_h, hydration: pastRow.hydration,
            season: checkin.season, cycleModifier: checkin.cycleModifier,
          })
        : { battery: 0, components: [] })
    : { battery, components };

  // Initial inline state only (opacity 0, no CSS keyframe) — the GSAP effect
  // below (see rootRef) staggers every [data-rise] section in on mount:
  // opacity 0→1, y 28→0, power3.out, matching the rest of the app's motion.
  const rise = () => ({ opacity: 0 });

  // ── Notifications (bell, top-left) — built from state the app already has:
  // today's check-in, unread chats, and the upcoming session. Recomputed every
  // render, so submitting the questionnaire (a state update) clears its row.

  // Page-load entrance — every [data-rise] section (header, gauges, cards…)
  // fades and lifts in together, power3.out, a soft stagger between them.
  // Runs once on mount only, and is skipped for prefers-reduced-motion.
  //
  // Deliberately mount-only. `rise()` puts an inline opacity:0 on every riser
  // and ONLY this tween clears it, so re-running the effect is dangerous: the
  // cleanup would kill a stagger mid-flight and strand whole sections at a
  // partial opacity with no second chance. Anything that can mount LATER (the
  // check-in card, whose visibility depends on `user?.id` resolving) must
  // therefore carry its own CSS entrance instead of joining this stagger.
  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const els = rootRef.current?.querySelectorAll("[data-rise]");
    if (!els?.length) return;
    if (reduceMotion) { gsap.set(els, { opacity: 1 }); return; }
    const tween = gsap.fromTo(els,
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.07, clearProps: "opacity,transform" });
    return () => tween.kill();
  }, []);

  // Arriving here from the check-in notification: open it immediately, and
  // record today as already prompted so the auto-open below can't reopen the
  // sheet 650ms after the user deliberately closed it.
  const cameFromNotification = useRef(false);
  useEffect(() => {
    if (!takeIntent("open-checkin")) return;
    cameFromNotification.current = true;
    try {
      const d = new Date();
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      localStorage.setItem(`athlos:checkinPrompted:${user?.id || "local"}`, iso);
    } catch {}
    setOpenCheckin(true);
  }, [user?.id]);

  // Auto-open the morning check-in the first time the home screen is shown on a
  // new day while it's still pending — so the user lands straight in it. Guarded
  // per user + date in localStorage, so it opens at most once a day; after that
  // the on-page card is the way back in.
  useEffect(() => {
    if (!checkinPending || cameFromNotification.current) return;
    const d = new Date();
    const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const key = `athlos:checkinPrompted:${user?.id || "local"}`;
    let prompted = null;
    try { prompted = localStorage.getItem(key); } catch {}
    if (prompted === todayIso) return;
    try { localStorage.setItem(key, todayIso); } catch {}
    const id = setTimeout(() => setOpenCheckin(true), 650);
    return () => clearTimeout(id);
  }, [checkinPending, user?.id]);

  // The dot tracks UNREAD notifications, not raw signals. Previously it stayed
  // lit whenever a check-in was due even after the notification had been read,
  // so clearing the inbox never cleared the bell. Same derivation the inbox
  // uses (lib/notifications), so the two cannot disagree. Safe to read at
  // render time: App re-keys the screen container per navigation, so returning
  // from the inbox remounts this and re-reads.
  const bellDot = unreadNotificationCount(user?.id, { chatUnread, now }) > 0;

  // Monday-first week strip: day letter + date, dot = check-in done that day
  // (`wellDays` is the real state declared above, kept in sync by its setter.)
  const weekLetters = lang === "en" ? ["M", "T", "W", "T", "F", "S", "S"] : ["P", "T", "S", "Č", "P", "S", "N"];
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const pad2 = (n) => String(n).padStart(2, "0");
  const week = weekLetters.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return { label, iso, num: d.getDate(), done: !!wellDays[iso], isToday: d.toDateString() === now.toDateString() };
  });
  const doneThisWeek = week.filter((d) => d.done).length;
  // Streak — consecutive days with a check-in ending today
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    if (wellDays[iso]) streak++; else break;
  }

  // Derived metrics for the recovery row, weekly progress and quick stats —
  // "—" instead of a number wherever the input hasn't actually been entered.
  // Today-only (used by Quick Stats + the battery-info sheet, unchanged from
  // before the week-strip day picker existed):
  const recComp = components.find((c) => c.key === "recovery");
  const recScore = hasData ? (recComp ? recComp.score : battery) : null;
  const WEEKLY_GOAL = 5;
  const doneWorkouts = Math.min(doneThisWeek, WEEKLY_GOAL);

  // Same set, but for the day being VIEWED in the week strip (drives the two
  // gauges, the Recovery Insight card and the STATUS row only).
  const viewRecComp = viewComponents.find((c) => c.key === "recovery");
  const viewRecScore = viewHasData ? (viewRecComp ? viewRecComp.score : viewBattery) : null;
  const viewSleepH = viewingPast ? pastRow?.sleep_h : checkin.sleepH;
  const viewMood = viewingPast ? pastRow?.mood : checkin.mood;

  return (
    <div ref={rootRef} style={{ padding: "6px 14px 26px", color: C.text, position: "relative" }}>
      {/* Header — mono date eyebrow above a large greeting; actions are quiet
          hairline circles so the name owns the row. */}
      <div data-rise style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "10px 0 24px", ...rise() }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
            <Mono style={{ color: C.muted2, fontSize: 9, letterSpacing: "0.22em" }}>{dateStr}</Mono>
          </div>
          <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 26, color: C.text, lineHeight: 1.06, letterSpacing: "-0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {t("Živjo,")} {(profile?.name || "Športnik").trim().split(/\s+/)[0]}
          </div>
        </div>
        <button onClick={() => { haptic(); setOpenQuickAdd(true); }} aria-label={t("Hitri vnos")} className="at-iconbtn" style={{
          width: 40, height: 40, borderRadius: "50%", cursor: "pointer", flexShrink: 0,
          background: "transparent", border: `1px solid ${C.border2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: C.text2, WebkitTapHighlightColor: "transparent",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button onClick={() => { haptic(); go("notifications"); }} aria-label={t("Obvestila")} className="at-iconbtn" style={{
          width: 40, height: 40, borderRadius: "50%", cursor: "pointer", flexShrink: 0,
          background: "transparent", border: `1px solid ${C.border2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: C.text2, WebkitTapHighlightColor: "transparent", position: "relative",
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 01-3.4 0" />
          </svg>
          {bellDot && <span aria-hidden="true" style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: C.red, border: `1.5px solid ${C.bg}` }} />}
        </button>
        <button onClick={() => { haptic(); go("settings"); }} aria-label={t("Profil")} className="at-iconbtn" style={{
          width: 40, height: 40, borderRadius: "50%", padding: 0, overflow: "hidden", flexShrink: 0,
          border: `1px solid ${C.border2}`, background: "transparent", cursor: "pointer", WebkitTapHighlightColor: "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {profile?.photo
            ? <img src={profile.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text2 }}>{(profile?.name || "A").trim()[0].toUpperCase()}</span>}
        </button>
      </div>

      {/* 2 · WEEKLY CALENDAR STRIP — tap a day to see ITS readiness on the two
          gauges below (future days are inert — there's nothing to show yet).
          Tap the selected day again, or today, to return to the live view. */}
      <div data-rise style={{ display: "flex", gap: 5, marginBottom: 8, ...rise() }}>
        {week.map((d) => {
          const isFuture = d.iso > todayIso;
          const isSelected = selectedIso ? d.iso === selectedIso : d.isToday;
          return (
            <button key={d.iso} disabled={isFuture} onClick={() => {
              if (isFuture) return;
              haptic();
              setSelectedIso((prev) => (d.iso === todayIso || prev === d.iso) ? null : d.iso);
            }} aria-label={`${d.label} ${d.num}`} aria-pressed={isSelected} style={{
              flex: 1, padding: "5px 0 6px", background: "none", border: "none",
              cursor: isFuture ? "default" : "pointer", opacity: isFuture ? 0.4 : 1,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              WebkitTapHighlightColor: "transparent",
            }}>
              <span style={{ fontFamily: C.mono, fontWeight: 600, fontSize: 9, letterSpacing: "0.06em", color: isSelected ? C.text : C.muted2 }}>{d.label}</span>
              <span style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: isSelected ? C.accent : C.surface2,
                color: isSelected ? C.btnText : C.text2,
                fontFamily: C.display, fontWeight: 700, fontSize: 12,
              }}>{d.num}</span>
              <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: "50%", background: d.done ? C.accent : "transparent" }} />
            </button>
          );
        })}
      </div>

      {/* Small "viewing a past day" indicator + quick way back to today —
          only shown once a non-today day is selected above. */}
      {viewingPast && (
        <div data-rise style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, ...rise() }}>
          <Mono style={{ color: C.muted2, fontSize: 9, letterSpacing: "0.14em" }}>
            {(week.find((d) => d.iso === selectedIso)?.label || "").toUpperCase()} {week.find((d) => d.iso === selectedIso)?.num}
          </Mono>
          <button onClick={() => { haptic(); setSelectedIso(null); }} style={{
            background: "none", border: "none", padding: "2px 8px", borderRadius: 999,
            color: C.accent, fontFamily: C.mono, fontSize: 9, letterSpacing: "0.1em", fontWeight: 700,
            cursor: "pointer", WebkitTapHighlightColor: "transparent",
          }}>{t("← DANES")}</button>
        </div>
      )}

      {/* 3 · RECOVERY + TRAINING LOAD — two premium liquid-fill metrics;
          tap either for the full breakdown (always today's, regardless of
          which day is being browsed above). */}
      <button data-rise onClick={() => { haptic(); setOpenBattery(true); }} aria-label={t("Pripravljenost")} style={{
        width: "100%", background: "none", border: "none", padding: 0, margin: "4px 0 14px",
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
        display: "flex", justifyContent: "center", gap: 26, flexWrap: "wrap", ...rise(),
      }}>
        <LiquidMetric value={viewHasData ? viewBattery : 0} max={100} label={t("Pripravljenost")} color={C.accent} decimals={0} fillAlpha={0.58} C={C} size={100} />
        <LiquidMetric value={strain ?? 0} max={21} label={t("Obremenitev")} color={C.name === "dark" ? "#E6EBF0" : "#8A929C"} decimals={1} fillAlpha={0.2} C={C} size={100} />
      </button>

      {/* 3a · MORNING CHECK-IN — the day's primary action. Structurally the twin
          of the Recovery Insight card below it (eyebrow + status dot, headline,
          muted line) and sized off the same tokens, so the page keeps one card
          rhythm: Card's default 16 pad / 18 radius, 17px headline. What marks
          this one as the ACTION is the accent eyebrow and the chevron — not
          extra size, and not a fourth row. No tinted background either: the
          green is spent on the eyebrow and the chevron only. */}
      {/* NOT a [data-rise] section: this card's visibility depends on
          `user?.id`, so it can mount after the page-load stagger has already
          run and would then be stranded at opacity 0 forever. A self-contained
          CSS entrance plays correctly whenever it happens to mount. */}
      {checkinPending && (
        <Card
          onClick={() => { haptic(); setOpenCheckin(true); }}
          aria-label={t("Izpolni današnji check-in")}
          style={{ marginBottom: 20, animation: "athlosRise 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
                  <Mono style={{ color: C.accent, fontSize: 9.5, letterSpacing: "0.18em" }}>{t("DANEŠNJI CHECK-IN")}</Mono>
                </div>
                <Mono style={{ color: C.muted2, fontSize: 9.5, letterSpacing: "0.08em", flexShrink: 0 }}>{t("4 VPRAŠANJA")}</Mono>
              </div>

              <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, color: C.text, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                {t("Izpolni današnji check-in")}
              </div>
              <p style={{ fontFamily: C.display, fontWeight: 500, fontSize: 12.5, color: C.muted, lineHeight: 1.6, margin: "8px 0 0" }}>
                {t("Odgovori na vprašanja in posodobi svojo pripravljenost.")}
              </p>
            </div>
            <ChevronRight size={17} color={C.accent} strokeWidth={2.2} style={{ flexShrink: 0 }} />
          </div>
        </Card>
      )}

      {/* 4b · DYNAMIC WIDGET — PDF Upgrade 5: replaces the plain "recent
          check-ins" list. An open injury takes priority (status/location/
          recovery phase); otherwise the real, per-user Daily Coach card. */}
      <div data-rise style={{ marginBottom: 20, ...rise() }}>
        {activeInjury ? (
          <>
            <SectionLabel>{t("POŠKODBA")}</SectionLabel>
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: C.red || "#ef4444", flexShrink: 0 }} />
                  <Mono style={{ color: C.red || "#ef4444", fontSize: 9.5, letterSpacing: "0.14em" }}>{t("AKTIVNA POŠKODBA")}</Mono>
                </div>
                <Mono style={{ color: C.muted2, fontSize: 9 }}>{t("FAZA")} {activeInjury.phase ?? 0}/3</Mono>
              </div>
              <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, color: C.text, marginBottom: 6 }}>
                {activeInjury.body_part}
              </div>
              <p style={{ fontFamily: C.display, fontWeight: 500, fontSize: 12.5, color: C.muted, lineHeight: 1.6, margin: "0 0 10px" }}>
                {activeInjury.note || t("Sveža poškodba — začetek protokola.")}
              </p>
              {activeInjury.return_weeks != null && (
                <Mono style={{ color: C.muted2, fontSize: 9 }}>{t("Pričakovana vrnitev za")} {activeInjury.return_weeks} {t("tedna")}</Mono>
              )}
              {activeInjury.coach_note && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <Mono style={{ color: C.muted2, fontSize: 8.5, display: "block", marginBottom: 4 }}>{t("OPOMBA TRENERJA")}</Mono>
                  <p style={{ fontFamily: C.display, fontSize: 12.5, color: C.text2, margin: 0, lineHeight: 1.5 }}>{activeInjury.coach_note}</p>
                </div>
              )}
            </Card>
          </>
        ) : coachMetrics ? (
          <DailyCoachCard metrics={coachMetrics.metrics} t={t} userId={user?.id} dateIso={coachMetrics.dateIso} />
        ) : null}
      </div>

      {/* 5 · TODAY'S WORKOUT — name · meta · big Start button */}
      <div data-rise style={{ marginBottom: 20, ...rise() }}>
        <SectionLabel>{t("DANAŠNJI TRENING")} · 17:00</SectionLabel>
        <Card pad={22}>
          <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 21, margin: "0 0 13px", color: C.text, lineHeight: 1.12, letterSpacing: "-0.01em" }}>{t("Moč · Spodnji del")}</h2>
          <div style={{ display: "flex", marginBottom: 15 }}>
            {[
              { k: t("TRAJANJE"), v: `62 ${t("min")}` },
              { k: t("KALORIJE"), v: "~480" },
              { k: t("TEŽAVNOST"), v: t("Srednja") },
            ].map((m, i) => (
              <div key={m.k} style={{ flex: 1, borderLeft: i ? `1px solid ${C.border}` : "none", paddingLeft: i ? 14 : 0 }}>
                <div style={{ fontFamily: C.mono, fontSize: 8, letterSpacing: "0.1em", color: C.muted2, marginBottom: 5 }}>{m.k}</div>
                <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14.5, color: C.text }}>{m.v}</div>
              </div>
            ))}
          </div>
          <button onClick={() => { try { navigator.vibrate?.(12); } catch {} go("train"); }} style={{
            width: "100%", height: 46, borderRadius: 12, border: "none", background: C.btn, color: C.btnText,
            fontFamily: C.display, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, cursor: "pointer", WebkitTapHighlightColor: "transparent",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
            {t("Začni trening")}
          </button>
        </Card>
      </div>

      {/* 6 · STATUS — Sleep · Recovery · Fatigue · Mood, all four on one row.
          Four equal grid columns rather than flex: `minmax(0, 1fr)` makes the
          tiles provably identical in width and lets them shrink together on a
          narrow screen instead of one of them pushing the others out. */}
      <div data-rise style={{ marginBottom: 20, ...rise() }}>
        <SectionLabel>{t("STANJE")}</SectionLabel>
        {/* Only Recovery carries the accent: it is the same quantity as the
            readiness gauge above, which is already green. The other three are
            neutral, so the row reads green · white · grey rather than as four
            competing hues. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 7 }}>
          <MetricCard icon={Moon} label={t("Spanje").toUpperCase()}
            value={viewHasData ? viewSleepH : null} unit="h"
            onClick={() => { haptic(); setStatsMetric("sleep"); setOpenStats(true); }} />
          <MetricCard icon={HeartPulse} accent label={t("Okrevanje").toUpperCase()}
            value={viewHasData ? viewRecScore : null} unit="%"
            onClick={() => { haptic(); setStatsMetric("recovery"); setOpenStats(true); }} />
          <MetricCard icon={Zap} label={t("Freshness").toUpperCase()}
            value={!viewingPast && freshness ? freshness.freshness : null} unit="%" />
          <MetricCard icon={Smile} label={t("Počutje").toUpperCase()}
            value={viewHasData ? viewMood : null} unit="/5"
            onClick={() => { haptic(); setStatsMetric("mood"); setOpenStats(true); }} />
        </div>
      </div>

      {/* 7 · WEEKLY PROGRESS — streak · completed/goal · progress bar */}
      <div data-rise style={{ marginBottom: 20, ...rise() }}>
        <SectionLabel action={t("Koledar")} onAction={() => go("season")}>{t("TA TEDEN")}</SectionLabel>
        <Card onClick={() => { haptic(); go("season"); }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 11 }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 29, color: C.text, lineHeight: 1, letterSpacing: "-0.02em" }}>{streak}</span>
              {streak > 0 && <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>🔥</span>}
              <span style={{ fontFamily: C.display, fontWeight: 500, fontSize: 12.5, color: C.muted }}>{t("dni zapored")}</span>
            </span>
            <span style={{ textAlign: "right" }}>
              <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 15.5, color: C.text }}>{doneWorkouts}</span>
              <span style={{ fontFamily: C.display, fontWeight: 500, fontSize: 12.5, color: C.muted }}> / {WEEKLY_GOAL} {t("treningov")}</span>
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: C.surface3, overflow: "hidden" }}>
            <div style={{ width: `${Math.round((doneWorkouts / WEEKLY_GOAL) * 100)}%`, height: "100%", borderRadius: 999, background: C.accent, transition: "width 0.8s cubic-bezier(.22,1,.36,1)" }} />
          </div>
        </Card>
      </div>

      {/* 8 · QUICK STATS — 4 compact cards */}
      <div data-rise style={{ marginBottom: 6, ...rise() }}>
        <SectionLabel>{t("HITRE STATISTIKE")}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <StatTile label={t("OBREMENITEV")} value={t("Optimalna")} sub={t("7-dnevno povprečje")} />
          <StatTile onClick={() => { haptic(); setOpenRecoveryDetail(true); }} label={t("Okrevanje").toUpperCase()} value={hasData ? `${recScore}%` : "—"} sub={hasData ? `${components.length} ${t("vira")}` : t("Ni podatkov")} />
          <StatTile onClick={() => { haptic(); setOpenQuickAdd(true); }} label={t("KILAŽA")}
            value={bodyWeights.length ? `${bodyWeights[0].weight_kg} kg` : "—"}
            valueColor={C.text}
            sub={bodyWeights.length > 1 ? `${bodyWeights[0].weight_kg - bodyWeights[1].weight_kg >= 0 ? "+" : ""}${(bodyWeights[0].weight_kg - bodyWeights[1].weight_kg).toFixed(1)} kg` : t("Dodaj tehtanje")} />
          <StatTile label={t("KALORIJE DANES")} value="480" sub="kcal" />
        </div>
      </div>

      {openStats && <StatsSheet C={C} lang={lang} initialMetric={statsMetric} onClose={() => setOpenStats(false)} />}

      {openRecoveryDetail && (() => {
        const rows7 = Object.values(weekCheckinRows);
        const sleepVals = rows7.map((r) => r.sleep_h).filter((v) => v != null);
        const avgSleep = sleepVals.length ? sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length : null;
        const recVals = rows7.map((r) => {
          const { components: cs } = readinessFromCheckin({
            sleepQuality: r.sleep_quality, mood: r.mood, soreness: r.soreness,
            stress: r.stress, sleepH: r.sleep_h, hydration: r.hydration,
          });
          return cs.find((c) => c.key === "recovery")?.score;
        }).filter((v) => v != null);
        const avgRecovery = recVals.length ? recVals.reduce((a, b) => a + b, 0) / recVals.length : (hasData ? recScore : null);
        let hrv = null, rhr = null;
        if (hasWhoopDemo) {
          const s = whoopSeries(7);
          const hrvVals = s.map((d) => d.hrv).filter((v) => typeof v === "number");
          const rhrVals = s.map((d) => d.rhr).filter((v) => typeof v === "number");
          if (hrvVals.length) hrv = Math.round(hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length);
          if (rhrVals.length) rhr = Math.round(rhrVals.reduce((a, b) => a + b, 0) / rhrVals.length);
        }
        return (
          <RecoveryDetailSheet C={C} t={t} onClose={() => setOpenRecoveryDetail(false)}
            avgSleep={avgSleep} avgRecovery={avgRecovery} hasData={hasData} recText={rec.text} hrv={hrv} rhr={rhr} />
        );
      })()}

      {/* ── BATTERY INFO — bottom sheet, opens from the medallion ── */}
      {openBattery && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setOpenBattery(false); }} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(20,18,14,0.55)" }}>
          <DragSheet onClose={() => setOpenBattery(false)} style={{
            position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "88%", overflowY: "auto",
            background: C.bg, borderRadius: "28px 28px 0 0", padding: "11px 14px",
            paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))",
            animation: "athlosRise 0.32s cubic-bezier(0.22,1,0.36,1)",
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border2, margin: "0 auto 18px" }} />

            {/* header — score, status, season */}
            <div style={{ textAlign: "center", marginBottom: 13 }}>
              <Mono style={{ color: C.gold, fontSize: 9, letterSpacing: "0.3em" }}>{t("READINESS · BATERIJA")}</Mono>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, marginTop: 8 }}>
                <span style={{ fontFamily: C.heading, fontWeight: 700, fontSize: 42, color: C.text, lineHeight: 1 }}>{(battery / 10).toFixed(1)}</span>
                <Mono style={{ color: tone, fontSize: 10, letterSpacing: "0.22em" }}>{battery >= 70 ? "PARATUS" : battery >= 40 ? "CAUTION" : "REQUIES"}</Mono>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{ padding: "4px 8px", borderRadius: 999, background: `${tone}1a`, border: `1px solid ${tone}50`, display: "inline-block" }}>
                  <Mono style={{ color: tone, fontSize: 9 }}>{season === "off" ? t("OFF-SEASON") : t("MID-SEASON")}</Mono>
                </span>
              </div>
              <p style={{ fontFamily: C.display, fontStyle: "italic", fontSize: 14, color: C.text2, margin: "8px 0 0", lineHeight: 1.5 }}>{t(rec.text)}</p>
            </div>

            {/* quick metrics — tap for the metric history */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[
                { icon: <IconMoon size={20} color={tone} />, label: t("SPANJE"), val: `${checkin.sleepH}h` },
                { icon: <IconFace size={20} color={tone} />, label: t("POČUTJE"), val: `${checkin.mood}/5` },
                { icon: <IconBolt size={18} color={tone} />, label: t("SORNOST"), val: `${checkin.soreness}/5` },
              ].map(({ icon, label, val }) => (
                <button key={label} onClick={() => { haptic(); setOpenStats(true); }} style={{ flex: 1, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 5px", textAlign: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>{icon}</div>
                  <Mono style={{ color: C.muted, fontSize: 8, letterSpacing: "0.04em" }}>{label}</Mono>
                  <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13, color: C.text, marginTop: 2 }}>{val}</div>
                </button>
              ))}
            </div>

            {/* breakdown — engraved section */}
            <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 0 9px" }}>
              <span style={{ fontFamily: C.heading, fontWeight: 700, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: C.text, whiteSpace: "nowrap" }}>{t("RAZČLENITEV")}</span>
              <span style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 }}>
              {components.map((c) => (
                <div key={c.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text }}>{t(c.label)}</span>
                      <Mono style={{ color: C.muted2, fontSize: 8.5 }}>{t(c.sub)}</Mono>
                    </span>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <Mono style={{ color: C.muted2, fontSize: 8.5 }}>{Math.round(c.weight * 100)}%</Mono>
                      <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 13, color: c.score >= 70 ? C.accent : c.score >= 40 ? C.yellow : C.red }}>{c.score}</span>
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: C.surface3, overflow: "hidden" }}>
                    <div style={{ width: `${c.score}%`, height: "100%", borderRadius: 999, background: c.score >= 70 ? C.accent : c.score >= 40 ? C.yellow : C.red, transition: "width 0.8s ease" }} />
                  </div>
                </div>
              ))}
              <Mono style={{ color: C.muted2, fontSize: 8.5, marginTop: 2 }}>{t("7-dnevno drseče okno · uteži se prilagodijo razpoložljivim podatkom")}</Mono>
            </div>

            {/* inputs — engraved section */}
            <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 0 10px" }}>
              <span style={{ fontFamily: C.heading, fontWeight: 700, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: C.text, whiteSpace: "nowrap" }}>{t("JUTRANJI CHECK-IN")}</span>
              <span style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Compact summary of today's answers — the actual Q&A flow now
                  lives in its own dedicated MorningCheckinFlow sheet. */}
              <button onClick={() => { haptic(); setOpenCheckin(true); }} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: "11px 13px",
                cursor: "pointer", WebkitTapHighlightColor: "transparent",
              }}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", gap: 12 }}>
                  {[[t("SPANJE"), `${checkin.sleepQuality}/5`], [t("POČUTJE"), `${checkin.mood}/5`], [t("SORNOST"), `${checkin.soreness}/5`], [t("STRES"), `${checkin.stress}/5`]].map(([k, v]) => (
                    <span key={k}>
                      <Mono style={{ color: C.muted2, fontSize: 7.5, display: "block" }}>{k}</Mono>
                      <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 12.5, color: C.text }}>{v}</span>
                    </span>
                  ))}
                </span>
                <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 11.5, color: C.accent, flexShrink: 0, whiteSpace: "nowrap" }}>{t("Uredi")}</span>
              </button>
              <div>
                <Mono style={{ color: C.muted, fontSize: 9, marginBottom: 5, display: "block" }}>{t("FAZA SEZONE")}</Mono>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["mid", t("Sredina sezone")], ["off", t("Off-season")]].map(([val, lbl]) => (
                    <button key={val} onClick={() => setC("season", val)} style={{ flex: 1, padding: "7px", borderRadius: 9, cursor: "pointer", border: `1px solid ${checkin.season === val ? C.accent : C.border2}`, background: checkin.season === val ? `${C.accent}1f` : "transparent", color: checkin.season === val ? C.accent : C.muted, fontFamily: C.display, fontWeight: 700, fontSize: 12, WebkitTapHighlightColor: "transparent" }}>{lbl}</button>
                  ))}
                </div>
              </div>
              <Mono style={{ color: C.muted2, fontSize: 8.5 }}>{t("HRV/RHR pridejo iz Apple Health · prehrana iz dnevnika · hitrost iz treninga")}</Mono>
            </div>
          </DragSheet>
        </div>
      )}

      {/* ── MORNING CHECK-IN — dedicated flagship flow, one question at a time ── */}
      {openCheckin && (
        <MorningCheckinFlow checkin={checkin} setC={setC} onClose={() => setOpenCheckin(false)} C={C} t={t} />
      )}

      {/* ── "+" QUICK ADD — Upgrade 1: injury report / edit session / weight ── */}
      {openQuickAdd && (
        <QuickAddSheet
          C={C} t={t}
          onClose={() => setOpenQuickAdd(false)}
          lastWeight={bodyWeights[0]?.weight_kg}
          onEditSession={() => go("train")}
          onSaveWeight={(kg) => { saveBodyWeight(user?.id, kg).then(reloadBodyWeights).catch(() => {}); }}
          onSave={(report) => {
            saveInjuryReport(user?.id, report).then(reloadActiveInjury).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
