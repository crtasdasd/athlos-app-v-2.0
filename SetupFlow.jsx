import React, { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { useTheme } from "../theme";
import { useLang, useT } from "../lib/i18n";
import { SPORTS } from "./ScreenProfile";
import WheelColumn from "../components/WheelPicker";
import WheelPicker from "../components/WheelPickerModal";
import { isNameTaken } from "../lib/api";
import { isNameAllowed } from "../lib/moderation";

// ─────────────────────────────────────────────────────────────
// INITIAL ASSESSMENT
//
// The first real interaction with ATHLOS, so it is built as an
// *experience*, not a form:
//
//  · Layers, not containers. Hierarchy comes from type scale, spacing
//    and contrast — there is exactly one bordered element in the whole
//    flow (none), and no cards. Selected answers are expressed with a
//    directional wash + a 2px left marker that grows in, full-bleed
//    past the page gutter, so a list reads as a surface, not a stack
//    of boxes.
//  · One fixed action footer for every step. The CTA never moves
//    between questions — the single biggest perceived-polish and
//    completion-rate win in a 12-step flow.
//  · Progress is narrated, not counted. The flow is grouped into three
//    named chapters and the eyebrow above each question says what the
//    system is currently doing ("Ustvarjam tvoj profil"), so the user
//    is building a profile rather than clearing a queue.
//  · Green is spent only on the CTA, the progress fill and the
//    selection marker. Everything else is greyscale and space.
//
// Questions, order, validation and the shape passed to onDone() are
// unchanged from the original flow.
// ─────────────────────────────────────────────────────────────

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const MONTHS_SL_FULL = ["Januar","Februar","Marec","April","Maj","Junij","Julij","Avgust","September","Oktober","November","December"];
const MONTHS_EN_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// A birth date is accepted only if it's a REAL calendar date in a sane range
// (1940 … min-age 10). The picker can't produce anything else, but this also
// guards restored localStorage state and any future input path — 42. 25. 1001
// can never reach the profile.
function validBirth(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  // JS rolls invalid dates over (32. 1. → 1. 2.) — reject anything that moved
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
  const max = new Date();
  max.setFullYear(max.getFullYear() - 10);
  return y >= 1940 && dt <= max;
}

const FLOW = ["name", "acq", "birth", "gender", "body", "waist", "quote", "sport", "goals", "exp", "injuries", "equipment", "test"];

// The flow is narrated in three chapters. `line` is what the system claims to
// be doing while the user is inside that chapter — shown as the eyebrow above
// every question, so progress reads as construction rather than a countdown.
const CHAPTERS = [
  { id: "who",   line: "Ustvarjam tvoj profil",  steps: ["name", "acq", "birth", "gender"] },
  { id: "body",  line: "Merim tvojo osnovo",     steps: ["body", "waist"] },
  { id: "train", line: "Spoznavam tvoj trening", steps: ["sport", "goals", "exp", "injuries", "equipment"] },
];
const chapterOf = (k) => CHAPTERS.find((c) => c.steps.includes(k));

const ACQ_OPTIONS = ["Instagram", "Prijatelj / soigralec", "Google", "TikTok", "Trener / klub", "Drugo"];
const GOAL_OPTIONS = ["Moč", "Mišična masa", "Eksplozivnost", "Hitrost", "Vzdržljivost", "Izguba maščobe", "Preventiva poškodb", "Splošna kondicija"];
const EQUIPMENT_OPTIONS = ["Fitnes klub", "Domače uteži / ročke", "Drog za zgibe", "Elastike", "Samo lastna teža"];

const SETUP_KEY = "athlos:setup";
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(SETUP_KEY) || "{}"); } catch { return {}; } };

// Best-effort mapping from the free-text injury description to the known body
// regions the offline coach avoids when picking exercises (coachOffline.js
// pool `area` tags) — a word-boundary match on the Slovenian stem so e.g.
// "bolečina v kolenu" still flags "Koleno" without over-matching substrings.
const INJURY_STEMS = { Koleno: "kolen", Gleženj: "gležn", Rama: "\\bram", Hrbet: "hrbt", Kolk: "\\bkolk", Hamstring: "hamstring", Zapestje: "zapest" };
function guessInjuryAreas(text) {
  const s = String(text || "").toLowerCase();
  return Object.entries(INJURY_STEMS)
    .filter(([, stem]) => new RegExp(stem.startsWith("\\b") ? stem : `\\b${stem}`, "i").test(s))
    .map(([region]) => region);
}

// Downscale to ≤512px JPEG data URL — same ceiling as the profile-photo
// upload (ScreenSettings), kept local-only here since onboarding runs before
// there's necessarily an authenticated account to upload to.
const compressToDataUrl = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    const max = 512;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    resolve(canvas.toDataURL("image/jpeg", 0.85));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
  img.src = url;
});

// GSAP drives the flow's motion; a single guard keeps it off for users who
// asked the OS for reduced motion.
const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// Answering something is the one moment that earns physical feedback. A short
// tick, never a buzz — the flow is calm, not gamified.
const tick = () => { try { navigator.vibrate?.(7); } catch {} };

const Check = ({ color, size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 12.5l5 5L20 6.5" />
  </svg>
);

// ── Eyebrow — the narration line. Mono, wide-tracked, quiet, with one
// small accent tick so it reads as system output rather than a label. ──
function Eyebrow({ children, C, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: 1, background: color || C.accent, flexShrink: 0 }} />
      <span style={{
        fontFamily: C.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.2em",
        textTransform: "uppercase", color: color || C.muted,
      }}>{children}</span>
    </span>
  );
}

// ── Question head — eyebrow · question · supporting line. The only place
// in the flow allowed to set large type, and the reason no step needs a
// container: the scale jump from 9.5px mono to 30px display IS the
// hierarchy. ──
function Head({ eyebrow, title, sub, C, light }) {
  return (
    <div style={{ marginBottom: 26 }}>
      {eyebrow && <div style={{ marginBottom: 14 }}><Eyebrow C={C} color={light ? "rgba(255,255,255,0.72)" : undefined}>{eyebrow}</Eyebrow></div>}
      <h2 style={{
        margin: 0, fontFamily: C.display, fontWeight: 600, fontSize: 30,
        lineHeight: 1.14, letterSpacing: "-0.032em",
        color: light ? "#FFFFFF" : C.text, maxWidth: "17ch",
      }}>{title}</h2>
      {sub && (
        <p style={{
          margin: "12px 0 0", fontFamily: C.display, fontWeight: 400, fontSize: 14.5,
          lineHeight: 1.5, letterSpacing: "-0.005em",
          color: light ? "rgba(255,255,255,0.72)" : C.muted, maxWidth: "31ch",
        }}>{sub}</p>
      )}
    </div>
  );
}

// ── Underline field — no box, no fill. A hairline baseline that draws
// itself in accent on focus. Large type does the work a container would. ──
function Field({ value, onChange, placeholder, invalid, size = 21, multiline, rows, C, ...rest }) {
  const [focus, setFocus] = useState(false);
  const dark = C.name === "dark";
  const shared = {
    width: "100%", background: "transparent", border: "none", outline: "none",
    color: C.text, fontFamily: C.display, letterSpacing: "-0.015em",
    padding: "4px 0 13px", boxSizing: "border-box", caretColor: C.accent,
    resize: "none", display: "block",
  };
  const lit = focus || invalid || String(value ?? "").length > 0;
  return (
    <div style={{ position: "relative" }}>
      {multiline ? (
        <textarea
          value={value} onChange={onChange} placeholder={placeholder} rows={rows || 3}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ ...shared, fontWeight: 500, fontSize: 15.5, lineHeight: 1.55 }} {...rest}
        />
      ) : (
        <input
          value={value} onChange={onChange} placeholder={placeholder}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ ...shared, fontWeight: 600, fontSize: size }} {...rest}
        />
      )}
      <span aria-hidden="true" style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 1,
        background: dark ? "rgba(255,255,255,0.13)" : "rgba(16,24,40,0.14)",
      }} />
      <span aria-hidden="true" style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 1.5, borderRadius: 1,
        background: invalid ? C.red : C.accent,
        transformOrigin: "left center", transform: `scaleX(${lit ? 1 : 0})`,
        transition: `transform 0.36s ${EASE}, background 0.2s ease`,
      }} />
    </div>
  );
}

// ── Answer row — the flow's single answer primitive.
//
// At rest it is nothing but text on the canvas, separated from its
// neighbour by a hairline. Selected, it gains a directional wash that
// bleeds past the page gutter and a 2px marker that grows out of the left
// edge. No border, no card, no fill-box — the selection is a *layer*
// laid under the row, which is what makes a list of these read as one
// crafted surface instead of six stacked buttons.
// ──
function AnswerRow({ label, sub, icon, active, multi, first, onClick, C }) {
  const [pressed, setPressed] = useState(false);
  const dark = C.name === "dark";
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 14,
        // full-bleed: the wash runs edge to edge, the content stays on the grid
        width: "calc(100% + 40px)", marginLeft: -20, padding: "0 20px",
        minHeight: 62, textAlign: "left", border: "none", cursor: "pointer",
        borderTop: first ? "1px solid transparent" : `1px solid ${dark ? "rgba(255,255,255,0.058)" : "rgba(16,24,40,0.07)"}`,
        background: active
          ? `linear-gradient(90deg, ${C.accent}17, ${C.accent}08 52%, ${C.accent}00)`
          : "transparent",
        transform: pressed ? "scale(0.994)" : "none",
        transition: `background 0.32s ${EASE}, transform 0.2s ease`,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", left: 0, top: 11, bottom: 11, width: 2, borderRadius: 2,
        background: C.accent, opacity: active ? 1 : 0,
        transform: `scaleY(${active ? 1 : 0.2})`,
        transition: `transform 0.34s ${EASE}, opacity 0.22s ease`,
      }} />

      {icon && (
        <span style={{
          width: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          opacity: active ? 1 : 0.62, transition: "opacity 0.28s ease",
        }}>{icon}</span>
      )}

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "block", fontFamily: C.display, fontSize: 16.5,
          fontWeight: active ? 600 : 500, letterSpacing: "-0.015em",
          color: active ? C.text : C.text2,
          transition: "color 0.28s ease",
        }}>{label}</span>
        {sub && (
          <span style={{ display: "block", fontFamily: C.display, fontSize: 12.5, fontWeight: 400, color: C.muted, marginTop: 3 }}>{sub}</span>
        )}
      </span>

      {multi ? (
        <span aria-hidden="true" style={{
          width: 21, height: 21, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: active ? C.accent : "transparent",
          boxShadow: `inset 0 0 0 1.5px ${active ? C.accent : (dark ? "rgba(255,255,255,0.19)" : "rgba(16,24,40,0.19)")}`,
          transition: `background 0.26s ease, box-shadow 0.26s ease`,
        }}>
          <span style={{ opacity: active ? 1 : 0, transform: active ? "scale(1)" : "scale(0.6)", transition: `opacity 0.2s ease, transform 0.3s ${EASE}`, display: "flex" }}>
            <Check color={C.btnText} size={11} />
          </span>
        </span>
      ) : (
        <span aria-hidden="true" style={{
          width: 16, flexShrink: 0, display: "flex", justifyContent: "flex-end",
          opacity: active ? 1 : 0, transform: active ? "scale(1)" : "scale(0.62)",
          transition: `opacity 0.22s ease, transform 0.34s ${EASE}`,
        }}>
          <Check color={C.accent} size={15} />
        </span>
      )}
    </button>
  );
}

// ── The CTA.
//
// 54px tall, 16px radius, one weight heavier than the body text and one
// notch tighter. Depth comes from a 1px inner top highlight and a tight
// contact shadow, not from a gradient or a halo. Disabled is a *quiet
// surface*, not a faded green — a translucent green button reads broken,
// a grey one reads "not yet", which is the honest message.
// ──
function ContinueBtn({ children, onClick, disabled, C, style }) {
  const [pressed, setPressed] = useState(false);
  const dark = C.name === "dark";
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: "100%", height: 54, borderRadius: 16, border: "none",
        fontFamily: C.display, fontSize: 16.5, fontWeight: 600, letterSpacing: "-0.015em",
        cursor: disabled ? "default" : "pointer",
        background: disabled ? (dark ? "rgba(255,255,255,0.055)" : "rgba(16,24,40,0.05)") : C.accent,
        color: disabled ? C.muted2 : C.btnText,
        boxShadow: disabled
          ? "none"
          : pressed
            ? `inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.35)`
            : `inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 3px rgba(0,0,0,0.28), 0 10px 26px ${C.accent}1f`,
        transform: pressed ? "scale(0.985)" : "none",
        filter: pressed ? "brightness(0.94)" : "none",
        transition: `transform 0.28s ${EASE}, background 0.34s ease, color 0.34s ease, box-shadow 0.3s ease, filter 0.2s ease`,
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Body-composition dial. Kept (it is the flow's one moment of instant
// payback — the user gives two numbers and immediately gets a reading
// back), but stripped to an arc, a number and a word. ──
const BMI_BANDS = [
  { max: 18.5, label: "Podhranjenost" },
  { max: 25,   label: "Optimalno" },
  { max: 30,   label: "Povečana teža" },
  { max: 999,  label: "Debelost" },
];
function BmiDial({ height, weight, C, t }) {
  const bmi = weight / Math.pow(height / 100, 2);
  const p = Math.max(0, Math.min(1, (bmi - 15) / (40 - 15)));
  const r = 78, cx = 100, cy = 96;
  const semi = Math.PI * r;
  const dark = C.name === "dark";
  const band = BMI_BANDS.find((b) => bmi < b.max) || BMI_BANDS[3];
  return (
    <div style={{ position: "relative", margin: "0 auto", maxWidth: 264, width: "100%" }}>
      <svg viewBox="0 0 200 108" width="100%" style={{ display: "block", overflow: "visible" }}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none"
          stroke={dark ? "rgba(255,255,255,0.09)" : "rgba(16,24,40,0.09)"} strokeWidth="2" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none"
          stroke={C.text} strokeWidth="2" strokeLinecap="round"
          strokeDasharray={semi} strokeDashoffset={semi * (1 - p)}
          style={{ transition: `stroke-dashoffset 0.55s ${EASE}` }} />
        <circle cx={cx + Math.cos(Math.PI * (1 - p)) * r} cy={cy - Math.sin(Math.PI * (1 - p)) * r} r="4.5"
          fill={C.accent} style={{ transition: `all 0.55s ${EASE}` }} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 6, textAlign: "center", pointerEvents: "none" }}>
        <div style={{ fontFamily: C.display, fontWeight: 600, fontSize: 34, letterSpacing: "-0.035em", color: C.text, lineHeight: 1 }}>
          {(Math.round(bmi * 10) / 10).toFixed(1)}
        </div>
        <div style={{ marginTop: 7, fontFamily: C.mono, fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted }}>
          {t("ITM")} · {t(band.label)}
        </div>
      </div>
    </div>
  );
}

// ── Inline birth wheels. The selection band is a quiet inset surface with
// the picked values in accent — the loud full-width green bar is gone, so
// green stays reserved for the CTA and the progress fill. ──
function BirthWheelInline({ value, onChange, C, lang }) {
  const months = lang === "en" ? MONTHS_EN_FULL : MONTHS_SL_FULL;
  const maxD = new Date();
  maxD.setFullYear(maxD.getFullYear() - 10); // min age 10
  const init = value && validBirth(value) ? new Date(value) : new Date(2005, 5, 15);

  const startY = 1940;
  const endY = maxD.getFullYear();
  const years = Array.from({ length: endY - startY + 1 }, (_, i) => startY + i);
  const monthIdxs = Array.from({ length: 12 }, (_, i) => i);

  const [day, setDay] = useState(init.getDate());
  const [month, setMonth] = useState(init.getMonth());
  const [year, setYear] = useState(Math.min(init.getFullYear(), endY));

  const dim = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  // clamp to real dates and to the min-age ceiling
  useEffect(() => { if (day > dim) setDay(dim); }, [dim]); // eslint-disable-line
  useEffect(() => { if (year === endY && month > maxD.getMonth()) setMonth(maxD.getMonth()); }, [year]); // eslint-disable-line
  useEffect(() => { if (year === endY && month === maxD.getMonth() && day > maxD.getDate()) setDay(maxD.getDate()); }, [year, month]); // eslint-disable-line

  useEffect(() => {
    onChange(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }, [day, month, year]); // eslint-disable-line

  const dark = C.name === "dark";
  return (
    <div style={{ position: "relative", margin: "0 -20px" }}>
      {/* selection band — 7-row window (pad 3 × 40px), so row 4 starts at 120 */}
      <div aria-hidden="true" style={{
        position: "absolute", top: 120, left: 14, right: 14, height: 40, borderRadius: 12,
        background: dark ? "rgba(255,255,255,0.055)" : "rgba(16,24,40,0.045)", zIndex: 0,
      }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", padding: "0 22px" }}>
        <WheelColumn items={monthIdxs} value={month} onChange={setMonth} width="46%" C={C} render={(m) => months[m]} align="left" showBand={false} activeColor={C.accent} pad={3} />
        <WheelColumn items={days} value={day} onChange={setDay} width="18%" C={C} align="center" showBand={false} activeColor={C.accent} pad={3} />
        <WheelColumn items={years} value={year} onChange={setYear} width="36%" C={C} align="right" showBand={false} activeColor={C.accent} pad={3} />
      </div>
    </div>
  );
}

// Slovenian year plurals — "1 leto / 2 leti / 3 leta / 5 let". A small thing,
// but the flow loses all of its credibility the moment it says "3 let".
const yearsWordSl = (n) => {
  const t2 = n % 100, t1 = n % 10;
  if (t2 >= 11 && t2 <= 14) return "let";
  if (t1 === 1) return "leto";
  if (t1 === 2) return "leti";
  if (t1 === 3 || t1 === 4) return "leta";
  return "let";
};

export default function SetupFlow({ profile, setProfile, onDone, onBack }) {
  const C = useTheme();
  const saved = useRef(loadSaved()).current;
  const [step, setStep] = useState(() => Math.min(saved.step || 0, FLOW.length - 1));
  const [username, setUsername] = useState(saved.username || "");
  const [nameMsg, setNameMsg] = useState("");
  const [checkingName, setCheckingName] = useState(false);
  const [acquisition, setAcquisition] = useState(saved.acquisition || "");
  const [birth, setBirth] = useState(validBirth(saved.birth) ? saved.birth : "");
  const [gender, setGender] = useState(saved.gender || "");
  const [height, setHeight] = useState(saved.height || 175);
  const [weight, setWeight] = useState(saved.weight || 70);
  // Whether the athlete has actually picked a value yet — 175/70 are sane
  // defaults for the BMI preview, but the row should read "Tapni za izbiro"
  // rather than presenting an unchosen default as if it were their answer.
  const [heightSet, setHeightSet] = useState(!!saved.height);
  const [weightSet, setWeightSet] = useState(!!saved.weight);
  const [openPicker, setOpenPicker] = useState(null); // "height" | "weight" | null
  const [waist, setWaist] = useState(saved.waist || "");
  const [bodyFat, setBodyFat] = useState(saved.bodyFat || "");
  const [sport, setSport] = useState(saved.sport || "");
  const [customSport, setCustomSport] = useState(saved.customSport || "");
  const [goals, setGoals] = useState(saved.goals || []);
  const [customGoal, setCustomGoal] = useState(saved.customGoal || "");
  // Free-typed years of experience — kept as a string while editing (like
  // waist/bodyFat below) so the field can be cleared and retyped normally;
  // parsed to a number only in finish().
  const [experience, setExperience] = useState(() => {
    const n = parseInt(saved.experience, 10);   // old wheel value / string presets ("1–3 let") → number
    return Number.isFinite(n) ? String(n) : "3";
  });
  const [injuries, setInjuries] = useState(saved.injuries || []);
  const [injuryNote, setInjuryNote] = useState(saved.injuryNote || "");
  const [hasInjury, setHasInjury] = useState(saved.hasInjury ?? (saved.injuryNote ? true : null));
  const [injuryPhoto, setInjuryPhoto] = useState(saved.injuryPhoto || "");
  const [equipment, setEquipment] = useState(saved.equipment || []);
  const scrollRef = useRef(null);
  const rootRef = useRef(null);
  const injuryFileRef = useRef(null);
  const t = useT();
  const lang = useLang();

  // Persist every answer + the current step so the flow resumes where the
  // user left off (spec §01, "predlog za interakcijo").
  useEffect(() => {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify({
        step, username, acquisition, birth, gender, height, weight, waist, bodyFat,
        sport, customSport, goals, customGoal, experience, injuries, injuryNote, hasInjury, injuryPhoto, equipment,
      }));
    } catch {}
  }, [step, username, acquisition, birth, gender, height, weight, waist, bodyFat, sport, customSport, goals, customGoal, experience, injuries, injuryNote, hasInjury, injuryPhoto, equipment]);

  // Reset scroll to top on every step change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [step]);

  const total = FLOW.length;
  const key = FLOW[step];

  // Direction of the last navigation: +1 forward, -1 back. Read by the
  // entrance effect so a step always enters from the side it travelled from.
  const dirRef = useRef(1);

  // Step entrance — the head, then each answer row, settle in with a short
  // directional slide. Slower and flatter than a typical stagger (0.5s,
  // power3.out, 28px) so it reads as content arriving, not UI animating.
  useEffect(() => {
    if (reduceMotion) return;
    const el = scrollRef.current;
    if (!el) return;
    const targets = [];
    const walk = (node) => {
      for (const kid of Array.from(node.children)) {
        if (kid.hasAttribute("data-gsap-list")) targets.push(...Array.from(kid.children));
        else if (kid.querySelector?.("[data-gsap-list]")) walk(kid);
        else targets.push(kid);
      }
    };
    walk(el);
    if (!targets.length) return;
    const tween = gsap.fromTo(targets,
      { x: dirRef.current * 28, y: 8, opacity: 0 },
      { x: 0, y: 0, opacity: 1, duration: 0.5, ease: "power3.out", stagger: { each: 0.05 }, clearProps: "transform,opacity" });
    return () => tween.kill();
  }, [step]);

  // Steps leave before the next one enters — a short fade + slide out in the
  // travel direction, then the remount plays the entrance.
  const animStep = (target) => {
    if (target === step) return;
    dirRef.current = target > step ? 1 : -1;
    if (reduceMotion || !scrollRef.current) { setStep(target); return; }
    gsap.to(scrollRef.current, {
      opacity: 0, x: dirRef.current * -26, duration: 0.22, ease: "power2.in",
      onComplete: () => setStep(target),
    });
  };
  const next = () => animStep(Math.min(step + 1, total - 1));
  const back = () => animStep(Math.max(step - 1, 0));

  // ── Progress ──────────────────────────────────────────────
  // Counted over QUESTIONS only; the interstitials (quote, test) hold the
  // bar at the value they inherited rather than resetting it, so the line
  // never appears to go backwards.
  const QUESTION_FLOW = FLOW.filter((k) => k !== "vision" && k !== "quote" && k !== "test");
  const qIndex = QUESTION_FLOW.indexOf(key);
  const answered = qIndex !== -1 ? qIndex : FLOW.slice(0, step).filter((k) => QUESTION_FLOW.includes(k)).length - 1;
  const pct = Math.max(0, Math.min(1, (answered + 1) / QUESTION_FLOW.length));

  const fillRef = useRef(null);
  const dotRef = useRef(null);
  const chapter = chapterOf(key);
  const chapterId = chapter?.id;
  const prevChapter = useRef(chapterId);
  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;
    if (reduceMotion) { fill.style.width = `${pct * 100}%`; return; }
    const tw = gsap.to(fill, { width: `${pct * 100}%`, duration: 0.55, ease: "power3.out" });
    // Milestone: crossing into a new chapter gives the leading dot a single
    // quiet bloom. The only celebratory beat in the flow — nothing bounces.
    let pulse;
    if (chapterId && chapterId !== prevChapter.current && dotRef.current) {
      pulse = gsap.fromTo(dotRef.current, { scale: 1, opacity: 1 }, { scale: 2.6, opacity: 0, duration: 0.7, ease: "power2.out" });
    }
    prevChapter.current = chapterId;
    return () => { tw.kill(); pulse?.kill(); };
  }, [pct, chapterId]);

  // ── Derived validity (hoisted so the shared footer can read it) ──
  const cleanDec = (v) => {
    let s = v.replace(/[^\d.,]/g, "").replace(",", ".").slice(0, 5);
    const parts = s.split(".");
    if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");
    return s;
  };
  const waistOk = waist === "" || (+waist >= 40 && +waist <= 200);
  const bfOk = bodyFat === "" || (+bodyFat >= 3 && +bodyFat <= 60);
  const waistCanNext = (waist !== "" || bodyFat !== "") && waistOk && bfOk;
  const expNum = experience === "" ? null : +experience;
  const expOk = experience !== "" && expNum >= 0 && expNum <= 30;

  // Display names are unique across accounts — check with the server before
  // moving on (offline/demo mode skips silently, isNameTaken returns false).
  const tryName = async () => {
    const n = username.trim();
    if (!n || checkingName) return;
    if (!isNameAllowed(n)) { setNameMsg("To ime ni dovoljeno — izberi drugo."); return; }
    setCheckingName(true);
    const taken = await isNameTaken(n).catch(() => false);
    setCheckingName(false);
    if (taken) { setNameMsg("To ime je že zasedeno — izberi drugo."); return; }
    setNameMsg("");
    next();
  };
  const onInjuryFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = ""; // allow picking the same file again after removing it
    if (!f) return;
    try { setInjuryPhoto(await compressToDataUrl(f)); } catch {}
  };
  const finish = () => {
    const finalSport = sport === "Drugo" ? (customSport.trim() || "Drugo") : sport;
    const finalGoals = [...goals, ...(customGoal.trim() ? [customGoal.trim()] : [])];
    try { localStorage.removeItem(SETUP_KEY); } catch {}
    const finalInjuries = hasInjury ? guessInjuryAreas(injuryNote) : [];
    onDone({
      username: username.trim() || "Športnik", birth, height, weight, sport: finalSport,
      acquisition, gender, waist: waist ? +waist : null, bodyFat: bodyFat ? +bodyFat : null,
      goals: finalGoals, experience: experience === "" ? 0 : +experience, injuries: finalInjuries,
      injuryNote: hasInjury ? injuryNote.trim() : "", injuryPhoto: hasInjury ? injuryPhoto : "", equipment,
    });
  };

  const pick = (fn) => (...args) => { tick(); fn(...args); };
  const toggle = (setter) => (o) => setter((arr) => arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);

  // Questions are unchanged; only the supporting line is rewritten — from
  // shouted mono captions ("ZA IZRAČUN NORM IN KALORIJ") to a calm sentence
  // that answers the user's actual question: why are you asking me this?
  const STEP_COPY = {
    name:      { title: "Uporabniško ime",           sub: "Tako te bodo videli soigralci in trener." },
    acq:       { title: "Kako si slišal za nas?",    sub: "" },
    birth:     { title: "Datum rojstva",             sub: "Norme in obremenitve se računajo glede na starost." },
    gender:    { title: "Spol",                      sub: "Za izračun norm in kalorij." },
    body:      { title: "Višina & teža",             sub: "Osnova za bremena, kalorije in spremljanje napredka." },
    waist:     { title: "Obseg pasu & body fat",     sub: "Če veš — drugače preskoči." },
    sport:     { title: "Kateri šport treniraš?",    sub: "Program se prilagodi zahtevam tvojega športa." },
    goals:     { title: "Kaj so tvoji cilji?",       sub: "Izberi enega ali več." },
    exp:       { title: "Koliko let izkušenj imaš?", sub: "S fitnesom in treningom moči." },
    injuries:  { title: "Poškodbe?",                 sub: "Trenutne in pretekle — da program ostane varen." },
    equipment: { title: "Kakšno opremo imaš na voljo?", sub: "Vaje izbiramo samo iz tega, kar res imaš." },
    test:      { title: "Začetni test",              sub: "" },
  };

  // The CTA speaks about what the answer *does*, and marks the two moments
  // that deserve weight (locking goals, building the profile). Everywhere
  // else it stays out of the way.
  const CTA_LABEL = {
    name: "Začnimo", acq: "Nadaljuj", birth: "Potrdi", gender: "Nadaljuj",
    body: "Potrdi mere", waist: "Nadaljuj", quote: "Sem pripravljen",
    goals: "Zakleni cilje", exp: "Nadaljuj", injuries: "Nadaljuj",
    equipment: "Zaključi profil", test: "Zgradi moj profil",
  };

  // Per-step footer contract: is the CTA live, what does it do, is there a
  // skip. `null` = this step has no footer (sport auto-advances on pick).
  const ACTIONS = {
    name:      { ok: !!username.trim() && !checkingName, on: tryName, label: checkingName ? "Preverjam…" : CTA_LABEL.name },
    acq:       { ok: !!acquisition, on: next, skip: next },
    birth:     { ok: validBirth(birth), on: next },
    gender:    { ok: !!gender, on: next },
    body:      { ok: true, on: next },
    waist:     { ok: waistCanNext, on: next, skip: () => { setWaist(""); setBodyFat(""); next(); } },
    quote:     { ok: true, on: next },
    sport:     null,
    goals:     { ok: goals.length > 0, on: next },
    exp:       { ok: expOk, on: next },
    injuries:  { ok: hasInjury === false || (hasInjury === true && !!injuryNote.trim()), on: next },
    equipment: { ok: equipment.length > 0, on: next, skip: () => { setEquipment([]); next(); } },
    test:      { ok: true, on: finish },
  };
  const action = ACTIONS[key];
  const onLight = key === "test"; // step rendered over the hero photo

  const head = (extra) => {
    const copy = STEP_COPY[key];
    if (!copy) return null;
    return <Head C={C} light={onLight} eyebrow={extra ?? (chapter ? t(chapter.line) : undefined)} title={t(copy.title)} sub={copy.sub ? t(copy.sub) : ""} />;
  };

  const dark = C.name === "dark";

  return (
    <div ref={rootRef} className="app-fullscreen at-setup" style={{
      position: "fixed", inset: 0,
      background: C.bg,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      paddingTop: "env(safe-area-inset-top, 0px)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      <style>{`
        .at-setup ::placeholder { color: ${C.muted2}; opacity: 1; font-weight: 500; }
        .at-setup input, .at-setup textarea { color-scheme: ${dark ? "dark" : "light"}; }
      `}</style>

      {/* Hero photo — final step only. Sits behind all content; a bottom-weighted
          scrim keeps the type legible over it. */}
      {key === "test" && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none",
          backgroundImage: `linear-gradient(to top, ${C.bg} 6%, rgba(0,0,0,0.55) 46%, rgba(0,0,0,0.28) 100%), url('/img/working.jpeg')`,
          backgroundSize: "cover", backgroundPosition: "center",
        }} />
      )}

      {/* ── Progress rail — a 2px hairline across the very top edge. It is the
          only persistent chrome in the flow, and the only thing that ever
          animates on its own. ── */}
      <div style={{ position: "relative", height: 2, flexShrink: 0, background: dark ? "rgba(255,255,255,0.07)" : "rgba(16,24,40,0.07)" }}>
        <div ref={fillRef} style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct * 100}%`,
          background: C.accent, borderRadius: 999,
        }}>
          <span ref={dotRef} aria-hidden="true" style={{
            position: "absolute", right: -2, top: -2, width: 6, height: 6, borderRadius: "50%",
            background: C.accent,
          }} />
        </div>
      </div>

      {/* Back · step counter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 0", flexShrink: 0 }}>
        <button
          onClick={() => (step > 0 ? back() : onBack?.())}
          aria-label={t("Nazaj")}
          style={{
            width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
            background: "none", border: "none", padding: 0, cursor: "pointer",
            color: onLight ? "rgba(255,255,255,0.8)" : C.muted, WebkitTapHighlightColor: "transparent",
          }}>
          <svg width="10" height="17" viewBox="0 0 10 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 1L1 9l8 8" /></svg>
        </button>
        {qIndex !== -1 && (
          <span style={{ fontFamily: C.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.16em", paddingRight: 8 }}>
            <span style={{ color: C.text }}>{String(qIndex + 1).padStart(2, "0")}</span>
            <span style={{ color: C.muted2 }}>{" — "}{String(QUESTION_FLOW.length).padStart(2, "0")}</span>
          </span>
        )}
      </div>

      {/* ── Step content ── */}
      <div ref={scrollRef} key={step} style={{
        flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
        padding: "22px 20px 8px", overflowY: "auto", scrollbarWidth: "none",
      }}>

        {key === "name" && (
          <>
            {head()}
            <Field
              C={C} value={username} size={23}
              onChange={(e) => { setUsername(e.target.value); setNameMsg(""); }}
              onKeyDown={(e) => e.key === "Enter" && tryName()}
              placeholder={t("npr. Nik")} invalid={!!nameMsg}
              autoCapitalize="words" autoCorrect="off" spellCheck={false}
            />
            {nameMsg && (
              <span style={{ color: C.red, fontFamily: C.display, fontSize: 13, fontWeight: 500, marginTop: 10, display: "block" }}>{t(nameMsg)}</span>
            )}

            {/* Live preview — what teammates will actually see. Borderless: the
                avatar and the name are the object, there is no card around it. */}
            <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{
                width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: C.display, fontWeight: 600, fontSize: 18,
                color: username.trim() ? C.accent : C.muted2,
                background: username.trim() ? `${C.accent}14` : (dark ? "rgba(255,255,255,0.05)" : "rgba(16,24,40,0.045)"),
                transition: `background 0.35s ease, color 0.35s ease`,
              }}>
                {(username.trim()[0] || "?").toUpperCase()}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{
                  display: "block", fontFamily: C.display, fontWeight: 600, fontSize: 16.5, letterSpacing: "-0.015em",
                  color: username.trim() ? C.text : C.muted2,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{username.trim() || t("Tvoje ime")}</span>
                <span style={{ display: "block", fontFamily: C.display, fontSize: 12.5, color: C.muted, marginTop: 2 }}>
                  {t("Ime lahko kadarkoli spremeniš v Profilu.")}
                </span>
              </span>
            </div>
          </>
        )}

        {key === "acq" && (
          <>
            {head()}
            <div data-gsap-list="true">
              {ACQ_OPTIONS.map((o, i) => (
                <AnswerRow
                  key={o} C={C} first={i === 0}
                  label={t(o)} active={acquisition === o}
                  onClick={pick(() => setAcquisition((cur) => (cur === o ? "" : o)))}
                  icon={ACQ_ICONS(C)[i]}
                />
              ))}
            </div>
          </>
        )}

        {key === "birth" && (
          <>
            {head()}
            <BirthWheelInline value={birth} onChange={setBirth} C={C} lang={lang} />
          </>
        )}

        {key === "gender" && (
          <>
            {head()}
            <div data-gsap-list="true" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <GenderCard C={C} img="/img/man%20working%20out.png" label={t("Moški")}
                active={gender === "Moški"} onClick={pick(() => setGender((cur) => (cur === "Moški" ? "" : "Moški")))} />
              <GenderCard C={C} img="/img/woman%20working%20out.png" label={t("Ženski")}
                active={gender === "Ženski"} onClick={pick(() => setGender((cur) => (cur === "Ženski" ? "" : "Ženski")))} />
              <AnswerRow C={C} first label={t("Drugo")} active={gender === "Drugo"}
                onClick={pick(() => setGender((cur) => (cur === "Drugo" ? "" : "Drugo")))} />
            </div>
          </>
        )}

        {key === "body" && (
          <>
            {head()}
            <div data-gsap-list="true">
              <MeasureRow C={C} first label={t("VIŠINA")} set={heightSet}
                value={`${height} cm`} placeholder={t("Tapni za izbiro")} onClick={() => setOpenPicker("height")} />
              <MeasureRow C={C} label={t("TEŽA")} set={weightSet}
                value={`${weight} kg`} placeholder={t("Tapni za izbiro")} onClick={() => setOpenPicker("weight")} />
            </div>
            <div style={{ flex: 1, minHeight: 28 }} />
            <BmiDial height={height} weight={weight} C={C} t={t} />
            <div style={{ minHeight: 12 }} />

            <WheelPicker
              open={openPicker === "height"} title={t("Izberi višino (cm)")} unit="cm" min={120} max={230} step={1}
              value={height} onChange={(v) => { setHeight(v); setHeightSet(true); }} onClose={() => setOpenPicker(null)}
            />
            <WheelPicker
              open={openPicker === "weight"} title={t("Izberi težo (kg)")} unit="kg" min={30} max={200} step={1}
              value={weight} onChange={(v) => { setWeight(v); setWeightSet(true); }} onClose={() => setOpenPicker(null)}
            />
          </>
        )}

        {key === "waist" && (
          <>
            {head()}
            <div>
              <Eyebrow C={C} color={C.muted}>{t("OBSEG PASU (CM)")}</Eyebrow>
              <div style={{ height: 10 }} />
              <Field C={C} value={waist} onChange={(e) => setWaist(cleanDec(e.target.value))}
                inputMode="decimal" placeholder={t("npr. 82")} invalid={!waistOk} />
              {!waistOk && <span style={{ color: C.red, fontFamily: C.display, fontSize: 13, fontWeight: 500, marginTop: 9, display: "block" }}>{t("Vnesi realen obseg pasu (40–200 cm).")}</span>}
            </div>
            <div style={{ height: 30 }} />
            <div>
              <Eyebrow C={C} color={C.muted}>{t("BODY FAT % (OKVIRNO)")}</Eyebrow>
              <div style={{ height: 10 }} />
              <Field C={C} value={bodyFat} onChange={(e) => setBodyFat(cleanDec(e.target.value))}
                inputMode="decimal" placeholder={t("npr. 15")} invalid={!bfOk} />
              {!bfOk && <span style={{ color: C.red, fontFamily: C.display, fontSize: 13, fontWeight: 500, marginTop: 9, display: "block" }}>{t("Vnesi realen odstotek (3–60 %).")}</span>}
            </div>
          </>
        )}

        {/* ── Interstitial: the halfway beat. No question, no progress
            pressure — just the reason the user is doing this. ── */}
        {key === "quote" && (
          <div data-gsap-list="true" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 26 }}>
              <Eyebrow C={C}>{t("POLOVICA JE ZA TEBOJ")}</Eyebrow>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{
                margin: 0, fontFamily: C.display, fontWeight: 600, fontSize: 31,
                lineHeight: 1.16, letterSpacing: "-0.035em", color: C.text,
              }}>
                {t("Vsak vrhunski športnik je začel točno tam, kjer si ti zdaj.")}
              </h2>
              <p style={{ margin: "18px 0 0", fontFamily: C.display, fontWeight: 400, fontSize: 15, lineHeight: 1.55, color: C.text2, maxWidth: "34ch" }}>
                {t("ATHLOS te bo vodil skozi vzpone in padce — tako da boš dosegel cilj, ki si si ga zadal.")}
              </p>
              <p style={{ margin: "20px 0 0", fontFamily: C.display, fontWeight: 400, fontSize: 13.5, lineHeight: 1.55, color: C.muted, maxWidth: "34ch" }}>
                {t("P.S. Najtežji del je že za teboj — odločitev, da začneš.")}
              </p>
            </div>
          </div>
        )}

        {key === "sport" && (
          <>
            {head()}
            <div data-gsap-list="true">
              {SPORTS.map((s, i) => (
                <AnswerRow
                  key={s} C={C} first={i === 0} label={t(s)} active={sport === s}
                  onClick={pick(() => {
                    if (sport === s) { setSport(""); return; } // re-tap → deselect, don't advance
                    setSport(s);
                    if (s !== "Drugo") setTimeout(next, 300);
                  })}
                />
              ))}
            </div>
            {sport === "Drugo" && (
              <div style={{ animation: "athlosFade 0.25s ease", marginTop: 26 }}>
                <Eyebrow C={C} color={C.muted}>{t("VPIŠI ŠPORT")}</Eyebrow>
                <div style={{ height: 10 }} />
                <Field C={C} value={customSport} onChange={(e) => setCustomSport(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && customSport.trim()) next(); }}
                  placeholder={t("npr. Odbojka, Judo, Veslanje...")} autoFocus />
              </div>
            )}
          </>
        )}

        {key === "goals" && (
          <>
            {head()}
            <div data-gsap-list="true">
              {GOAL_OPTIONS.map((o, i) => (
                <AnswerRow key={o} C={C} first={i === 0} multi label={t(o)}
                  active={goals.includes(o)} onClick={pick(() => toggle(setGoals)(o))} />
              ))}
            </div>
          </>
        )}

        {key === "exp" && (
          <>
            {head()}
            <Field
              C={C} value={experience} size={44}
              onChange={(e) => setExperience(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
              inputMode="numeric" placeholder="0" autoFocus
              invalid={experience !== "" && !expOk}
            />
            <div style={{ marginTop: 14, minHeight: 20 }}>
              {experience !== "" && !expOk ? (
                <span style={{ color: C.red, fontFamily: C.display, fontSize: 13, fontWeight: 500 }}>{t("Vnesi realno število let (0–30).")}</span>
              ) : expOk ? (
                <span style={{ fontFamily: C.display, fontSize: 14.5, fontWeight: 400, color: C.muted }}>
                  {lang === "en"
                    ? `${expNum} ${expNum === 1 ? "year" : "years"} of training behind you.`
                    : `${expNum} ${yearsWordSl(expNum)} treninga za teboj.`}
                </span>
              ) : null}
            </div>
          </>
        )}

        {key === "injuries" && (
          <>
            {head()}
            <div data-gsap-list="true" style={{ display: "flex", gap: 10 }}>
              {[{ v: false, label: t("Ne") }, { v: true, label: t("Da") }].map(({ v, label }) => {
                const active = hasInjury === v;
                return (
                  <button key={label} onClick={pick(() => {
                    setHasInjury(v);
                    if (!v) { setInjuries([]); setInjuryNote(""); setInjuryPhoto(""); setTimeout(next, 260); }
                  })} style={{
                    flex: 1, height: 92, borderRadius: 18, border: "none", cursor: "pointer",
                    background: active ? `${C.accent}17` : (dark ? "rgba(255,255,255,0.04)" : "rgba(16,24,40,0.04)"),
                    fontFamily: C.display, fontWeight: active ? 600 : 500, fontSize: 18, letterSpacing: "-0.02em",
                    color: active ? C.accent : C.text2,
                    transition: `background 0.32s ${EASE}, color 0.28s ease`,
                    WebkitTapHighlightColor: "transparent",
                  }}>{label}</button>
                );
              })}
            </div>

            {hasInjury === true && (
              <div style={{ animation: "athlosFade 0.3s ease", marginTop: 30 }}>
                <Eyebrow C={C} color={C.muted}>{t("KATERO POŠKODBO IMAŠ?")}</Eyebrow>
                <div style={{ height: 10 }} />
                <Field C={C} multiline rows={3} value={injuryNote}
                  onChange={(e) => setInjuryNote(e.target.value)}
                  placeholder={t("npr. Bolečina v desnem kolenu pri počepu...")} />

                <div style={{ height: 26 }} />
                <Eyebrow C={C} color={C.muted}>{t("SLIKA POŠKODBE (NEOBVEZNO)")}</Eyebrow>
                <input ref={injuryFileRef} type="file" accept="image/*" onChange={onInjuryFile} style={{ display: "none" }} />
                {injuryPhoto ? (
                  <div style={{ position: "relative", marginTop: 12, width: 92, height: 92 }}>
                    <img src={injuryPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} />
                    <button onClick={() => setInjuryPhoto("")} aria-label={t("Odstrani sliko")} style={{
                      position: "absolute", top: -8, right: -8, width: 26, height: 26, borderRadius: "50%",
                      background: dark ? "#242424" : "#FFFFFF", border: "none", color: C.text, fontSize: 15, lineHeight: 1,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent",
                    }}>×</button>
                  </div>
                ) : (
                  <button onClick={() => injuryFileRef.current?.click()} style={{
                    marginTop: 12, width: 92, height: 92, borderRadius: 16, cursor: "pointer", border: "none",
                    background: dark ? "rgba(255,255,255,0.04)" : "rgba(16,24,40,0.04)", color: C.muted,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7,
                    WebkitTapHighlightColor: "transparent",
                  }}>
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="8.5" cy="10.5" r="1.5" /><path d="M21 15l-5-5L5 19" /></svg>
                    <span style={{ fontFamily: C.mono, fontSize: 8, letterSpacing: "0.12em" }}>{t("DODAJ SLIKO")}</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {key === "equipment" && (
          <>
            {head()}
            <div data-gsap-list="true">
              {EQUIPMENT_OPTIONS.map((o, i) => (
                <AnswerRow key={o} C={C} first={i === 0} multi label={t(o)}
                  active={equipment.includes(o)} onClick={pick(() => toggle(setEquipment)(o))} />
              ))}
            </div>
          </>
        )}

        {key === "test" && (
          <div data-gsap-list="true" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ marginBottom: 16 }}>
              <Eyebrow C={C} color="rgba(255,255,255,0.75)">{t("SKORAJ PRIPRAVLJENO")}</Eyebrow>
            </div>
            <h2 style={{
              margin: 0, fontFamily: C.display, fontWeight: 600, fontSize: 32,
              lineHeight: 1.12, letterSpacing: "-0.035em", color: "#FFFFFF", maxWidth: "14ch",
            }}>{t("Začetni test")}</h2>
            <p style={{
              margin: "16px 0 0", fontFamily: C.display, fontWeight: 400, fontSize: 15,
              lineHeight: 1.55, color: "rgba(255,255,255,0.78)", maxWidth: "32ch",
            }}>
              {t("Kratek test moči, hitrosti in mobilnosti — vsebina prihaja kmalu. Zaenkrat ta korak preskočimo.")}
            </p>
          </div>
        )}

      </div>

      {/* ── Action footer — identical position on every step, so the primary
          action never moves as the user advances. ── */}
      {action && (
        <div style={{ flexShrink: 0, padding: "10px 20px 20px", background: "transparent" }}>
          <ContinueBtn C={C} onClick={action.on} disabled={!action.ok}>
            {t(action.label || CTA_LABEL[key] || "Nadaljuj")}
          </ContinueBtn>
          {action.skip ? (
            <button onClick={action.skip} style={{
              display: "block", width: "100%", marginTop: 6, padding: "12px 0",
              background: "none", border: "none", cursor: "pointer",
              fontFamily: C.display, fontWeight: 500, fontSize: 13.5, letterSpacing: "-0.01em",
              color: onLight ? "rgba(255,255,255,0.6)" : C.muted2,
              WebkitTapHighlightColor: "transparent",
            }}>{t("Preskoči")}</button>
          ) : <div style={{ height: 18 }} />}
        </div>
      )}
    </div>
  );
}

// ── Gender card — the photo is the surface, the label is the object. No
// ring, no chip: selection lifts the image out of its resting dim and moves
// the label into accent, which is enough because only one can be picked. ──
function GenderCard({ img, label, active, onClick, C }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        position: "relative", overflow: "hidden", flex: 1, minHeight: 132,
        borderRadius: 20, border: "none", cursor: "pointer", padding: 0,
        background: C.name === "dark" ? "rgba(255,255,255,0.04)" : "rgba(16,24,40,0.04)",
        transform: pressed ? "scale(0.992)" : "none",
        transition: `transform 0.22s ease`,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <img src={img} alt="" aria-hidden="true" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        objectPosition: "center 28%",
        opacity: active ? 0.62 : 0.3, filter: active ? "saturate(1)" : "saturate(0.5)",
        transition: `opacity 0.4s ${EASE}, filter 0.4s ease`,
      }} />
      <span aria-hidden="true" style={{
        position: "absolute", inset: 0,
        background: active
          ? `linear-gradient(to top, ${C.accent}22, rgba(0,0,0,0.18))`
          : "linear-gradient(to top, rgba(0,0,0,0.42), rgba(0,0,0,0.10))",
        transition: "background 0.4s ease",
      }} />
      <span style={{
        position: "absolute", left: 20, bottom: 16,
        fontFamily: C.display, fontWeight: 600, fontSize: 21, letterSpacing: "-0.02em",
        color: active ? C.accent : "#FFFFFF",
        transition: "color 0.3s ease",
      }}>{label}</span>
      <span aria-hidden="true" style={{
        position: "absolute", right: 18, bottom: 20,
        opacity: active ? 1 : 0, transform: active ? "scale(1)" : "scale(0.6)",
        transition: `opacity 0.24s ease, transform 0.34s ${EASE}`,
        display: "flex",
      }}>
        <Check color={C.accent} size={18} />
      </span>
    </button>
  );
}

// ── Measurement row — the label is small and quiet, the value is large.
// Same hairline-separated list language as the answer rows, so the height/
// weight step doesn't introduce a second visual system. ──
function MeasureRow({ label, value, placeholder, set, first, onClick, C }) {
  const [pressed, setPressed] = useState(false);
  const dark = C.name === "dark";
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
        width: "calc(100% + 40px)", marginLeft: -20, padding: "18px 20px",
        textAlign: "left", border: "none", background: "transparent", cursor: "pointer",
        borderTop: first ? "1px solid transparent" : `1px solid ${dark ? "rgba(255,255,255,0.058)" : "rgba(16,24,40,0.07)"}`,
        transform: pressed ? "scale(0.994)" : "none",
        transition: "transform 0.2s ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span>
        <span style={{ display: "block", fontFamily: C.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted }}>{label}</span>
        <span style={{
          display: "block", marginTop: 7, fontFamily: C.display, letterSpacing: "-0.03em",
          fontWeight: 600, fontSize: set ? 27 : 17, color: set ? C.text : C.muted2,
          transition: `font-size 0.28s ${EASE}, color 0.28s ease`,
        }}>{set ? value : placeholder}</span>
      </span>
      <span aria-hidden="true" style={{ color: C.muted2, flexShrink: 0, display: "flex" }}>
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l6 6-6 6" /></svg>
      </span>
    </button>
  );
}

// Acquisition icons — kept at label scale (20px, no chip behind them) so they
// read as marks next to a word, not as buttons in their own right.
const ACQ_ICONS = (C) => [
  <svg key="ig" width="20" height="20" viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="athlos-ig-grad" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#FFD600" /><stop offset="0.3" stopColor="#FF7A00" /><stop offset="0.55" stopColor="#FF0069" /><stop offset="0.8" stopColor="#D300C5" /><stop offset="1" stopColor="#7638FA" />
      </linearGradient>
    </defs>
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="url(#athlos-ig-grad)" strokeWidth="1.7" />
    <circle cx="12" cy="12" r="4.2" stroke="url(#athlos-ig-grad)" strokeWidth="1.7" />
    <circle cx="17.4" cy="6.6" r="1.3" fill="url(#athlos-ig-grad)" />
  </svg>,
  <svg key="fr" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4FA8FF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  <svg key="go" width="19" height="19" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>,
  <svg key="tt" width="19" height="19" viewBox="0 0 24 24">
    <path d="M16.6 5.82A4.28 4.28 0 0115.55 3h-3.09v12.4a2.59 2.59 0 11-2.59-2.59c.27 0 .53.04.77.12V9.77a5.76 5.76 0 00-.77-.05 5.68 5.68 0 105.68 5.68V9.01a7.3 7.3 0 004.27 1.36V7.28a4.28 4.28 0 01-3.22-1.46z" fill="#25F4EE" transform="translate(-0.9,-0.55)" />
    <path d="M16.6 5.82A4.28 4.28 0 0115.55 3h-3.09v12.4a2.59 2.59 0 11-2.59-2.59c.27 0 .53.04.77.12V9.77a5.76 5.76 0 00-.77-.05 5.68 5.68 0 105.68 5.68V9.01a7.3 7.3 0 004.27 1.36V7.28a4.28 4.28 0 01-3.22-1.46z" fill="#FE2C55" transform="translate(0.9,0.55)" />
    <path d="M16.6 5.82A4.28 4.28 0 0115.55 3h-3.09v12.4a2.59 2.59 0 11-2.59-2.59c.27 0 .53.04.77.12V9.77a5.76 5.76 0 00-.77-.05 5.68 5.68 0 105.68 5.68V9.01a7.3 7.3 0 004.27 1.36V7.28a4.28 4.28 0 01-3.22-1.46z" fill={C.name === "dark" ? "#FFFFFF" : "#111111"} />
  </svg>,
  <svg key="tk" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2FBF71" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9.5 12l1.8 1.8 3.2-3.6" /></svg>,
  <svg key="dr" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="8" cy="12" r="0.9" fill="#A78BFA" stroke="none" /><circle cx="12" cy="12" r="0.9" fill="#A78BFA" stroke="none" /><circle cx="16" cy="12" r="0.9" fill="#A78BFA" stroke="none" /></svg>,
];
