import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../theme";
import { Pressable, Mono, SkeletonBlock } from "../components/UI";
import { IcCalendar } from "../components/Icons";
import {
  askAI, loadAiHistory, saveAiReply,
  loadCoachMemory, saveCoachMemory, saveCoachFeedback, addEvent, listWorkouts,
} from "../lib/api";
import { useT } from "../lib/i18n";
import ZeusFunnel from "./ZeusFunnel";
import { offlineCoachReply, planSessions } from "../lib/coachOffline";
import DailyCoachCard from "../components/daily-coach/DailyCoachCard";
import { getDailyCoachMetrics, todayIso as dailyCoachTodayIso } from "../components/daily-coach/getDailyCoachMetrics";

// Daily Coach shows once per day, per account, the first time the chat opens
// that day — tracked locally so re-opening the chat later the same day
// doesn't repeat it.
const dailyCoachShownKey = (userId) => `athlos:dailyCoachShown:${userId || "local"}`;

// Does this reply look like a weekly training plan (→ save to calendar)?
function looksLikePlan(t) {
  const s = (t || "").toLowerCase();
  const days = (s.match(/\b(ponedeljek|torek|sreda|[čc]etrtek|petek|sobota|nedelja|pon|tor|sre|pet)\b/g) || []).length;
  return days >= 2 || /teden|trening za|na[čc]rt treninga|tedenski plan/.test(s);
}

// Does the user's message ask to add a single event to the calendar?
function looksLikeSingleEventRequest(q) {
  const s = (q || "").toLowerCase();
  const hasDay = /\b(ponedeljek|torek|sreda|[čc]etrtek|petek|sobota|nedelja)\b/.test(s);
  const hasVerb = /\b(dodaj|vnesi|zabele[žz]i|shrani|postavi|zapi[šs]i)\b/.test(s);
  return hasDay && hasVerb;
}

// Extract a calendar event from a user message asking to add something on a day.
function extractSingleEvent(q) {
  const s = (q || "").toLowerCase();
  const dayMap = { "ponedeljek": 1, "torek": 2, "sreda": 3, "četrtek": 4, "cetrtek": 4, "petek": 5, "sobota": 6, "nedelja": 0 };
  for (const [word, targetDay] of Object.entries(dayMap)) {
    if (s.includes(word)) {
      const today = new Date();
      let daysUntil = (targetDay - today.getDay() + 7) % 7;
      if (daysUntil === 0) daysUntil = 7;
      const d = new Date(today);
      d.setDate(today.getDate() + daysUntil);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const isGame = /tekm|igr[ao]/.test(s);
      return { date, title: isGame ? "Tekma" : "Trening", type: isGame ? "tekma" : "trening" };
    }
  }
  return null;
}

// Dates (YYYY-MM-DD) for given weekday offsets (0=Mon) in the upcoming week (from next/this Monday).
function upcomingDates(dayIndexes) {
  const today = new Date();
  const daysUntilMon = (1 - today.getDay() + 7) % 7; // 0 if today is Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilMon);
  return dayIndexes.map((di) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + di);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

const SUGGESTIONS = [
  "Sestavi mi trening za ta teden",
  "Kako izboljšam regeneracijo?",
  "Imam bolečino v kolenu",
];


function SendIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function nowTime() {
  const n = new Date();
  return `${n.getHours()}:${String(n.getMinutes()).padStart(2, "0")}`;
}

// Minimal **bold** rendering — ZEUS's replies use it for emphasis, and
// showing the raw asterisks read as broken/unpolished.
function renderRich(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    return m ? <strong key={i}>{m[1]}</strong> : <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

// ZEUS greeting built from the learning memory — proves he "knows" the athlete.
function buildWelcome(memory, profile, fresh) {
  const name = profile?.name && profile.name !== "NIK" ? profile.name : "";
  const nm = name ? `, ${name}` : "";
  const s = (memory && memory.setup) || {};
  if (fresh) {
    const bits = [];
    if (s.goal) bits.push(`cilj ${s.goal}`);
    if (s.level) bits.push(`nivo ${s.level}`);
    if (s.seasonPhase) bits.push(`faza ${s.seasonPhase}`);
    const know = bits.length ? ` Poznam tvoj ${bits.join(", ")}.` : "";
    return `Aktiviran${nm}. Od zdaj te poznam in si te bom zapomnil.${know} Vprašaj me za prvi teden treninga — ali karkoli o treningu, prehrani in regeneraciji.`;
  }
  let g = `Spet tukaj${nm}.`;
  if (s.goal) g += ` Nadaljujeva s ciljem ${s.goal}${s.level ? ` (${s.level})` : ""}.`;
  g += " Kako gre?";
  return g;
}

// ── "Kako je šlo zadnjič?" — click feedback that feeds the learning memory ──
const PAIN_TAGS = ["Koleno", "Rama", "Spodnji hrbet", "Gleženj", "Drugje", "Brez"];
function FeedbackCard({ C, t, onSave, onSkip }) {
  const [rpe, setRpe] = useState(null);
  const [done, setDone] = useState(null);
  const [pain, setPain] = useState([]);
  const ok = rpe != null && done != null;
  const base = { fontFamily: C.display, fontSize: 13, cursor: "pointer", borderRadius: 999, transition: "all 0.15s", WebkitTapHighlightColor: "transparent" };
  const chip = (active, extra = {}) => ({ ...base, padding: "6px 9px", border: `1.5px solid ${active ? C.accent : C.border}`, background: active ? `${C.accent}16` : C.surface, color: active ? C.accent : C.text2, fontWeight: active ? 700 : 500, ...extra });
  const togglePain = (p) =>
    setPain((arr) => p === "Brez"
      ? (arr.includes("Brez") ? [] : ["Brez"])
      : (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr.filter((x) => x !== "Brez"), p]));
  const row = { fontFamily: C.display, fontSize: 12, color: C.text2, fontWeight: 600, marginBottom: 6 };
  const dark = C.name === "dark";
  return (
    <div style={{
      alignSelf: "stretch", borderRadius: 15, padding: "11px 11px 10px", margin: "2px 0",
      animation: "athlosMsgBot 0.32s cubic-bezier(0.22,1,0.36,1) both",
      background: dark ? C.surface : "#FFFFFF",
      border: `1px solid ${C.gold}44`,
    }}>
      <div style={{ fontFamily: C.heading, fontWeight: 700, fontSize: 15, color: C.text, letterSpacing: "0.02em" }}>{t("Kako je šlo zadnjič?")}</div>
      <div style={{ fontFamily: C.display, fontSize: 12, color: C.muted, marginTop: 2, marginBottom: 9 }}>{t("Da te ZEUS bolje pozna in nadgradi naslednji trening.")}</div>

      <div style={row}>{t("Napor (RPE 1–10)")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 9 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => setRpe(n)} style={chip(rpe === n, { minWidth: 34, textAlign: "center", padding: "6px 0" })}><span className="at-chip-lbl" data-text={String(n)}>{n}</span></button>
        ))}
      </div>

      <div style={row}>{t("Opravljeno")}</div>
      <div style={{ display: "flex", gap: 5, marginBottom: 9 }}>
        {[["Da", true], ["Delno", "delno"], ["Ne", false]].map(([l, v]) => (
          <button key={l} onClick={() => setDone(v)} style={chip(done === v)}><span className="at-chip-lbl" data-text={t(l)}>{t(l)}</span></button>
        ))}
      </div>

      <div style={row}>{t("Bolečina")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {PAIN_TAGS.map((p) => <button key={p} onClick={() => togglePain(p)} style={chip(pain.includes(p))}><span className="at-chip-lbl" data-text={t(p)}>{t(p)}</span></button>)}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11 }}>
        <button onClick={onSkip} style={{ background: "none", border: "none", color: C.muted, fontFamily: C.display, fontSize: 12, cursor: "pointer", letterSpacing: "0.04em" }}>{t("Preskoči")}</button>
        <Pressable
          onClick={() => ok && onSave({ rpe, completed: done !== false, pain: pain.filter((x) => x !== "Brez"), note: done === "delno" ? "delno opravljeno" : "" })}
          disabled={!ok} scale={0.96}
          style={{ background: ok ? C.btn : C.surface3, color: ok ? C.btnText : C.muted, border: "none", borderRadius: 999, padding: "8px 14px", fontFamily: C.display, fontWeight: 700, fontSize: 13 }}
        >
          {t("Shrani")}
        </Pressable>
      </div>
    </div>
  );
}

export default function ScreenAI({ user, profile }) {
  const C = useTheme();
  const t = useT();
  const dark = C.name === "dark";
  const [gate, setGate] = useState("loading");   // loading | funnel | chat
  const [memory, setMemory] = useState(null);
  const returningRef = useRef(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showSugg, setShowSugg] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [calSaving, setCalSaving] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const chatInit = useRef(false);

  // ── Dictation (green mic while the field is empty) — Web Speech API where
  // the browser has it; elsewhere the button stays a plain send arrow ──
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const canDictate = !!SR;
  const toggleMic = () => {
    if (!SR) return;
    if (listening) { try { recRef.current?.stop(); } catch { /* already stopped */ } return; }
    const rec = new SR();
    rec.lang = profile?.lang === "en" ? "en-US" : "sl-SI";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const txt = Array.from(e.results).map((r) => r[0].transcript).join(" ").trim();
      if (txt) setInput((p) => (p ? `${p} ${txt}` : txt));
      inputRef.current?.focus();
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };
  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* already stopped */ } }, []);

  // ── Attachment ("+" in the composer): image or PDF, sent to the AI as
  // base64 so ZEUS actually sees it (Claude/Gemini vision) ──
  const [attach, setAttach] = useState(null); // { name, mime, dataUrl, isImage }
  const fileRef = useRef(null);
  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    if (!isImage && f.type !== "application/pdf") {
      setMsgs((m) => [...m, { from: "bot", t: "Zaenkrat znam pogledati slike in PDF datoteke.", time: nowTime() }]);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setMsgs((m) => [...m, { from: "bot", t: "Priponka je prevelika — največ 5 MB.", time: nowTime() }]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttach({ name: f.name, mime: f.type, dataUrl: String(reader.result), isImage });
    reader.readAsDataURL(f);
  };

  // ── Gate: load the learning memory; no setup yet → funnel, else → chat ──
  useEffect(() => {
    let alive = true;
    setGate("loading");
    chatInit.current = false;
    (async () => {
      const mem = await loadCoachMemory(user?.id);
      if (!alive) return;
      setMemory(mem);
      const hasSetup = !!(mem && mem.setup && (mem.setup.goal || mem.setup.level || mem.setup.seasonPhase));
      returningRef.current = hasSetup;
      setGate(hasSetup ? "chat" : "funnel");
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // ── Init the chat once it opens: ZEUS greeting + restore history + feedback prompt ──
  useEffect(() => {
    if (gate !== "chat" || chatInit.current) return;
    chatInit.current = true;
    const fresh = !returningRef.current;
    const welcome = { from: "bot", t: buildWelcome(memory, profile, fresh), time: nowTime() };
    setMsgs([welcome]);
    setShowSugg(fresh);
    (async () => {
      try {
        const hist = await loadAiHistory(user?.id);
        if (Array.isArray(hist) && hist.length) {
          const restored = hist.map((m) => ({
            from: m.role === "user" ? "user" : "bot",
            t: m.content,
            time: m.created_at ? new Date(m.created_at).toLocaleTimeString("sl-SI", { hour: "numeric", minute: "2-digit" }) : "",
          }));
          setMsgs([welcome, ...restored]);
          setShowSugg(false);
        }
      } catch {}
    })();
    // Daily Coach — once per account per day, prepended above everything
    // else the first time the chat opens that day. Local-only marker (not a
    // real ai_messages row — it's not an LLM exchange), so functional
    // setState here is safe regardless of whether the history-restore above
    // finishes first.
    (async () => {
      let alreadyShown = false;
      try { alreadyShown = localStorage.getItem(dailyCoachShownKey(user?.id)) === dailyCoachTodayIso(); } catch {}
      if (alreadyShown) return;
      try {
        const { metrics, dateIso } = await getDailyCoachMetrics(user?.id);
        setMsgs((m) => [{ from: "bot", type: "daily-coach", metrics, dateIso, time: nowTime() }, ...m]);
        try { localStorage.setItem(dailyCoachShownKey(user?.id), dateIso); } catch {}
      } catch {}
    })();
    if (returningRef.current) {
      // "How did it go last time?" only makes sense once the athlete has
      // actually trained — completing the ZEUS funnel isn't a training
      // session. Without this check every returning user got asked about a
      // workout that never happened.
      (async () => {
        let hasTrained = false;
        try { hasTrained = (await listWorkouts(user?.id, 1)).length > 0; } catch {}
        if (!hasTrained) return;
        const fb = (memory && memory.feedback) || [];
        const last = fb[fb.length - 1];
        const stale = !last || (Date.now() - new Date(last.date).getTime() > 12 * 3600 * 1000);
        if (stale) setShowFeedback(true);
      })();
    }
  }, [gate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing, showFeedback]);

  const onFunnelDone = async (setup) => {
    const mem = { ...(memory || {}), setup, onboardedAt: new Date().toISOString() };
    try { await saveCoachMemory(user?.id, mem); } catch {}
    setMemory(mem);
    returningRef.current = false;
    chatInit.current = false;
    setGate("chat");
  };

  const onSaveFeedback = async (fb) => {
    try { const mem = await saveCoachFeedback(user?.id, fb); if (mem) setMemory(mem); } catch {}
    setShowFeedback(false);
    const painTxt = fb.pain?.length ? `, bolečina: ${fb.pain.join(", ")}` : "";
    setMsgs((m) => [...m, { from: "bot", t: `Zabeležil sem (RPE ${fb.rpe}${painTxt}). To upoštevam pri naslednjem treningu..`, time: nowTime() }]);
  };

  // Save this week's plan into the Koledar (season_events) — deterministic from memory.
  const saveToCalendar = async () => {
    const sessions = planSessions(memory);
    if (!sessions.length || calSaving) return;
    setCalSaving(true);
    const dates = upcomingDates(sessions.map((s) => s.dayIndex));
    try {
      for (let i = 0; i < sessions.length; i++) {
        await addEvent(user?.id, { type: "trening", title: sessions[i].title, date: dates[i], time: "17:00" });
      }
      setMsgs((m) => [...m, { from: "bot", t: `Dodal sem ${sessions.length} treningov v Koledar za prihodnji teden. Najdeš jih v zavihku Koledar — uredi termine po želji.`, time: nowTime() }]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", t: "Hmm, treningov nisem mogel shraniti v koledar. Poskusi še enkrat.", time: nowTime() }]);
    } finally {
      setCalSaving(false);
    }
  };

  // Memory-aware offline reply (demo mode) — ZEUS still uses goal/level/injuries/feedback.
  const demoReply = (q) => offlineCoachReply(q, memory, profile);

  const send = async (text) => {
    const q = (text || input).trim();
    const att = text ? null : attach; // suggestion chips send bare text
    if ((!q && !att) || typing) return;
    setShowSugg(false);
    setShowFeedback(false);
    const history = msgs.map((m) => ({
      role: m.from === "user" ? "user" : "assistant",
      content: m.t || (m.img ? "[slika]" : m.file ? `[datoteka: ${m.file}]` : ""),
    }));
    setMsgs((m) => [...m, { from: "user", t: q, img: att?.isImage ? att.dataUrl : null, file: att && !att.isImage ? att.name : null, time: nowTime() }]);
    setInput("");
    setAttach(null);
    setTyping(true);
    // the AI always gets a textual question; base64 payload rides along
    const question = q || (att?.isImage ? "Poglej priloženo sliko in komentiraj kot trener." : "Poglej priloženo datoteko in komentiraj kot trener.");
    const attachment = att ? { name: att.name, mime: att.mime, data: att.dataUrl.split(",")[1] } : null;
    try {
      // Real AI via the ai-coach Edge Function (server reads profile/memory
      // itself from the verified caller); null → local demo answers
      let finalText = await askAI(user?.id, question, history, attachment);
      if (!finalText) {
        finalText = att
          ? "Priponke si lahko ogledam šele, ko je povezan AI strežnik — do takrat mi jo opiši z besedami."
          : demoReply(q);
        saveAiReply(user?.id, finalText);
      }
      setMsgs((m) => [...m, { from: "bot", t: finalText, time: nowTime() }]);
      if (looksLikePlan(finalText) && memory?.setup) {
        saveToCalendar();
      } else if (looksLikeSingleEventRequest(q)) {
        const ev = extractSingleEvent(q);
        if (ev) {
          addEvent(user?.id, { type: ev.type, title: ev.title, date: ev.date, time: "17:00" })
            .then(() => setMsgs((m) => [...m, { from: "bot", t: `Dodal sem "${ev.title}" v Koledar. Najdeš ga v zavihku Koledar.`, time: nowTime() }]))
            .catch(() => {});
        }
      }
    } catch {
      setMsgs((m) => [...m, { from: "bot", t: demoReply(q), time: nowTime() }]);
    } finally {
      setTyping(false);
    }
  };

  // ── Gate renders ──
  if (gate === "loading") return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      {/* header skeleton */}
      <div style={{ flexShrink: 0, padding: "13px 13px 10px", borderBottom: `1px solid ${C.border}` }}>
        <SkeletonBlock width={104} height={30} radius={8} />
        <div style={{ marginTop: 8 }}><SkeletonBlock width={190} height={12} radius={5} /></div>
      </div>
      {/* chat bubbles skeleton */}
      <div style={{ flex: 1, overflow: "hidden", padding: "11px 13px", display: "flex", flexDirection: "column", gap: 11 }}>
        {[["l", "78%", 66], ["r", "58%", 44], ["l", "86%", 90], ["r", "48%", 40], ["l", "72%", 58]].map(([side, w, h], i) => (
          <div key={i} style={{ alignSelf: side === "r" ? "flex-end" : "flex-start", width: w }}>
            <SkeletonBlock width="100%" height={h} radius={16} />
          </div>
        ))}
      </div>
      {/* composer skeleton */}
      <div style={{ flexShrink: 0, padding: "8px 10px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 6, alignItems: "center" }}>
        <SkeletonBlock width="100%" height={44} radius={22} />
        <SkeletonBlock width={44} height={44} radius={999} />
      </div>
    </div>
  );
  if (gate === "funnel") return <ZeusFunnel onDone={onFunnelDone} profile={profile} />;

  // ── Chat ──
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, position: "relative", overflow: "hidden" }}>
      {/* Statue watermark — sits behind the whole chat (header + messages),
          the same quiet treatment as the bust watermark on Today, instead of
          a hard-edged image cropped into the header strip. */}
      <img src="/img/god-bolt.png" alt="" aria-hidden="true" style={{
        position: "absolute", top: -10, right: -70, height: 360, opacity: dark ? 0.06 : 0.05,
        filter: dark ? "invert(1)" : "none", pointerEvents: "none", userSelect: "none", zIndex: 0,
      }} />

      {/* Header — flat, calm bar. No image, no hard color edge, no kicker
          line above ZEUS. The status line doubles as the disclaimer, so
          there's no separate floating strip either. */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0, padding: "13px 13px 10px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: C.heading, fontWeight: 800, fontSize: 31.5, letterSpacing: "0.12em", color: C.text, lineHeight: 1 }}>ZEUS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: typing ? C.gold : C.accent2, boxShadow: typing ? "none" : `0 0 8px ${C.accent2}99`, flexShrink: 0 }} />
          <span style={{ fontFamily: C.display, fontSize: 12, fontWeight: 600, color: typing ? C.gold : C.muted }}>
            {typing ? t("razmišlja…") : t("ATHLOS AI · ni nadomestilo za zdravnika")}
          </span>
        </div>
      </div>

      {/* Messages — the same marble dialogue as human chat: ZEUS speaks in
          italic Cormorant on a marble tablet, your replies are engraved ink
          panels with a faint green "oracle" breath, like an answered oracle. */}
      <div ref={scrollRef} style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "9px 13px 6px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map((m, i) => {
          if (m.type === "daily-coach") {
            return (
              <div key={i} style={{ width: "100%", animation: "athlosMsgBot 0.32s cubic-bezier(0.22,1,0.36,1) both" }}>
                <DailyCoachCard metrics={m.metrics} t={t} userId={user?.id} dateIso={m.dateIso} />
              </div>
            );
          }
          const isMine = m.from === "user";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", animation: `${isMine ? "athlosMsgUser" : "athlosMsgBot"} 0.32s cubic-bezier(0.22,1,0.36,1) both` }}>
              <div style={{
                position: "relative", maxWidth: isMine ? "80%" : "88%", padding: "10px 11px", overflow: "hidden",
                borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: isMine
                  ? "#1C1814"
                  : (dark ? "rgba(255,255,255,0.07)" : "#FFFFFF"),
                border: isMine
                  ? "1px solid rgba(244,239,230,0.10)"
                  : `1px solid ${dark ? "rgba(255,255,255,0.10)" : "#D6DAE0"}`,
                boxShadow: isMine ? "0 6px 16px rgba(28,24,20,0.18)" : (dark ? "none" : "0 3px 10px rgba(28,24,20,0.05)"),
              }}>
                {m.img && (
                  <img src={m.img} alt="" style={{ display: "block", maxWidth: "100%", maxHeight: 260, borderRadius: 10, marginBottom: m.t ? 10 : 0, objectFit: "cover" }} />
                )}
                {m.file && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: m.t ? 10 : 0, padding: "6px 9px", borderRadius: 9, background: "rgba(255,255,255,0.08)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isMine ? "#F4EFE6" : C.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M13 2v7h7" /></svg>
                    <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 12, color: isMine ? "#F4EFE6" : C.text, wordBreak: "break-all" }}>{m.file}</span>
                  </span>
                )}
                {m.t && (
                  <span style={{
                    position: "relative", fontFamily: C.display, fontWeight: 500, fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap",
                    fontStyle: isMine ? "normal" : "italic",
                    color: isMine ? "#F4EFE6" : C.text,
                  }}>
                    {renderRich(t(m.t))}
                  </span>
                )}
              </div>
              <Mono style={{ fontSize: 8.5, color: C.muted2, marginTop: 4, letterSpacing: "0.1em" }}>{m.time}</Mono>
            </div>
          );
        })}

        {/* Saving to calendar — brief inline status while the auto-save runs */}
        {calSaving && (
          <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, border: `1px solid ${C.border2}`, color: C.muted, fontFamily: C.display, fontSize: 12, animation: "athlosFade 0.2s ease" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }} />
            <span style={{ display: "flex", color: C.gold }}><IcCalendar size={13} /></span> {t("Shranjujem v Koledar…")}
          </div>
        )}

        {/* Feedback card (returning athletes) */}
        {showFeedback && !typing && (
          <FeedbackCard C={C} t={t} onSave={onSaveFeedback} onSkip={() => setShowFeedback(false)} />
        )}

        {/* Typing dots — same marble tablet as a ZEUS reply */}
        {typing && (
          <div style={{ display: "flex", animation: "athlosFade 0.2s ease" }}>
            <div style={{
              padding: "11px 13px", borderRadius: "18px 18px 18px 4px", display: "flex", gap: 5, alignItems: "center",
              background: dark ? "rgba(255,255,255,0.07)" : "#FFFFFF",
              border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "#D6DAE0"}`,
            }}>
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, animation: "athlosDot 1.2s infinite", animationDelay: `${d}s`, display: "block" }} />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Quick prompts — chip rail directly above the composer (reference
          look): first chip is the featured one with the green outline */}
      {showSugg && !typing && (
        <div className="athlos-scroll" style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", padding: "4px 13px 8px", animation: "athlosFade 0.3s ease" }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={s} onClick={() => send(s)} style={{
              flexShrink: 0, padding: "8px 11px", borderRadius: 999, cursor: "pointer",
              border: `1.5px solid ${i === 0 ? C.accent : (dark ? C.border : "#D6DAE0")}`,
              background: i === 0 ? `${C.accent}10` : (dark ? C.surface2 : "rgba(255,255,255,0.6)"),
              color: i === 0 ? (dark ? C.accent : C.text) : C.text2,
              fontFamily: C.display, fontWeight: 600, fontSize: 12, whiteSpace: "nowrap",
              WebkitTapHighlightColor: "transparent",
            }}>
              {t(s)}
            </button>
          ))}
        </div>
      )}

      {/* Input — reference composer: "+" attaches an image/PDF for ZEUS to
          see, green circle sends (or dictates while everything is empty) */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0, padding: "0 13px 13px" }}>
        {/* pending attachment preview */}
        {attach && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 8px", borderRadius: 12, background: dark ? C.surface2 : "rgba(255,255,255,0.6)", border: `1px solid ${dark ? C.border : "#D6DAE0"}`, animation: "athlosFade 0.2s ease" }}>
            {attach.isImage
              ? <img src={attach.dataUrl} alt="" style={{ width: 40, height: 40, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
              : <span style={{ width: 40, height: 40, borderRadius: 9, background: `${C.accent}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M13 2v7h7" /></svg>
                </span>}
            <span style={{ flex: 1, minWidth: 0, fontFamily: C.display, fontWeight: 600, fontSize: 12, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{attach.name}</span>
            <button onClick={() => setAttach(null)} aria-label={t("Odstrani priponko")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 6, lineHeight: 0, WebkitTapHighlightColor: "transparent" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 6, background: dark ? C.surface2 : "rgba(255,255,255,0.55)", border: `1px solid ${dark ? C.border : "#D6DAE0"}`, borderRadius: 999 }}>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onPickFile} style={{ display: "none" }} />
          <Pressable
            onClick={() => fileRef.current?.click()}
            scale={0.86}
            aria-label={t("Priloži sliko ali datoteko")}
            style={{
              width: 38, height: 38, borderRadius: "50%", flexShrink: 0, border: "none",
              background: dark ? C.surface3 : "rgba(28,24,20,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </Pressable>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("Vprašaj ZEUS-a...")}
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontFamily: C.display, fontWeight: 500, fontSize: 15, lineHeight: 1 }}
          />
          <Pressable
            onClick={() => (input.trim() || attach ? send() : toggleMic())}
            scale={0.86}
            disabled={typing || (!input.trim() && !attach && !canDictate)}
            aria-label={input.trim() || attach ? t("Pošlji") : t("Narekovanje")}
            style={{
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0, border: "none",
              background: listening ? C.red : C.accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: typing || (!input.trim() && !attach && !canDictate) ? 0.4 : 1,
              boxShadow: `0 6px 16px ${listening ? C.red : C.accent}44`,
              transition: "background 0.2s, opacity 0.2s, box-shadow 0.2s",
            }}
          >
            {input.trim() || attach || !canDictate
              ? <SendIcon color={dark ? "#04130A" : "#FFFFFF"} />
              : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={dark ? "#04130A" : "#FFFFFF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
                  <path d="M5 11a7 7 0 0014 0M12 18v3.5" />
                </svg>}
          </Pressable>
        </div>
      </div>
    </div>
  );
}
