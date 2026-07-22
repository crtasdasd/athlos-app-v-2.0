import React, { useState } from "react";
import { useTheme } from "../theme";
import { Mono, BackBtn, Card, SectionLabel } from "../components/UI";
import { useT } from "../lib/i18n";
import { IcBolt, IcPulse, IcDumbbell, IcJump, IcHeart } from "../components/Icons";

const BENCHMARKS = [
  { id: "sprint10", icon: <IcBolt size={20} />, name: "Sprint 10m", unit: "s", mine: 1.76, team: 1.82, top10: 1.68, elite: 1.58, lower: true },
  { id: "sprint30", icon: <IcPulse size={20} />, name: "Sprint 30m", unit: "s", mine: 4.12, team: 4.28, top10: 3.95, elite: 3.72, lower: true },
  { id: "squat",   icon: <IcDumbbell size={20} />, name: "Squat 1RM",  unit: "kg", mine: 140,  team: 122,  top10: 155,  elite: 180,  lower: false },
  { id: "jump",    icon: <IcJump size={20} />, name: "V. skok",    unit: "cm", mine: 54,   team: 49,   top10: 62,   elite: 74,   lower: false },
  { id: "vo2",     icon: <IcHeart size={20} />, name: "VO₂max",    unit: "",   mine: 56,   team: 51,   top10: 62,   elite: 70,   lower: false },
];

const COACH_COMMENT = {
  grade: "A−",
  text: "Luka je v zgornji četrtini ekipe pri večini kazalnikov. Njegova eksplozivnost (sprint 10m) in vzdržljivost (VO₂max) sta nad ekipnim povprečjem. Prioriteta za naslednji mezociklus: povečanje moči spodnjega dela (počep +10–15 kg do konca sezone) in vzdrževanje sprintne hitrosti med poškodbo.",
  date: "2. jul 2026",
  coach: "Coach Matej",
};

// Score: 0–100 where 100 = elite level
function score(m, lower) {
  if (lower) {
    const best = m.elite, worst = m.team * 1.15;
    return Math.max(0, Math.min(100, ((worst - m.mine) / (worst - best)) * 100));
  }
  return Math.max(0, Math.min(100, (m.mine / m.elite) * 100));
}

function statusLabel(s, t) {
  if (s >= 88) return t("Svetovna raven");
  if (s >= 72) return t("Top 10%");
  if (s >= 50) return t("Nad povprečjem");
  return t("Pod povprečjem");
}
function statusColor(s, C) {
  if (s >= 88) return C.accent;
  if (s >= 72) return C.accent;
  if (s >= 50) return C.yellow;
  return C.red;
}

function BenchmarkCard({ m, C, t }) {
  const s = score(m, m.lower);
  const col = statusColor(s, C);
  const [expanded, setExpanded] = useState(false);

  // For bar chart: normalize relative to a "worst plausible" and elite
  const worst = m.lower ? m.team * 1.18 : m.team * 0.82;
  const best  = m.lower ? m.elite : m.elite;
  const pos = (v) => {
    if (m.lower) return Math.max(0, Math.min(1, (worst - v) / (worst - best)));
    return Math.max(0, Math.min(1, (v - worst) / (best - worst)));
  };

  const items = [
    { label: t("EKIPA"), val: m.team, col: C.muted },
    { label: t("MOJ"), val: m.mine, col: col },
    { label: "TOP 10%", val: m.top10, col: C.text },
    { label: t("ELITE"), val: m.elite, col: C.accent },
  ];

  return (
    <Card pad={16} style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
        <span style={{ display: "flex", flexShrink: 0, color: C.gold }}>{m.icon}</span>
        <div style={{ flex: 1 }}>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.1em" }}>{t(m.name).toUpperCase()}</Mono>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 2 }}>
            <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22, color: col, letterSpacing: "-0.02em" }}>{m.mine}</span>
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted }}>{m.unit}</span>
          </div>
        </div>
        <span style={{ padding: "4px 8px", borderRadius: 999, background: `${col}1f`, border: `1px solid ${col}55` }}>
          <Mono style={{ color: col, fontSize: 8.5 }}>{statusLabel(s, t)}</Mono>
        </span>
      </div>

      {/* progress bar */}
      <div style={{ position: "relative", height: 6, borderRadius: 999, background: C.surface3, marginBottom: 10, overflow: "visible" }}>
        {/* elite marker */}
        <div style={{ position: "absolute", left: "100%", top: -3, width: 2, height: 12, background: `${C.accent}80`, borderRadius: 1 }} />
        {/* top10 marker */}
        <div style={{ position: "absolute", left: `${pos(m.top10) * 100}%`, top: -2, width: 2, height: 10, background: `${C.text}55`, borderRadius: 1 }} />
        {/* team avg */}
        <div style={{ position: "absolute", left: `${pos(m.team) * 100}%`, top: -1, width: 1, height: 8, background: C.muted, borderRadius: 1 }} />
        {/* fill to mine */}
        <div style={{ width: `${pos(m.mine) * 100}%`, height: "100%", background: col, borderRadius: 999 }} />
        {/* my marker */}
        <div style={{ position: "absolute", top: -4, left: `${pos(m.mine) * 100}%`, transform: "translateX(-50%)", width: 14, height: 14, borderRadius: "50%", background: col, border: `2px solid ${C.bg}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
      </div>

      {/* legend */}
      <button onClick={() => setExpanded(o => !o)} style={{ display: "flex", width: "100%", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0, WebkitTapHighlightColor: "transparent" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {items.map(it => (
            <div key={it.label} style={{ textAlign: "center" }}>
              <Mono style={{ color: C.muted2, fontSize: 8 }}>{it.label}</Mono>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 12, color: it.col }}>{it.val}<span style={{ fontSize: 9, color: C.muted }}>{m.unit}</span></div>
            </div>
          ))}
        </div>
        <span style={{ color: C.muted, fontSize: 12, transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", alignSelf: "center" }}>›</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 9, paddingTop: 12, borderTop: `1px solid ${C.border}`, animation: "athlosFade 0.18s ease" }}>
          <Mono style={{ color: C.muted, fontSize: 8.5 }}>
            {m.lower
              ? `${t("Tvoj čas")} ${m.mine}${m.unit} ${t("je")} ${((m.mine - m.team) / m.team * 100).toFixed(1)}% ${t("hitrejši od ekipnega povprečja")} (${m.team}${m.unit}). ${t("Do TOP 10%")} ${t("manjka")} ${Math.abs(m.mine - m.top10).toFixed(2)}${m.unit}.`
              : `${t("Tvoj rezultat")} ${m.mine}${m.unit} ${t("presega ekipno povprečje")} (${m.team}${m.unit}) ${t("za")} ${((m.mine / m.team - 1) * 100).toFixed(0)}%. ${t("Do TOP 10%")} ${t("manjka")} ${Math.abs(m.mine - m.top10)}${m.unit}.`
            }
          </Mono>
        </div>
      )}
    </Card>
  );
}

export default function ScreenAssessment({ go, profile }) {
  const C = useTheme();
  const t = useT();
  const overall = Math.round(BENCHMARKS.reduce((sum, m) => sum + score(m, m.lower), 0) / BENCHMARKS.length);

  return (
    <div style={{ padding: "8px 13px 18px", color: C.text }}>
      <header style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <BackBtn onClick={() => go("report")} />
        <div>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.12em", display: "block", marginBottom: 3 }}>PERFORMANS</Mono>
          <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22.5, color: C.text, lineHeight: 1 }}>
            {t("Ocena")}
          </span>
        </div>
      </header>

      {/* overall score card */}
      <Card pad={18} style={{ marginBottom: 13, display: "flex", alignItems: "center", gap: 13 }}>
        <div style={{ width: 78, height: 78, borderRadius: "50%", border: `3px solid ${C.accent}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `${C.accent}0f`, flexShrink: 0 }}>
          <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 31.5, color: C.accent, lineHeight: 1 }}>{COACH_COMMENT.grade}</span>
        </div>
        <div style={{ flex: 1 }}>
          <Mono style={{ color: C.muted, fontSize: 9 }}>SKUPNA OCENA PERFORMANSA</Mono>
          <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 24.5, color: C.text, marginTop: 4 }}>
            {overall}<span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>/100</span>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
            {BENCHMARKS.map(m => {
              const s = score(m, m.lower);
              const col = statusColor(s, C);
              return <span key={m.id} style={{ width: 8, height: 8, borderRadius: "50%", background: col }} />;
            })}
            <Mono style={{ color: C.muted, fontSize: 8.5, marginLeft: 4 }}>{t("5 kazalnikov")}</Mono>
          </div>
        </div>
        <div>
          <Mono style={{ color: C.muted, fontSize: 8, textAlign: "right", display: "block" }}>{t("POZICIJA")}</Mono>
          <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 12, color: C.text, textAlign: "right" }}>{t(profile.sport || "Nogomet")}</div>
        </div>
      </Card>

      {/* benchmark cards */}
      <SectionLabel>{t("BENCHMARK PRIMERJAVA")}</SectionLabel>
      {BENCHMARKS.map(m => <BenchmarkCard key={m.id} m={m} C={C} t={t} />)}

      {/* coach comment */}
      <SectionLabel style={{ marginTop: 14 }}>{t("TRENERJEV KOMENTAR")}</SectionLabel>
      <Card pad={18} style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${C.accent}1f`, border: `1px solid ${C.accent}55`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.display, fontWeight: 800, color: C.accent, fontSize: 14, flexShrink: 0 }}>M</span>
          <div>
            <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text }}>{COACH_COMMENT.coach}</div>
            <Mono style={{ color: C.muted, fontSize: 8.5 }}>{COACH_COMMENT.date}</Mono>
          </div>
          <span style={{ marginLeft: "auto", padding: "3px 6px", borderRadius: 999, background: `${C.accent}1f`, border: `1px solid ${C.accent}40` }}>
            <Mono style={{ color: C.accent, fontSize: 8.5 }}>{COACH_COMMENT.grade}</Mono>
          </span>
        </div>
        <p style={{ margin: 0, color: C.text2, fontSize: 13, lineHeight: 1.6, fontFamily: C.display }}>{t(COACH_COMMENT.text)}</p>
      </Card>
    </div>
  );
}
