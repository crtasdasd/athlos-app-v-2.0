import React, { useState } from "react";
import { useTheme } from "../theme";
import { Mono, PrimaryBtn } from "../components/UI";
import RulerSlider from "../components/RulerSlider";
import { useT } from "../lib/i18n";

// ── ZEUS funnel ───────────────────────────────────────────────────────────────
// Click-based coaching onboarding that GATES the chat: ZEUS collects the training
// context (goal / level / season / equipment / days / duration / injuries) before
// you can talk to him. The answers seed the learning memory base (coach_memory).
// Visual language matches SetupFlow + the Hellenic theme (marble, Aegean blue, gold).

const STEPS = [
  { key: "goal", type: "single", q: "Kaj je tvoj glavni cilj?", sub: "ZA SMER TRENINGA",
    options: ["Moč", "Hitrost", "Eksplozivnost", "Vzdržljivost", "Rehabilitacija", "Splošna pripravljenost"] },
  { key: "level", type: "single", q: "Na kateri ravni treniraš?", sub: "DOLOČA OBSEG IN INTENZIVNOST",
    options: [
      { v: "Rekreativec", sub: "3–4× / teden" },
      { v: "Tekmovalec", sub: "klubska liga" },
      { v: "Polprofi", sub: "resne priprave" },
      { v: "Profesionalec", sub: "6+ / teden" },
    ] },
  { key: "seasonPhase", type: "single", q: "V kateri fazi sezone si?", sub: "VPLIVA NA PERIODIZACIJO",
    options: [
      { v: "Off-season", sub: "priprave, baza" },
      { v: "Predsezona", sub: "ostrenje forme" },
      { v: "V sezoni", sub: "tekme, vzdrževanje" },
    ] },
  { key: "equipment", type: "multi", q: "Kakšno opremo imaš?", sub: "IZBERI VSE, KAR IMAŠ NA VOLJO",
    options: ["Polna telovadnica", "Domača oprema", "Samo telesna teža", "Stadion + travnik", "Bazen"] },
  { key: "daysPerWeek", type: "single", q: "Koliko dni na teden treniraš?", sub: "REALNO, NE IDEALNO",
    options: [{ v: 3, label: "3 dni" }, { v: 4, label: "4 dni" }, { v: 5, label: "5 dni" }, { v: 6, label: "6 dni" }] },
  { key: "sessionMinutes", type: "slider", q: "Koliko časa imaš za trening?", sub: "POVPREČNO TRAJANJE TRENINGA",
    min: 30, max: 120, step: 5, options: [] },
  { key: "injuries", type: "multi", q: "Imaš kakšne poškodbe ali omejitve?", sub: "ZEUS SE JIM BO IZOGNIL", none: "Brez poškodb",
    options: ["Koleno", "Rama", "Spodnji hrbet", "Gleženj", "Komolec", "Kolk", "Zapestje", "Vrat"] },
];

const valOf = (o) => (typeof o === "object" ? o.v : o);
const labelOf = (o) => (typeof o === "object" ? (o.label || o.v) : o);
const subOf = (o) => (typeof o === "object" ? o.sub : null);

export default function ZeusFunnel({ onDone, profile }) {
  const C = useTheme();
  const t = useT();
  const [step, setStep] = useState(0);
  // the slider step starts at its default, so just pressing "Nadaljuj" commits 60
  const [answers, setAnswers] = useState({ sessionMinutes: 60 });

  // The signup onboarding (SetupFlow) already asked about goals, equipment
  // and injuries — never ask the same thing twice. A step is dropped when
  // the profile carries a real answer; finish() seeds the setup from it.
  //
  // Injuries are checked by SHAPE, not by length. "No injuries" is a real
  // answer that produces an empty array, so a `.length > 0` test read it as
  // "never asked" and made anyone healthy answer the same question twice.
  // The three states are distinguishable because only SetupFlow ever writes
  // this field and `loadProfile` maps the jsonb column back verbatim:
  //   undefined → never asked (legacy account, or setup predates the step)
  //   []        → asked, answered "Brez poškodb"
  //   [...]     → asked, answered with regions
  const answered = {
    goal: (profile?.goals || []).length > 0,
    equipment: (profile?.equipment || []).length > 0,
    injuries: Array.isArray(profile?.injuries) || !!(profile?.injuryNote || "").trim(),
  };
  const steps = STEPS.filter((s) => !answered[s.key]);
  const total = steps.length;
  const cur = steps[step];

  const advance = () => {
    if (step < total - 1) setStep((s) => s + 1);
    else finish();
  };
  const finish = () => {
    const setup = {
      goal: answers.goal || (profile?.goals || [])[0] || "",
      level: answers.level || "",
      seasonPhase: answers.seasonPhase || "",
      equipment: (answers.equipment?.length ? answers.equipment : profile?.equipment) || [],
      daysPerWeek: answers.daysPerWeek || null,
      sessionMinutes: answers.sessionMinutes || null,
      injuries: answers.injuries
        ? answers.injuries.filter((x) => x !== "Brez poškodb")
        : (profile?.injuries || []),
    };
    onDone(setup);
  };

  const pickSingle = (o) => {
    setAnswers((a) => ({ ...a, [cur.key]: valOf(o) }));
    setTimeout(advance, 190);
  };
  const toggleMulti = (o) => {
    const v = valOf(o);
    setAnswers((a) => {
      let arr = a[cur.key] || [];
      if (cur.none && v === cur.none) arr = arr.includes(v) ? [] : [v];
      else { arr = arr.filter((x) => x !== cur.none); arr = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }
      return { ...a, [cur.key]: arr };
    });
  };

  const opts = cur.type === "multi" && cur.none ? [...cur.options, cur.none] : cur.options;
  const selected = cur.type === "multi" ? (answers[cur.key] || []) : answers[cur.key];
  const isSel = (o) => (cur.type === "multi" ? selected.includes(valOf(o)) : selected === valOf(o));
  const multiOk = cur.type !== "multi" || (answers[cur.key] || []).length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      {/* progress */}
      <div style={{ padding: "11px 14px 0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {step > 0 && (
          <button onClick={() => setStep((s) => Math.max(0, s - 1))}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 24.5, cursor: "pointer", lineHeight: 1, padding: "2px 4px" }}>‹</button>
        )}
        <div style={{ flex: 1, height: 3, borderRadius: 999, background: C.surface3, overflow: "hidden" }}>
          <div style={{ width: `${((step + 1) / total) * 100}%`, height: "100%", background: C.accent, borderRadius: 999, transition: "width 0.35s cubic-bezier(.2,.8,.2,1)" }} />
        </div>
        <Mono style={{ color: C.muted, fontSize: 9 }}>{step + 1}/{total}</Mono>
      </div>

      {/* question */}
      <div key={step} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "15px 14px 9px", display: "flex", flexDirection: "column", animation: "athlosScreen 0.28s cubic-bezier(.2,.8,.2,1)" }}>
        <Mono style={{ color: C.accent, fontSize: 9 }}>{t(cur.sub)}</Mono>
        <h2 style={{ fontFamily: C.heading, fontWeight: 700, fontSize: 23, color: C.text, margin: "6px 0 15px", lineHeight: 1.12, letterSpacing: "0.01em" }}>{t(cur.q)}</h2>

        {cur.type === "slider" && (
          <div style={{ marginTop: 17 }}>
            <RulerSlider
              min={cur.min} max={cur.max} step={cur.step}
              value={answers[cur.key] ?? 60}
              onChange={(v) => setAnswers((a) => ({ ...a, [cur.key]: v }))}
              C={C}
              format={(v) => `${v} min`}
            />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: cur.type === "multi" || cur.options.length > 4 ? "repeat(2, minmax(0,1fr))" : "1fr", gap: 8 }}>
          {opts.map((o) => {
            const sel = isSel(o);
            return (
              <button
                key={String(valOf(o))}
                onClick={() => (cur.type === "multi" ? toggleMulti(o) : pickSingle(o))}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3,
                  padding: "11px 11px", borderRadius: 14, cursor: "pointer", textAlign: "left",
                  background: sel ? `${C.accent}14` : C.surface,
                  border: `1.5px solid ${sel ? C.accent : C.border}`,
                  boxShadow: sel ? `0 0 0 3px ${C.accent}1a` : "none",
                  color: C.text, fontFamily: C.display,
                  transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                  <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "0.01em" }}>{t(labelOf(o))}</span>
                  {sel && <span style={{ marginLeft: "auto", color: C.accent, fontWeight: 800 }}>✓</span>}
                </span>
                {subOf(o) && <span style={{ fontSize: 12, color: C.muted }}>{t(subOf(o))}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* footer — single steps auto-advance; multi/slider + last step need a button */}
      {(cur.type === "multi" || cur.type === "slider" || step === total - 1) && (
        <div style={{ flexShrink: 0, padding: "8px 14px 13px", background: `linear-gradient(to top, ${C.bg} 72%, transparent)` }}>
          <PrimaryBtn onClick={advance} disabled={!multiOk} style={{ opacity: multiOk ? 1 : 0.45 }}>
            {step === total - 1 ? t("Aktiviraj ZEUS") : t("Nadaljuj")}
          </PrimaryBtn>
        </div>
      )}
    </div>
  );
}
