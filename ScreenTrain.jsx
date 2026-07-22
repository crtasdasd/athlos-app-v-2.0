import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../theme";
import { Mono, BackBtn, Pressable } from "../components/UI";
import { saveWorkout, completeTodaysTraining, getTodayCheckin } from "../lib/api";
import { readinessFromCheckin } from "../lib/readiness";
import { useT } from "../lib/i18n";
import { getLive, setLive, clearLive } from "../lib/liveSession";
import LockscreenDemo from "./widgets/LockscreenDemo";

// PDF Upgrade 6 — deterministic, real-data recovery note: RPE (1-5, what the
// athlete just reported) + today's actual readiness battery (real check-in,
// not fabricated). No video-based form analysis — that sub-feature is out of
// scope for this pass.
function rpeRecommendation(rpe, battery) {
  if (rpe == null) return null;
  if (rpe >= 5 && battery != null && battery < 50)
    return "Trening je bil zelo naporen, pripravljenost pa je bila že nizka — nocoj daj prednost spanju in jutri izpusti intenzivni del.";
  if (rpe >= 5)
    return "Trening je bil zelo naporen. Poskrbi za beljakovine in vsaj 8h spanja nocoj, jutri začni z lažjim ogrevanjem.";
  if (rpe === 4)
    return "Solidna obremenitev. Standardna regeneracija — raztezanje in dovolj tekočine bo dovolj.";
  if (rpe <= 2 && battery != null && battery >= 70)
    return "Trening je bil lahek, pripravljenost pa visoka — jutri lahko brez težav stopnjuješ obremenitev.";
  return "Zmerna obremenitev. Nocoj normalen spanec, jutri trening po planu.";
}

/* ───────────────────────── helpers ───────────────────────── */
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* Session model (mirrors the design mockups: warm-up → super-set A → cool-down) */
const SESSION = {
  no: 1,
  focus: "MOČ · SPODNJI DEL",
  when: "SRE · 04 JUN · 18:30",
  rounds: 3,
  rest: 90,
  stats: { time: "62", intens: "82", volume: "8.6", kcal: "480" },
  warmup: { name: "Ogrevanje", info: "5 vaj · 8 min" },
  cooldown: { name: "Ohlajanje", info: "4 koraki · 7 min" },
  // Exercise names are always English — see the note in lib/coachOffline.js.
  block: [
    { block: "A1", cat: "GLAVNI DVIG", name: "Squat", tag: "VBT", reps: 5, load: 120, unit: "KG", sets: 4, chart: true },
    { block: "A2", cat: "EKSPLOZIVNOST", name: "Box jump", reps: 3, load: 60, unit: "CM", sets: 3 },
    { block: "A3", cat: "STABILNOST", name: "Copenhagen plank", reps: 30, load: 0, unit: "S", sets: 3 },
  ],
};

/* ───────────────────────── reps slider ───────────────────────── */
function RepsSlider({ value, max, onChange, accent, track, knobText }) {
  const ref = useRef(null);
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const setFromX = (clientX) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onChange(Math.round(f * max));
  };
  return (
    <div
      ref={ref}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setFromX(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons) setFromX(e.clientX); }}
      style={{ position: "relative", height: 34, borderRadius: 9, background: track, cursor: "pointer", touchAction: "none", overflow: "hidden", userSelect: "none" }}
    >
      <div style={{ position: "absolute", inset: 0, width: `${pct * 100}%`, background: `${accent}26`, borderRadius: 9, transition: "width 0.08s linear" }} />
      <div style={{ position: "absolute", top: "50%", left: `calc(${pct * 100}% )`, transform: "translate(-50%,-50%)", width: 30, height: 26, borderRadius: 8, background: accent, display: "flex", alignItems: "center", justifyContent: "center", color: knobText, fontWeight: 800, fontSize: 12, pointerEvents: "none" }}>
        ‹›
      </div>
    </div>
  );
}

/* ───────────────────────── load stepper ───────────────────────── */
function LoadStepper({ value, unit, onChange, C, step = 2.5 }) {
  const btn = { width: 40, height: 40, borderRadius: 10, border: `1px solid ${C.border2}`, background: C.surface2, color: C.text, fontSize: 22.5, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={() => onChange(Math.max(0, +(value - step).toFixed(1)))} style={btn}>−</button>
      <div style={{ flex: 1, textAlign: "center" }}>
        <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22, color: C.text, letterSpacing: "-0.01em" }}>{value}</span>
        <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, marginLeft: 5, letterSpacing: "0.08em" }}>{unit}</span>
      </div>
      <button onClick={() => onChange(+(value + step).toFixed(1))} style={btn}>+</button>
    </div>
  );
}

/* ───────────────────────── progression chart ─────────────────────────
   Same visual language as the "Napredovanje · teža" chart in VBTSheet:
   dashed horizontal grid + y-axis labels, area fill under the primary
   (load) line, hollow dots per point with the current one filled + bigger,
   week labels under each dot (bold + accent on the last one). */
function Progression({ C, t }) {
  const W = 320, H = 170;
  const padL = 36, padR = 14, padT = 14, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const load = [38, 44, 50, 58, 66, 78, 92, 110];
  const vel = [108, 100, 92, 86, 74, 64, 52, 40];
  const weekLabels = ["T-7", "T-6", "T-5", "T-4", "T-3", "T-2", "T-1", t("ZDAJ")];
  const yMin = 30, yMax = 120;
  const gridVals = [120, 90, 60, 30];

  const mx = (i) => padL + (i / (load.length - 1)) * plotW;
  const my = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const loadPts = load.map((v, i) => `${mx(i).toFixed(1)},${my(v).toFixed(1)}`).join(" ");
  const velPts = vel.map((v, i) => `${mx(i).toFixed(1)},${my(v).toFixed(1)}`).join(" ");
  const areaPts = `${padL},${padT + plotH} ${loadPts} ${mx(load.length - 1).toFixed(1)},${padT + plotH}`;

  return (
    <div style={{ background: C.surface2, borderRadius: 18, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em" }}>{t("NAPREDEK · 8 TEDNOV")}</Mono>
          <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: "-0.01em", marginTop: 4 }}>{t("OBREMENITEV & HITROST")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div><span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 18, color: C.text, letterSpacing: "-0.01em" }}>120</span><span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}> KG</span> <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>+20%</span></div>
          <div><span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 18, color: C.text, letterSpacing: "-0.01em" }}>0.58</span><span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}> M/S {t("HITR.")}</span></div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block" }}>
        {/* horizontal grid */}
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={padL} y1={my(v)} x2={padL + plotW} y2={my(v)} stroke={C.border} strokeWidth="0.8" strokeDasharray="3 5" />
            <text x={padL - 4} y={my(v) + 3} fontSize="8" fill={C.muted2} textAnchor="end" fontFamily="monospace">{v}</text>
          </g>
        ))}
        {/* area fill under the load line */}
        <polygon points={areaPts} fill={`${C.accent}10`} />
        {/* velocity — secondary, dashed, no dots */}
        <polyline points={velPts} fill="none" stroke={C.muted2} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
        {/* load — primary line */}
        <polyline points={loadPts} fill="none" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* dots + x labels */}
        {load.map((v, i) => {
          const cx = mx(i), cy = my(v);
          const isLast = i === load.length - 1;
          return (
            <g key={i}>
              {isLast
                ? <circle cx={cx} cy={cy} r="7.5" fill={C.accent} />
                : <circle cx={cx} cy={cy} r="5" fill={C.bg} stroke={C.accent} strokeWidth="1.8" />}
              <text x={cx} y={padT + plotH + 18} fontSize="8" fill={isLast ? C.accent : C.muted2} textAnchor="middle" fontFamily="monospace" fontWeight={isLast ? "700" : "400"}>{weekLabels[i]}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 11, marginTop: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 2, background: C.accent }} /><Mono style={{ color: C.muted, fontSize: 8.5 }}>{t("Obremenitev · kg")}</Mono></span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.muted2}` }} /><Mono style={{ color: C.muted, fontSize: 8.5 }}>{t("Hitrost · m/s")}</Mono></span>
      </div>
    </div>
  );
}

/* ───────────────────────── VBT sheet ───────────────────────── */
const VBT_HISTORY = [
  { label: "T1",    kg: 100,   reps: 5, vbt: false },
  { label: "T2",    kg: 107.5, reps: 5, vbt: false },
  { label: "T3",    kg: 112.5, reps: 5, vbt: false },
  { label: "T4",    kg: 117.5, reps: 5, vbt: false },
  { label: "DANES", kg: 120,   reps: 5, vbt: true, vel: "0.58 m/s" },
];

const VBT_TODAY_SETS = [
  { num: 1, label: "Set 1", sub: "OGREVALNI",              kg: 100, reps: 5, top: false },
  { num: 2, label: "Set 2", sub: "DELOVNI",                kg: 115, reps: 3, top: false },
  { num: 3, label: "Set 3", sub: "NAJVIŠJA – VBT POSNETO", kg: 130, reps: 3, top: true  },
];

function VBTSheet({ ex, C, t, onClose, onStart }) {
  const data = VBT_HISTORY;
  const W = 320, H = 170;
  const padL = 36, padR = 14, padT = 14, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const yMin = 93, yMax = 133;
  const gridKgs = [130, 120, 110, 100];

  const mx = (i) => padL + (i / (data.length - 1)) * plotW;
  const my = (kg) => padT + (1 - (kg - yMin) / (yMax - yMin)) * plotH;
  const linePts = data.map((d, i) => `${mx(i).toFixed(1)},${my(d.kg).toFixed(1)}`).join(" ");
  const areaPts = `${padL},${padT + plotH} ${linePts} ${mx(data.length - 1).toFixed(1)},${padT + plotH}`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 20, background: C.bg, display: "flex", flexDirection: "column", animation: "athlosFade 0.2s ease" }}>
      {/* header */}
      <div style={{ padding: "10px 13px", display: "flex", alignItems: "center", gap: 9, borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${C.border2}`, background: "transparent", color: C.text, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>←</button>
        <div style={{ flex: 1 }}>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em" }}>{ex.block} · {t("VAJA V TRENINGU")}</Mono>
          <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 20, color: C.text, marginTop: 2, letterSpacing: "-0.02em" }}>{t(ex.name)}</div>
          <Mono style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>{ex.reps} {t("PON.")} · {t("NAPREDOVANJE 4 TEDNI")}</Mono>
        </div>
        <span style={{ fontFamily: C.mono, fontSize: 8.5, fontWeight: 700, color: C.muted, border: `1px solid ${C.border2}`, borderRadius: 6, padding: "2px 5px", letterSpacing: "0.08em" }}>{ex.tag}</span>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "13px 13px 14px" }}>
        {/* chart card */}
        <div style={{ background: C.surface2, borderRadius: 18, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text }}>{t("Napredovanje")} · {t("teža")}</span>
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: "0.08em" }}>kg / {t("čas")}</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block" }}>
            {/* horizontal grid */}
            {gridKgs.map((kg) => (
              <g key={kg}>
                <line x1={padL} y1={my(kg)} x2={padL + plotW} y2={my(kg)} stroke={C.border} strokeWidth="0.8" strokeDasharray="3 5" />
                <text x={padL - 4} y={my(kg) + 3} fontSize="8" fill={C.muted2} textAnchor="end" fontFamily="monospace">{kg}</text>
              </g>
            ))}
            {/* area fill */}
            <polygon points={areaPts} fill={`${C.accent}10`} />
            {/* line */}
            <polyline points={linePts} fill="none" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            {/* dots + x labels */}
            {data.map((d, i) => {
              const cx = mx(i), cy = my(d.kg);
              const isLast = i === data.length - 1;
              return (
                <g key={i}>
                  {isLast
                    ? <circle cx={cx} cy={cy} r="7.5" fill={C.accent} />
                    : <circle cx={cx} cy={cy} r="5" fill={C.bg} stroke={C.accent} strokeWidth="1.8" />}
                  <text x={cx} y={padT + plotH + 18} fontSize="8" fill={isLast ? C.accent : C.muted2} textAnchor="middle" fontFamily="monospace" fontWeight={isLast ? "700" : "400"}>{d.label}</text>
                </g>
              );
            })}
          </svg>
          {/* legend */}
          <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill={C.bg} stroke={C.accent} strokeWidth="1.5" /></svg>
              <Mono style={{ color: C.muted, fontSize: 8.5 }}>{t("brez snemanja")}</Mono>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill={C.accent} /></svg>
              <Mono style={{ color: C.muted, fontSize: 8.5 }}>VBT · {t("zadnji set")}</Mono>
            </div>
          </div>
        </div>

        {/* today's sets */}
        <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", display: "block", marginBottom: 8 }}>{t("DANES")} · {VBT_TODAY_SETS.length} {t("SERIJE")}</Mono>
        <div style={{ background: C.surface2, borderRadius: 18, overflow: "hidden", marginBottom: 6 }}>
          {VBT_TODAY_SETS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < VBT_TODAY_SETS.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: s.top ? C.accent : C.surface3, color: s.top ? C.btnText : C.text2, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.mono, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{s.num}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text }}>{s.label}</div>
                <Mono style={{ color: C.muted, fontSize: 9 }}>{t(s.sub)}</Mono>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 16, color: C.text, letterSpacing: "-0.01em" }}>{s.kg} × {s.reps}</span>
                {s.top && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.red, flexShrink: 0 }} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "10px 13px", paddingBottom: "max(18px, env(safe-area-inset-bottom, 18px))", borderTop: `1px solid ${C.border}` }}>
        <button onClick={onStart} style={{ width: "100%", height: 56, padding: "0 11px", borderRadius: 15, border: "none", background: C.btn, color: C.btnText, fontFamily: C.display, fontWeight: 800, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
          {t("ZAČNI VAJO")} · {t(ex.name)}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════ screen ═══════════════════════════ */
export default function ScreenTrain({ go, user }) {
  const C = useTheme();
  const t = useT();
  // Resume a running session from the live store (spec §07) — the component
  // unmounts when the user switches tabs; the store keeps the workout alive.
  const resume = useRef(getLive()).current;
  const [started, setStarted] = useState(!!resume);
  const [finished, setFinished] = useState(false);
  // PDF Upgrade 6 — RPE gate shown between finishing the session and the
  // "Workout complete!" screen. `rpe` null = gate still open.
  const [awaitingRpe, setAwaitingRpe] = useState(false);
  const [rpe, setRpe] = useState(null);
  const [todayBattery, setTodayBattery] = useState(null);
  useEffect(() => {
    let live = true;
    getTodayCheckin(user?.id).then((row) => {
      if (!live || !row) return;
      const { battery } = readinessFromCheckin({
        sleepQuality: row.sleep_quality, mood: row.mood, soreness: row.soreness,
        stress: row.stress, sleepH: row.sleep_h, hydration: row.hydration,
      });
      setTodayBattery(battery);
    }).catch(() => {});
    return () => { live = false; };
  }, [user?.id]);
  const startedAt = useRef(resume?.startedAt || null);
  const [elapsed, setElapsed] = useState(resume ? Math.floor((Date.now() - resume.startedAt) / 1000) : 0);
  const [exIdx, setExIdx] = useState(resume?.exIdx || 0);
  // per-exercise set logs: { reps, load, done }[]
  const [logs, setLogs] = useState(() =>
    resume?.logs || SESSION.block.map((e) => Array.from({ length: e.sets }, () => ({ reps: 0, load: e.load, done: false })))
  );
  const [slide, setSlide] = useState(0); // slide-to-start progress 0..1
  const [vbtEx, setVbtEx] = useState(null); // index of exercise showing VBT sheet, or null
  const [lockDemo, setLockDemo] = useState(false); // mock lockscreen overlay (spec §07)

  // Pause actually stops the clock; on resume the start epoch shifts forward
  // by the paused span, so wall-clock consumers (live bar, resume-from-store)
  // agree with the on-screen total.
  const [paused, setPaused] = useState(false);
  const pausedAt = useRef(null);

  useEffect(() => {
    if (!started || finished || awaitingRpe || paused) return;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [started, finished, awaitingRpe, paused]);

  const togglePause = () => {
    setPaused((p) => {
      if (!p) {
        pausedAt.current = Date.now();
        setLive({ paused: true });
      } else if (pausedAt.current && startedAt.current) {
        startedAt.current += Date.now() - pausedAt.current;
        pausedAt.current = null;
        setLive({ startedAt: startedAt.current, paused: false });
      }
      return !p;
    });
  };

  const ex = SESSION.block[exIdx];
  const exLogs = logs[exIdx];
  const doneCount = exLogs.filter((s) => s.done).length;

  // Publish the workout state for the cross-tab live bar + lockscreen demo.
  useEffect(() => {
    if (!started || finished || awaitingRpe) return;
    if (!startedAt.current) startedAt.current = Date.now();
    const active = exLogs.find((x) => !x.done) || exLogs[exLogs.length - 1];
    setLive({
      focus: SESSION.focus, block: ex.block, exName: ex.name,
      setDone: doneCount, setsTotal: exLogs.length,
      reps: ex.reps, load: active?.load || 0, unit: ex.unit,
      nextName: SESSION.block[exIdx + 1]?.name || null,
      startedAt: startedAt.current, exIdx, logs,
    });
  }, [started, finished, exIdx, logs]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLog = (si, patch) => {
    // marking a set done starts the between-set rest countdown (spec §07)
    if (patch.done) setLive({ resting: true, restUntil: Date.now() + SESSION.rest * 1000 });
    setLogs((all) => all.map((arr, i) => (i === exIdx ? arr.map((s, j) => (j === si ? { ...s, ...patch } : s)) : arr)));
  };

  const addSet = () =>
    setLogs((all) => all.map((arr, i) => (i === exIdx ? [...arr, { reps: 0, load: ex.load, done: false }] : arr)));

  const finishSession = () => {
    // PDF Upgrade 6: gate on RPE before showing "Workout complete!" — the
    // session itself is already over (clock stops, live bar clears), the
    // athlete just hasn't rated it yet.
    setAwaitingRpe(true);
    clearLive();
    startedAt.current = null;
    saveWorkout(user?.id, {
      title: `Trening ${SESSION.no} · ${SESSION.focus}`,
      durationSec: elapsed,
      setsDone: logs.reduce((s, arr) => s + arr.filter((x) => x.done).length, 0),
      exercises: SESSION.block.map((e, i) => ({ name: e.name, sets: logs[i].length, reps: e.reps })),
    }).catch(() => {});
    completeTodaysTraining(user?.id).catch(() => {});
  };

  const submitRpe = (value) => {
    setRpe(value);
    setAwaitingRpe(false);
    setFinished(true);
  };

  const nextExercise = () => {
    if (exIdx >= SESSION.block.length - 1) return finishSession();
    setExIdx((i) => i + 1);
  };

  /* ───────── overview — pre-start cockpit: hero panel + session timeline ───────── */
  if (!started) {
    return (
      <div style={{ padding: "15px 13px 18px" }}>
        {/* hero panel — focus is the headline, everything else one quiet line */}
        <div style={{ background: C.surface2, borderRadius: 18, padding: "17px 15px 15px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em" }}>{t(SESSION.when)} · {t("TRENING")} {SESSION.no}</Mono>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="16" height="10" viewBox="0 0 26 14" fill="none"><rect x="0.5" y="0.5" width="22" height="13" rx="3" stroke={C.muted} /><rect x="23" y="4" width="2.5" height="6" rx="1" fill={C.muted} /><rect x="2" y="2" width="16" height="10" rx="1.5" fill={C.muted} /></svg>
              <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 10, color: C.text2 }}>84%</span>
            </span>
          </div>
          <h1 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 33, margin: "9px 0 6px", color: C.text, letterSpacing: "-0.03em", lineHeight: 1.04, textTransform: "uppercase" }}>{t(SESSION.focus)}</h1>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.12em", display: "block", marginBottom: 14 }}>{t("PREGLED TRENINGA")} · 3 {t("BLOKI")} · 9 {t("VAJ")}</Mono>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            {[[SESSION.stats.time, t("MIN"), C.text], [SESSION.stats.intens + "%", t("INTENZ."), C.text], [SESSION.stats.volume + t(" T"), t("VOLUMEN"), C.text], ["~" + SESSION.stats.kcal, t("KCAL"), C.text]].map(([v, l, col], i) => (
              <div key={i}>
                <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 21, color: col, letterSpacing: "-0.01em", lineHeight: 1.1 }}>{v}</div>
                <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.16em" }}>{l}</Mono>
              </div>
            ))}
          </div>
        </div>

        {/* session flow — warm-up and cool-down are standalone cards; the
            connecting line only runs between the super-set exercises
            themselves (A1 → A3), not out into the gaps around the cards. */}
        <div style={{ marginBottom: 6 }}>
          {/* warm up */}
          <BlockCard C={C} onClick={() => setStarted(true)}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill={C.muted}><path d="M12 2c1 3-1 4-1 6a3 3 0 006 0c0-1 0-2-1-3 3 2 5 5 5 9a9 9 0 11-18 0c0-4 3-7 6-9 0 2 2 3 4 3-2-2-1-4 0-6z" /></svg>}
            iconBg="transparent" title={t("Ogrevanje")} info={t("5 vaj · 8 min")} />

          {/* super set A — section marker inside the flow */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 2px 6px 46px" }}>
            <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em" }}>{t("SUPER SERIJA A")}</Mono>
            <Mono style={{ color: C.muted2, fontSize: 9 }}>{SESSION.rounds} {t("KROGI")} · {SESSION.rest}s {t("ODMOR")}</Mono>
          </div>

          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 16, top: 16, bottom: 16, width: 1, background: C.border2 }} />
            {SESSION.block.map((e, i) => (
              <button key={i} onClick={() => { if (e.chart || e.tag === "VBT") { setVbtEx(i); } else { setStarted(true); setExIdx(i); } }}
                style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", position: "relative", WebkitTapHighlightColor: "transparent" }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", background: C.surface3, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.mono, fontWeight: 700, fontSize: 10.5, color: C.text2, flexShrink: 0, position: "relative", zIndex: 1 }}>{e.block}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15.5, color: C.text, letterSpacing: "-0.01em" }}>{t(e.name)}</span>
                    {e.tag && <span style={{ fontFamily: C.mono, fontSize: 8.5, fontWeight: 700, color: C.muted, border: `1px solid ${C.border2}`, borderRadius: 6, padding: "1px 4px", letterSpacing: "0.08em" }}>{e.tag}</span>}
                  </span>
                  <Mono style={{ color: C.muted, fontSize: 10 }}>{e.reps} {t("pon.")} · {e.load > 0 ? `${e.load} ${e.unit.toLowerCase()}` : `${e.reps} ${e.unit.toLowerCase()} / ${t("stran")}`}</Mono>
                </span>
                <span style={{ color: C.muted2 }}>›</span>
              </button>
            ))}
          </div>

          <div style={{ height: 6 }} />

          {/* cool down */}
          <BlockCard C={C} onClick={() => setStarted(true)}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.5 1-1a5.5 5.5 0 000-7.9z" /></svg>}
            iconBg="transparent" title={t("Ohlajanje")} info={t("4 koraki · 7 min")} />
        </div>

        {/* VBT sheet overlay */}
        {vbtEx !== null && (
          <VBTSheet ex={SESSION.block[vbtEx]} C={C} t={t} onClose={() => setVbtEx(null)} onStart={() => { setVbtEx(null); setStarted(true); setExIdx(vbtEx); }} />
        )}

        {/* slide to start */}
        <div style={{ marginTop: 16 }}>
          <div style={{ position: "relative", height: 56, borderRadius: 15, background: C.btn, overflow: "hidden" }}>
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.display, fontWeight: 800, fontSize: 14.5, color: C.btnText, letterSpacing: "0.02em", opacity: 1 - slide }}>
              {t("POVLECI ZA ZAČETEK")} →
            </span>
            <div
              onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
              onPointerMove={(e) => {
                if (!e.buttons) return;
                const r = e.currentTarget.parentElement.getBoundingClientRect();
                setSlide(Math.max(0, Math.min(1, (e.clientX - r.left - 28) / (r.width - 56))));
              }}
              onPointerUp={() => { if (slide > 0.7) setStarted(true); else setSlide(0); }}
              style={{ position: "absolute", top: 5, left: `calc(5px + ${slide} * (100% - 56px))`, width: 46, height: 46, borderRadius: 12, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", touchAction: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={C.btn}><path d="M5 3l14 9-14 9V3z" /></svg>
            </div>
          </div>
        </div>

        {/* AI coach built this session — quiet secondary action straight into
            the AI chat, where the athlete can ask to swap/adjust exercises. */}
        <button onClick={() => { try { navigator.vibrate?.(8); } catch {} go("ai"); }} style={{
          width: "100%", marginTop: 9, height: 46, borderRadius: 13, cursor: "pointer",
          background: "transparent", border: `1px solid ${C.border2}`, color: C.text2,
          fontFamily: C.display, fontWeight: 700, fontSize: 13, letterSpacing: "-0.005em",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          WebkitTapHighlightColor: "transparent",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          {t("Trening ti je sestavil AI trener · uredi v klepetu")}
        </button>
      </div>
    );
  }

  /* ───────── RPE gate — PDF Upgrade 6, before "Workout complete!" ───────── */
  if (awaitingRpe) {
    return (
      <div style={{ padding: "15px 14px 16px", display: "flex", flexDirection: "column", height: "100%", animation: "athlosFade 0.3s ease" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.2em", marginBottom: 8, display: "block" }}>{t("PRED ZAKLJUČKOM")}</Mono>
          <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 26, margin: "0 0 8px", color: C.text, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            {t("Kako naporen je bil trening?")}
          </h2>
          <p style={{ fontFamily: C.display, fontWeight: 500, fontSize: 13, color: C.muted, lineHeight: 1.5, margin: "0 0 26px" }}>
            {t("Oceni RPE (napor), da ti pripravimo priporočilo za okrevanje.")}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => submitRpe(n)} style={{
                flex: "1 1 0", aspectRatio: "1 / 1", maxWidth: 58, borderRadius: "50%", cursor: "pointer", padding: 0,
                border: `1.5px solid ${C.border2}`, background: C.surface2, color: C.text,
                fontFamily: C.display, fontWeight: 800, fontSize: 17, WebkitTapHighlightColor: "transparent",
              }}>{n}</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 2px" }}>
            <Mono style={{ color: C.muted2, fontSize: 8 }}>{t("LAHKOTNO")}</Mono>
            <Mono style={{ color: C.muted2, fontSize: 8 }}>{t("ZELO NAPORNO")}</Mono>
          </div>
        </div>
      </div>
    );
  }

  /* ───────── completion — hero numbers, no tiles ───────── */
  if (finished) {
    return (
      <div style={{ padding: "15px 14px 16px", display: "flex", flexDirection: "column", height: "100%", animation: "athlosFade 0.3s ease" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 32, margin: "0 0 5px", color: C.text, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{t("Trening končan!")}</h2>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", marginBottom: 23, display: "block" }}>{t("SHRANJENO V TVOJO ZGODOVINO")}</Mono>
          {[[fmtTime(elapsed), t("čas")], [String(logs.reduce((s, a) => s + a.filter((x) => x.done).length, 0)), t("serij")], [String(SESSION.block.length), t("vaj")]].map(([v, l], i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "11px 2px", borderTop: `1px solid ${C.border}` }}>
              <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>{l}</Mono>
              <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 46, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{v}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 6 }} />
          {rpe != null && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: C.surface2, border: `1px solid ${C.border}` }}>
              <Mono style={{ color: C.accent, fontSize: 8.5, letterSpacing: "0.14em", display: "block", marginBottom: 6 }}>
                {t("PRIPOROČILO ZA OKREVANJE")} · RPE {rpe}/5
              </Mono>
              <p style={{ fontFamily: C.display, fontWeight: 500, fontSize: 13, color: C.text2, lineHeight: 1.55, margin: 0 }}>
                {t(rpeRecommendation(rpe, todayBattery))}
              </p>
            </div>
          )}
        </div>
        <Pressable onClick={() => { setStarted(false); setFinished(false); setRpe(null); setElapsed(0); setExIdx(0); go("today"); }} style={{ width: "100%", height: 56, padding: 0, borderRadius: 15, border: "none", background: C.btn, color: C.btnText, fontFamily: C.display, fontWeight: 700, fontSize: 14.5, marginTop: 16 }}>
          {t("Nazaj na pregled")}
        </Pressable>
      </div>
    );
  }

  /* ───────── active session — the current exercise owns the screen ───────── */
  const activeIdx = exLogs.findIndex((x) => !x.done); // first open set = the one in play

  return (
    <div style={{ padding: "15px 13px 18px" }}>
      {/* top strip: back · lock · pause · quiet mono clock */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <BackBtn onClick={() => setStarted(false)} />
        <div style={{ flex: 1 }} />
        {/* mock lockscreen Live Activity demo (spec §07) */}
        <button onClick={() => setLockDemo(true)} aria-label="Live Activity demo" style={{ width: 34, height: 34, borderRadius: 11, border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </button>
        <button onClick={togglePause} aria-label={paused ? t("Nadaljuj") : t("Pavza")} style={{ width: 34, height: 34, borderRadius: 11, border: `1px solid ${C.border2}`, background: "transparent", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
          {paused
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill={C.text} style={{ marginLeft: 2 }}><path d="M5 3l14 9-14 9V3z" /></svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill={C.muted}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>}
        </button>
        <div style={{ textAlign: "right", marginLeft: 4, minWidth: 58 }}>
          <Mono style={{ color: C.muted, fontSize: 8, letterSpacing: "0.14em", display: "block" }}>{paused ? t("PAVZA") : t("PRETEČENO")}</Mono>
          <div style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 15, color: paused ? C.muted : C.text, lineHeight: 1.15, letterSpacing: "0.02em" }}>{fmtTime(elapsed)}</div>
        </div>
      </div>

      {lockDemo && <LockscreenDemo t={t} onClose={() => setLockDemo(false)} />}

      {/* exercise hero — the name is the screen */}
      <div style={{ marginBottom: 14 }}>
        <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em" }}>{t("TRENING")} {SESSION.no} · {ex.block} · {t(ex.cat)}</Mono>
        <h1 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 24, margin: "6px 0 0", color: C.text, letterSpacing: "-0.02em", textTransform: "uppercase", lineHeight: 1.05 }}>{t(ex.name)}</h1>
      </div>

      {/* sets · log */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 2px 9px" }}>
        <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em" }}>{t("SERIJE · DNEVNIK")}</Mono>
        <Mono style={{ color: C.muted, fontSize: 9 }}>{doneCount}/{exLogs.length} {t("KONČANO")}</Mono>
      </div>

      {/* current set — the dominant module */}
      {activeIdx >= 0 && (() => {
        const s = exLogs[activeIdx];
        const si = activeIdx;
        return (
          <div style={{ background: C.surface2, borderRadius: 18, padding: "14px 14px 15px", marginBottom: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: "0.02em" }}>{t("SERIJA")} {si + 1}</div>
                <Mono style={{ color: C.muted, fontSize: 9 }}>{t("CILJ")} · {ex.reps} {t("PON.")} {ex.load > 0 ? `@ ${ex.load} ${ex.unit}` : ""}</Mono>
              </div>
              <button onClick={() => setLog(si, { done: !s.done, reps: s.done ? s.reps : (s.reps || ex.reps) })}
                style={{ width: 48, height: 48, borderRadius: "50%", border: `1.5px solid ${C.accent}`, background: s.done ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={s.done ? C.btnText : C.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </button>
            </div>

            {/* reps — the big number */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em" }}>{t("PONOVITVE")}</Mono>
              <span><span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 54, color: s.reps > 0 ? C.text : C.muted, letterSpacing: "-0.02em", lineHeight: 1 }}>{s.reps}</span><span style={{ fontFamily: C.mono, fontSize: 11.5, color: C.muted }}> / {ex.reps}</span></span>
            </div>
            <div style={{ display: "flex", gap: 9, alignItems: "center", marginTop: 9 }}>
              <button style={{ width: 56, height: 50, borderRadius: 10, border: `1px dashed ${C.border2}`, background: "transparent", color: C.muted, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
                <span style={{ fontSize: 15.5, lineHeight: 1 }}>+</span><span style={{ fontFamily: C.mono, fontSize: 8 }}>{t("VIDEO")}</span>
              </button>
              <div style={{ flex: 1 }}>
                <RepsSlider value={s.reps} max={ex.reps} onChange={(v) => setLog(si, { reps: v })} accent={C.accent} track={C.surface3} knobText={C.btnText} dim={C.muted} />
              </div>
            </div>

            {/* load */}
            {ex.load > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, borderTop: `1px solid ${C.border}`, marginTop: 11, paddingTop: 14 }}>
                <Mono style={{ color: C.muted, fontSize: 9, width: 44, letterSpacing: "0.16em" }}>{t("TEŽA")}</Mono>
                <div style={{ flex: 1 }}><LoadStepper value={s.load} unit={ex.unit} onChange={(v) => setLog(si, { load: v })} C={C} /></div>
              </div>
            )}
          </div>
        );
      })()}

      {/* other sets — quiet hairline rows (tap the ring to reopen a set) */}
      <div style={{ marginBottom: 14 }}>
        {exLogs.map((s, si) => {
          if (si === activeIdx) return null;
          return (
            <div key={si} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 2px", borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted2, width: 22, flexShrink: 0 }}>{String(si + 1).padStart(2, "0")}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13, color: s.done ? C.text : C.text2 }}>{t("SERIJA")} {si + 1}</div>
                <Mono style={{ color: C.muted2, fontSize: 9 }}>{t("CILJ")} · {ex.reps} {t("PON.")} {ex.load > 0 ? `@ ${ex.load} ${ex.unit}` : ""}</Mono>
              </div>
              <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 15, color: s.done ? C.text : C.muted2, letterSpacing: "-0.01em" }}>{s.reps}<span style={{ fontFamily: C.mono, fontSize: 9, fontWeight: 400, color: C.muted2 }}> / {ex.reps}{ex.load > 0 ? ` · ${s.load} ${ex.unit}` : ""}</span></span>
              <button onClick={() => setLog(si, { done: !s.done, reps: s.done ? s.reps : (s.reps || ex.reps) })}
                style={{ width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${s.done ? C.accent : C.border2}`, background: s.done ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
                {s.done && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.btnText} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </button>
            </div>
          );
        })}

        {/* add set */}
        <button onClick={addSet} style={{ width: "100%", padding: "9px 2px", borderTop: `1px solid ${C.border}`, borderRight: "none", borderBottom: "none", borderLeft: "none", background: "transparent", color: C.muted, fontFamily: C.display, fontWeight: 700, fontSize: 12, cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
          + {t("DODAJ SERIJO")}
        </button>
      </div>

      {/* progression chart (only for the main lift) — secondary context */}
      {ex.chart && <Progression C={C} t={t} />}

      {/* exercise stats — tonnage + total reps, once every set is checked off
          (WHOOP-style pair of numbers sitting right under the chart). */}
      {ex.chart && exLogs.length > 0 && doneCount === exLogs.length && (() => {
        const tonnage = Math.round(exLogs.reduce((s, x) => s + x.reps * (x.load || 0), 0) * 10) / 10;
        const totalReps = exLogs.reduce((s, x) => s + x.reps, 0);
        return (
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, background: C.surface2, borderRadius: 16, padding: "13px 14px" }}>
              <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22, color: C.text, letterSpacing: "-0.01em" }}>{tonnage}</span>
              <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 600, color: C.muted, marginLeft: 4 }}>{ex.unit.toLowerCase()}</span>
              <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.14em", marginTop: 3, display: "block" }}>{t("TONAŽA")}</Mono>
            </div>
            <div style={{ flex: 1, background: C.surface2, borderRadius: 16, padding: "13px 14px" }}>
              <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22, color: C.text, letterSpacing: "-0.01em" }}>{totalReps}</span>
              <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.14em", marginTop: 3, display: "block" }}>{t("SKUPAJ PONOVITEV")}</Mono>
            </div>
          </div>
        );
      })()}

      {/* next exercise */}
      <Pressable onClick={nextExercise} style={{ width: "100%", height: 56, padding: 0, borderRadius: 15, border: "none", background: C.btn, color: C.btnText, fontFamily: C.display, fontWeight: 800, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: "0.02em" }}>
        {exIdx >= SESSION.block.length - 1 ? t("KONČAJ TRENING") : t("NASLEDNJA VAJA")} →
      </Pressable>
    </div>
  );
}

/* small block card used for warm-up / cool-down */
function BlockCard({ C, icon, title, info, onClick }) {
  return (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", background: C.surface2, border: "none", borderRadius: 16, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
      <span style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontFamily: C.display, fontWeight: 700, fontSize: 15, color: C.text, textTransform: "uppercase", letterSpacing: "0.02em" }}>{title}</span>
        <Mono style={{ color: C.muted, fontSize: 10 }}>{info}</Mono>
      </span>
      <span style={{ color: C.muted }}>›</span>
    </button>
  );
}
