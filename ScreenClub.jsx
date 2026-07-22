import React, { useState } from "react";
import { useTheme } from "../theme";
import { Mono, Card, SectionLabel } from "../components/UI";
import { useT } from "../lib/i18n";
import InjuryWidget from "./widgets/InjuryWidget";
import { IcFlame, IcChat, IcChart, IcTrophy, IcBandage } from "../components/Icons";

// streak + wellness (last morning check-in, 1–5) per spec §04 — the coach sees
// who fills in the questionnaire regularly and the raw answers behind it.
const TEAM = [
  { ini: "LK", name: "Luka Kovač",      pos: "Napadalec",   battery: 82, injury: { name: "Hamstring gr. II", phase: 1, progressNote: "RICE protokol, izolirana aktivacija.", returnWeeks: 3, returnDate: "do 15. jul" }, days: [1, 1, 0, 1, 1, 0, 1], sprint: "1.76s", squat: "140 kg", streak: 12, wellness: { sleepQuality: 4, soreness: 3, stress: 2, mood: 4 } },
  { ini: "NM", name: "Nina Mlakar",      pos: "Vezna igra",  battery: 91, injury: null, days: [1, 1, 1, 0, 1, 1, 1], sprint: "1.81s", squat: "95 kg", streak: 34, wellness: { sleepQuality: 5, soreness: 1, stress: 1, mood: 5 } },
  { ini: "TŽ", name: "Tim Žagar",        pos: "Branilec",    battery: 65, injury: { name: "Bolečina v kolenu", phase: 2, progressNote: "Začetek re-load protokola.", returnWeeks: 2, returnDate: "do 10. jul" }, days: [1, 0, 0, 1, 0, 1, 1], sprint: "1.84s", squat: "128 kg", streak: 3, wellness: { sleepQuality: 3, soreness: 4, stress: 3, mood: 3 } },
  { ini: "EH", name: "Eva Horvat",       pos: "Vezna igra",  battery: 88, injury: null, days: [1, 1, 1, 1, 0, 1, 1], sprint: "1.79s", squat: "102 kg", streak: 21, wellness: { sleepQuality: 4, soreness: 2, stress: 2, mood: 4 } },
  { ini: "JN", name: "Jure Novak",       pos: "Vratar",      battery: 73, injury: null, days: [1, 1, 0, 0, 1, 1, 1], sprint: "1.91s", squat: "115 kg", streak: 7, wellness: { sleepQuality: 4, soreness: 2, stress: 3, mood: 3 } },
  { ini: "AK", name: "Ana Kos",          pos: "Branilec",    battery: 94, injury: null, days: [1, 1, 1, 1, 1, 0, 1], sprint: "1.74s", squat: "98 kg", streak: 45, wellness: { sleepQuality: 5, soreness: 1, stress: 2, mood: 5 } },
  { ini: "MP", name: "Marko Potočnik",   pos: "Napadalec",   battery: 56, injury: { name: "Zvit gleženj gr. I", phase: 0, progressNote: "Akutna faza — RICE.", returnWeeks: 1, returnDate: "za 1 teden" }, days: [0, 0, 0, 1, 0, 0, 0], sprint: "1.88s", squat: "122 kg", streak: 0, wellness: { sleepQuality: 2, soreness: 4, stress: 4, mood: 2 } },
];

const DAY_LABELS = ["P", "T", "S", "Č", "P", "S", "N"];

function BatteryBar({ pct, C }) {
  const col = pct >= 70 ? C.accent : pct >= 40 ? C.yellow : C.red;
  return (
    <div style={{ height: 4, borderRadius: 999, background: C.surface3, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 999, transition: "width 0.6s ease" }} />
    </div>
  );
}

function AthleteDetailSheet({ athlete, C, t, onClose, go }) {
  const batCol = athlete.battery >= 70 ? C.accent : athlete.battery >= 40 ? C.yellow : C.red;
  const lastTraining = [
    { name: "Squat", sets: 4, reps: 5, load: "120 kg" },
    { name: "Box jump", sets: 3, reps: 3, load: "60 cm" },
    { name: "Copenhagen plank", sets: 3, reps: "30s", load: "—" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 20, background: C.bg, display: "flex", flexDirection: "column", animation: "athlosFade 0.2s ease", overflowY: "auto" }}>
      {/* header */}
      <div style={{ padding: "9px 13px 10px", display: "flex", alignItems: "center", gap: 9, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: C.surface2, color: C.text, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>←</button>
        <span style={{ width: 42, height: 42, borderRadius: "50%", background: C.surface3, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.display, fontWeight: 700, color: C.text2, fontSize: 13.5, flexShrink: 0 }}>{athlete.ini}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 16, color: C.text, letterSpacing: "-0.01em" }}>{athlete.name}</div>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.08em" }}>{t(athlete.pos)}</Mono>
        </div>
        <button onClick={() => { onClose(); go("chat"); }} aria-label="Chat" style={{ padding: "8px 10px", borderRadius: 999, border: "none", background: C.surface2, color: C.text2, cursor: "pointer", WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center" }}><IcChat size={15} /></button>
      </div>

      <div style={{ flex: 1, padding: "16px 13px 20px" }}>
        {/* battery — dominant element */}
        <div style={{ marginBottom: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>{t("READINESS · BATERIJA")}</Mono>
            <Mono style={{ color: batCol, fontSize: 9, letterSpacing: "0.14em" }}>{athlete.battery >= 70 ? "READY" : athlete.battery >= 40 ? "CAUTION" : "REST"}</Mono>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 76, color: batCol, letterSpacing: "-0.04em", lineHeight: 0.95 }}>{athlete.battery}</span>
            <span style={{ fontFamily: C.mono, fontSize: 11.5, color: C.muted }}>/100</span>
          </div>
          <BatteryBar pct={athlete.battery} C={C} />
        </div>

        {/* metric tiles */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[["Sprint", athlete.sprint], ["Squat 1RM", athlete.squat]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: C.surface2, borderRadius: 16, padding: "10px 11px" }}>
              <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", display: "block" }}>{t(l.toUpperCase())}</Mono>
              <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 18, color: C.text, marginTop: 5, letterSpacing: "-0.01em" }}>{v}</div>
            </div>
          ))}
        </div>

        {/* injury */}
        {athlete.injury && (
          <div style={{ marginBottom: 16 }}>
            <InjuryWidget injury={athlete.injury} C={C} t={t} isCoach={true} />
          </div>
        )}

        {/* wellness check-in — streak + raw answers (spec §04, coach view) */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
            <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>{t("WELLNESS CHECK-IN")}</Mono>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: C.display, fontWeight: 800, fontSize: 15, color: athlete.streak > 0 ? C.text : C.muted2 }}>
              <span style={{ display: "flex", color: athlete.streak > 0 ? C.gold : C.muted2 }}><IcFlame size={14} /></span>
              {athlete.streak} <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.08em" }}>{t("DNI ZAPORED")}</Mono>
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["Spanje", athlete.wellness.sleepQuality, false], ["Bolečine", athlete.wellness.soreness, true], ["Stres", athlete.wellness.stress, true], ["Energija", athlete.wellness.mood, false]].map(([l, v, badHigh]) => {
              const good = badHigh ? v <= 2 : v >= 4;
              const bad = badHigh ? v >= 4 : v <= 2;
              const col = good ? C.accent : bad ? C.red : C.yellow;
              return (
                <div key={l} style={{ flex: 1, background: C.surface2, borderRadius: 16, padding: "10px 4px", textAlign: "center" }}>
                  <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, color: col, lineHeight: 1.1 }}>{v}<span style={{ fontSize: 10, fontWeight: 700, color: C.muted2 }}>/5</span></div>
                  <Mono style={{ color: C.muted, fontSize: 8, letterSpacing: "0.1em" }}>{t(l.toUpperCase())}</Mono>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7-day history */}
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>{t("ZADNJIH 7 DNI")}</SectionLabel>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 14, right: 14, top: 14, height: 1, background: C.border }} />
            <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
              {athlete.days.map((d, i) => {
                const col = d === 1 ? C.text2 : C.muted2;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: d === 1 ? C.surface3 : C.bg, border: `1px solid ${d === 1 ? C.border2 : C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {d === 1 && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                    </div>
                    <Mono style={{ color: col, fontSize: 8, letterSpacing: "0.1em" }}>{DAY_LABELS[i]}</Mono>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 11, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            {[[athlete.days.filter(d => d === 1).length, t("Treningov"), C.accent], [athlete.days.filter(d => d === 0).length, t("Počitek"), C.muted]].map(([v, l, col]) => (
              <div key={l}>
                <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 18, color: col }}>{v}</span>
                <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.08em", marginLeft: 5 }}>{l}</Mono>
              </div>
            ))}
          </div>
        </div>

        {/* last training */}
        <SectionLabel>{t("ZADNJI TRENING")}</SectionLabel>
        <div style={{ marginBottom: 18 }}>
          {lastTraining.map((ex, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < lastTraining.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <Mono style={{ width: 18, fontSize: 9, color: C.muted2, flexShrink: 0 }}>{i + 1}</Mono>
              <span style={{ flex: 1, fontFamily: C.display, fontWeight: 600, fontSize: 13.5, color: C.text }}>{t(ex.name)}</span>
              <Mono style={{ color: C.muted, fontSize: 9 }}>{ex.sets}×{ex.reps}</Mono>
              <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13, color: C.text2, marginLeft: 6, minWidth: 52, textAlign: "right" }}>{ex.load}</span>
            </div>
          ))}
        </div>

        {/* assessment CTA */}
        <button onClick={() => { onClose(); go("assessment"); }} style={{ width: "100%", padding: "11px", borderRadius: 999, border: "none", background: C.btn, color: C.btnText, fontFamily: C.display, fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: "0.04em", WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <IcChart size={15} /> {t("Performans ocena")}
        </button>
      </div>
    </div>
  );
}

export default function ScreenClub({ go, profile }) {
  const C = useTheme();
  const t = useT();
  const club = profile.club || "NK Domžale";
  const [detail, setDetail] = useState(null);

  // team aggregates — recomposed from the same TEAM data rendered below
  const avgBattery = Math.round(TEAM.reduce((s, m) => s + m.battery, 0) / TEAM.length);
  const avgCol = avgBattery >= 70 ? C.accent : avgBattery >= 40 ? C.yellow : C.red;
  const injuredCount = TEAM.filter(m => m.injury).length;
  const totalSessions = TEAM.reduce((s, m) => s + m.days.filter(d => d === 1).length, 0);
  const topStreak = Math.max(...TEAM.map(m => m.streak));

  return (
    <div style={{ padding: "8px 13px 18px", color: C.text }}>
      <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>ATHLETE OS</Mono>
      <h1 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 24, margin: "6px 0 16px", letterSpacing: "-0.02em" }}>{t("Klub")}</h1>

      {/* hero — club identity + team readiness summary */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: C.surface2, display: "flex", alignItems: "center", justifyContent: "center", color: C.text2, flexShrink: 0 }}><IcTrophy size={18} /></span>
          <div>
            <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 15.5, letterSpacing: "-0.01em" }}>{club}</div>
            <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.08em" }}>U17 · {TEAM.length} {t("članov")}</Mono>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>{t("READINESS · BATERIJA")}</Mono>
          <Mono style={{ color: avgCol, fontSize: 9, letterSpacing: "0.14em" }}>{avgBattery >= 70 ? "READY" : avgBattery >= 40 ? "CAUTION" : "REST"}</Mono>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 64, color: avgCol, letterSpacing: "-0.04em", lineHeight: 0.95 }}>{avgBattery}</span>
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.muted }}>/100</span>
        </div>
        <BatteryBar pct={avgBattery} C={C} />
        <div style={{ display: "flex", gap: 6, marginTop: 11 }}>
          <div style={{ flex: 1, background: C.surface2, borderRadius: 16, padding: "9px 10px" }}>
            <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, color: C.text, lineHeight: 1.1 }}>{totalSessions}</div>
            <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 4, display: "block" }}>{t("Treningov")}</Mono>
          </div>
          <div style={{ flex: 1, background: C.surface2, borderRadius: 16, padding: "9px 10px" }}>
            <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, color: injuredCount > 0 ? C.red : C.muted2, lineHeight: 1.1 }}>{injuredCount}</div>
            <span style={{ display: "flex", color: injuredCount > 0 ? C.red : C.muted2, marginTop: 5 }}><IcBandage size={12} /></span>
          </div>
          <div style={{ flex: 1, background: C.surface2, borderRadius: 16, padding: "9px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: C.display, fontWeight: 800, fontSize: 17, color: topStreak > 0 ? C.text : C.muted2, lineHeight: 1.1 }}>
              <span style={{ display: "flex", color: topStreak > 0 ? C.gold : C.muted2 }}><IcFlame size={13} /></span>
              {topStreak}
            </div>
            <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.16em", marginTop: 4, display: "block" }}>STREAK</Mono>
          </div>
        </div>
      </div>

      {/* coach */}
      <SectionLabel>{t("TRENER")}</SectionLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 2px 14px", marginBottom: 14 }}>
        <span style={{ width: 36, height: 36, borderRadius: "50%", background: C.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.display, fontWeight: 700, fontSize: 11.5, color: C.text2, flexShrink: 0 }}>M</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13.5 }}>Coach Matej</div>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.06em" }}>{t("Glavni trener")}</Mono>
        </div>
      </div>

      {/* team — roster rows as soft cards */}
      <SectionLabel>{t("EKIPA")}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {TEAM.map((member, i) => {
          const batCol = member.battery >= 70 ? C.accent : member.battery >= 40 ? C.yellow : C.red;
          return (
            <Card key={i} onClick={() => setDetail(member)} pad={14}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.surface3, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.display, fontWeight: 700, fontSize: 11.5, color: C.text2, flexShrink: 0 }}>{member.ini}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: C.display, fontWeight: 600, fontSize: 13.5, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{member.name}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.06em" }}>{t(member.pos)}</Mono>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <span style={{ display: "flex", color: member.streak > 0 ? C.gold : C.muted2 }}><IcFlame size={10} /></span>
                      <Mono style={{ color: member.streak > 0 ? C.muted : C.muted2, fontSize: 8.5, letterSpacing: "0.06em" }}>{member.streak}</Mono>
                    </span>
                    {member.injury && <span style={{ display: "flex", color: C.red }}><IcBandage size={11} /></span>}
                  </span>
                </span>
                <span style={{ textAlign: "right", minWidth: 44, flexShrink: 0 }}>
                  <span style={{ display: "block", fontFamily: C.display, fontWeight: 800, fontSize: 20, color: batCol, letterSpacing: "-0.02em", lineHeight: 1 }}>{member.battery}</span>
                  <Mono style={{ color: C.muted2, fontSize: 8, letterSpacing: "0.16em", marginTop: 2, display: "block" }}>BAT</Mono>
                </span>
                <span style={{ color: C.muted2, marginLeft: 2, flexShrink: 0 }}>›</span>
              </span>
            </Card>
          );
        })}
      </div>

      {detail && (
        <AthleteDetailSheet athlete={detail} C={C} t={t} onClose={() => setDetail(null)} go={go} />
      )}
    </div>
  );
}
