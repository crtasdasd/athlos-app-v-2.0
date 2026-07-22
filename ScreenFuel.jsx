import React, { useState } from "react";
import { useTheme } from "../theme";
import { Pressable, PrimaryBtn, BackBtn, SectionLabel } from "../components/UI";
import { useT } from "../lib/i18n";

function calcTarget(goal) {
  let base = 2600;
  if (goal === "izguba") base -= 400;
  if (goal === "pridobitev") base += 400;
  return base;
}

function macroSplit(mass) {
  if (mass === "misice") return { p: 35, c: 45, f: 20 };
  if (mass === "mascoba") return { p: 25, c: 55, f: 20 };
  return { p: 30, c: 50, f: 20 };
}

function buildMealPlan(goal, mass) {
  const target = calcTarget(goal);
  const m = macroSplit(mass);
  const meals = [
    { name: "Zajtrk", pct: 0.25, desc: mass === "misice" ? "Ovsena kaša, jajca, skuta" : "Ovsena kaša, banana, oreščki" },
    { name: "Malica", pct: 0.15, desc: "Grški jogurt + banana + oreščki" },
    { name: "Kosilo", pct: 0.35, desc: mass === "misice" ? "Piščanec, riž, zelenjava" : "Losos, krompir, solata" },
    { name: "Po treningu", pct: 0.10, desc: "Proteinski shake + sadje" },
    { name: "Večerja", pct: 0.15, desc: "Puran/tofu, kvinoja, zelenjava" },
  ];
  return {
    target,
    macros: { p: Math.round((target * m.p / 100) / 4), c: Math.round((target * m.c / 100) / 4), f: Math.round((target * m.f / 100) / 9) },
    meals: meals.map((meal) => ({ ...meal, kcal: Math.round(target * meal.pct) })),
  };
}

const GOAL_LABEL = { izguba: "Izguba teže", vzdrzevanje: "Vzdrževanje", pridobitev: "Pridobitev teže" };
const MASS_LABEL = { mascoba: "Energija / volumen", misice: "Mišična masa" };

// Protein carries the single brand-green accent; carbs + fat read as two
// quiet neutral tones so the split stays legible without decorative hues.
const macroColors = (C) => ({
  p: C.accent,
  c: C.text2,
  f: C.muted,
});

function MacroPie({ macros, eaten, target }) {
  const C = useTheme();
  const t = useT();
  const MC = macroColors(C);
  const r = 42, sw = 9, cx = 52, cy = 52;
  const circ = 2 * Math.PI * r;

  const totalCal = macros.p * 4 + macros.c * 4 + macros.f * 9;
  const pLen = (macros.p * 4 / totalCal) * circ;
  const cLen = (macros.c * 4 / totalCal) * circ;
  const fLen = (macros.f * 9 / totalCal) * circ;
  const gap = 3;

  const pct = Math.min(100, Math.round((eaten / target) * 100));

  // Same math as before (r/sw/cx/cy retained), flattened from a ring into a
  // slim horizontal split-strip: segment widths = pLen/cLen/fLen fractions.
  void sw; void cx; void cy;
  return (
    <div style={{ marginTop: 13 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: C.mono, fontWeight: 600, fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>{t("ZAUŽITO")}</span>
        <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 13.5, color: C.text, lineHeight: 1, letterSpacing: "-0.01em" }}>{pct}%</span>
      </div>
      <div style={{ display: "flex", gap, height: 5 }}>
        <div style={{ width: `${(Math.max(0, pLen - gap) / circ) * 100}%`, borderRadius: 999, background: MC.p, transition: "width 0.8s cubic-bezier(.2,.8,.2,1)" }} />
        <div style={{ width: `${(Math.max(0, cLen - gap) / circ) * 100}%`, borderRadius: 999, background: MC.c, transition: "width 0.8s cubic-bezier(.2,.8,.2,1)" }} />
        <div style={{ width: `${(Math.max(0, fLen - gap) / circ) * 100}%`, borderRadius: 999, background: MC.f, transition: "width 0.8s cubic-bezier(.2,.8,.2,1)" }} />
      </div>
    </div>
  );
}

function MacroMini({ label, v, color }) {
  const C = useTheme();
  // Floating tile: surface2, radius 16, borderless.
  return (
    <div style={{ flex: 1, minWidth: 0, background: C.surface2, borderRadius: 16, padding: "9px 10px", boxSizing: "border-box" }}>
      <div style={{ width: 18, height: 3, borderRadius: 999, background: color, marginBottom: 8 }} />
      <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, color: C.text, lineHeight: 1, letterSpacing: "-0.02em" }}>{v}<span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>g</span></div>
      <span style={{ fontFamily: C.mono, fontWeight: 600, fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, display: "block", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </div>
  );
}

function EatenForm({ onAdd }) {
  const C = useTheme();
  const t = useT();
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const submit = () => {
    const k = parseInt(kcal, 10);
    if (!name.trim() || !k || k <= 0) return;
    onAdd({ name: name.trim(), kcal: k });
    setName(""); setKcal("");
  };
  const inp = { padding: "9px 10px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontFamily: C.display, fontWeight: 600, fontSize: 14, outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", gap: 6, margin: "8px 0 9px" }}>
      <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={t("npr. Sendvič")} style={{ ...inp, flex: 1 }} />
      <input value={kcal} onChange={(e) => setKcal(e.target.value.replace(/[^0-9]/g, ""))} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="kcal" inputMode="numeric" style={{ ...inp, width: 70, textAlign: "center" }} />
      <Pressable onClick={submit} scale={0.9} style={{ width: 48, borderRadius: 12, border: "none", background: C.btn, color: C.btnText, fontWeight: 800, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</Pressable>
    </div>
  );
}

export default function ScreenFuel({ go }) {
  const C = useTheme();
  const t = useT();
  const [goal, setGoal] = useState("vzdrzevanje");
  const [mass, setMass] = useState("misice");
  const [plan, setPlan] = useState(() => buildMealPlan("vzdrzevanje", "misice"));
  const [eaten, setEaten] = useState([]);
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const eatenTotal = eaten.reduce((s, e) => s + e.kcal, 0);
  const remaining = Math.max(0, plan.target - eatenTotal);
  const generate = () => {
    setLoading(true);
    setTimeout(() => {
      setPlan(buildMealPlan(goal, mass));
      setShowSetup(false);
      setLoading(false);
    }, 900);
  };
  const label = { fontFamily: C.mono, fontWeight: 600, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, display: "block" };
  const MC = macroColors(C);

  // Presentation only: which plan meal is "up next" given what's been eaten.
  let mealAcc = 0;
  const nextMealIdx = plan.meals.findIndex((m) => { mealAcc += m.kcal; return eatenTotal < mealAcc; });

  const segBtn = (active) => ({ flex: 1, padding: "6px 4px", borderRadius: 999, border: "none", background: active ? `${C.accent}16` : "transparent", color: active ? C.accent : C.muted, fontFamily: C.display, fontSize: 11, textTransform: "lowercase", cursor: "pointer", fontWeight: active ? 700 : 500 });

  return (
    <div style={{ padding: "9px 14px 20px", color: C.text }}>
      <header style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 4 }}>
        <BackBtn onClick={() => go?.("today")} />
        <div>
          <span style={label}>{t("HRANA")}</span>
          <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 24, margin: "4px 0 0", color: C.text, letterSpacing: "-0.02em" }}>{t("Tvoj jedilnik")}</h2>
        </div>
      </header>

      {/* HERO — pure typography, no card */}
      <section style={{ marginBottom: 18 }}>
        <span style={label}>{t("ŠE NA VOLJO DANES")}</span>
        <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 52, color: C.text, lineHeight: 1, letterSpacing: "-0.04em", marginTop: 6 }}>
          {remaining}<span style={{ fontSize: 13.5, color: C.muted, fontWeight: 600, letterSpacing: 0, marginLeft: 7 }}>kcal</span>
        </div>
        <MacroPie macros={plan.macros} eaten={eatenTotal} target={plan.target} />
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <MacroMini label={t("Proteini")} v={plan.macros.p} color={MC.p} />
          <MacroMini label={t("Ogljikohidrati")} v={plan.macros.c} color={MC.c} />
          <MacroMini label={t("Maščobe")} v={plan.macros.f} color={MC.f} />
        </div>
      </section>

      {/* Current plan readout + AI toggle in one quiet row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, marginBottom: showSetup ? 16 : 28 }}>
        <span style={{ fontFamily: C.mono, fontWeight: 600, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t(GOAL_LABEL[goal])} · {t(MASS_LABEL[mass])} · {plan.target} KCAL
        </span>
        <Pressable onClick={() => setShowSetup((v) => !v)} scale={0.97} style={{ padding: "8px 11px", borderRadius: 999, border: "none", background: showSetup ? C.surface3 : C.surface2, color: C.text, fontFamily: C.display, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
          {t("AI Sestavi jedilnik")}
        </Pressable>
      </div>

      {showSetup && (
        <div style={{ marginBottom: 18, animation: "athlosFade 0.2s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ ...label, width: 46, flexShrink: 0 }}>{t("CILJ")}</span>
            {["izguba", "vzdrzevanje", "pridobitev"].map((g) => (
              <button key={g} onClick={() => setGoal(g)} style={segBtn(goal === g)}>{t(GOAL_LABEL[g]).split(" ")[0]}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
            <span style={{ ...label, width: 46, flexShrink: 0 }}>{t("FOKUS")}</span>
            {["mascoba", "misice"].map((mm) => (
              <button key={mm} onClick={() => setMass(mm)} style={segBtn(mass === mm)}>{t(MASS_LABEL[mm])}</button>
            ))}
          </div>
          <PrimaryBtn onClick={generate}>{loading ? t("Sestavljam...") : t("Sestavi jedilnik")}</PrimaryBtn>
        </div>
      )}

      {/* MEAL PLAN — vertical timeline */}
      <SectionLabel>{t("NAČRT OBROKOV")}</SectionLabel>
      <div style={{ position: "relative", paddingLeft: 22 }}>
        <div style={{ position: "absolute", left: 3.5, top: 10, bottom: 10, width: 1, background: C.border }} />
        {plan.meals.map((meal, i) => {
          const isNext = i === nextMealIdx;
          return (
            <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: isNext ? "13px 14px" : "11px 0", background: isNext ? C.surface2 : "transparent", borderRadius: isNext ? 20 : 0, margin: isNext ? "4px 0 4px -14px" : 0 }}>
              <div style={{ position: "absolute", left: isNext ? -8 : -22, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: isNext ? C.text : C.surface3, boxShadow: `0 0 0 3px ${C.bg}` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13.5, color: C.text }}>{t(meal.name)}</span>
                  <span style={{ fontFamily: C.mono, fontWeight: 600, fontSize: 8.5, letterSpacing: "0.08em", color: C.muted2 }}>{Math.round(meal.pct * 100)}%</span>
                </div>
                <div style={{ fontFamily: C.display, fontWeight: 400, fontSize: 11.5, color: C.muted, marginTop: 3 }}>{t(meal.desc)}</div>
              </div>
              <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 14, color: C.text, letterSpacing: "-0.01em", flexShrink: 0 }}>{meal.kcal}<span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}> kcal</span></div>
            </div>
          );
        })}
      </div>

      {/* EATEN LOG — hairline rows */}
      <div style={{ marginTop: 20 }}>
        <SectionLabel>{t("KAJ SEM DANES POJEDEL")}</SectionLabel>
        <EatenForm onAdd={(item) => setEaten((e) => [...e, { ...item, id: Date.now() }])} />
        {eaten.length === 0 && <span style={{ fontFamily: C.display, fontWeight: 400, fontSize: 12, color: C.muted2 }}>{t("Vpiši obrok zgoraj — kalorije se odštejejo avtomatsko.")}</span>}
        {eaten.length > 0 && (
          <div>
            {eaten.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, minWidth: 0, fontFamily: C.display, fontWeight: 500, fontSize: 13, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 14, color: C.text, letterSpacing: "-0.01em", textAlign: "right" }}>{e.kcal}<span style={{ fontSize: 9.5, color: C.muted, fontWeight: 600 }}> kcal</span></div>
                <button onClick={() => setEaten((list) => list.filter((x) => x.id !== e.id))} style={{ background: "none", border: "none", color: C.muted2, fontSize: 15.5, cursor: "pointer", padding: 4 }}>×</button>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "11px 0" }}>
              <span style={{ ...label, display: "inline" }}>{t("skupaj danes")}</span>
              <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 18, color: C.text, letterSpacing: "-0.02em" }}>{eatenTotal} <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>kcal</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
