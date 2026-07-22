import React, { useState } from "react";
import { useTheme, useDatePicker, useTimePicker } from "../theme";
import { Pressable, PrimaryBtn, Mono, SkeletonBlock } from "../components/UI";
import ConfirmDialog from "../components/ConfirmDialog";
import { IcBall, IcBolt, IcTrash } from "../components/Icons";
import { listEvents, addEvent, deleteEvent, replaceEvents } from "../lib/api";
import { useT, useLang } from "../lib/i18n";

export const DAY_NAMES = ["PON", "TOR", "SRE", "ČET", "PET", "SOB", "NED"];
export const DAY_NAMES_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function isoOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayIdx(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return (d.getDay() + 6) % 7;
}

export function fmtDate(dateStr, lang = "sl") {
  const d = new Date(dateStr + "T00:00:00");
  const months = lang === "en"
    ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    : ["jan","feb","mar","apr","maj","jun","jul","avg","sep","okt","nov","dec"];
  return `${d.getDate()}. ${months[d.getMonth()]}`;
}

export const evColor = (C, type) => ({ trening: C.accent, tekma: C.red, recovery: C.yellow, peak: C.gold, "season-start": C.gold2, "season-end": C.gold2 }[type]);
export const EV_LABEL = { trening: "TRENING", tekma: "TEKMA", recovery: "REGENERACIJA", peak: "PEAK TEDEN", "season-start": "ZAČETEK SEZONE", "season-end": "KONEC SEZONE" };
// Marker types have no time-of-day — they render as all-day markers (spec §05).
export const MARKER_TYPES = ["peak", "season-start", "season-end"];

export function addDaysISO(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Peak-season ranges [{start,end}] from peak events (ev.days = span, default 7).
export function peakRanges(events) {
  return events.filter((e) => e.type === "peak").map((e) => ({ start: e.date, end: addDaysISO(e.date, (e.days || 7) - 1) }));
}
export const inRanges = (iso, ranges) => ranges.some((r) => iso >= r.start && iso <= r.end);

// Apple/Google Calendar export (spec §05 · Sinhronizacija).
export function buildICS(events) {
  const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ATHLOS//Koledar//SL"];
  events.forEach((ev) => {
    const dt = ev.date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:athlos-${ev.id}@athl-os.com`, `DTSTAMP:${dt}T000000`);
    if (MARKER_TYPES.includes(ev.type)) {
      lines.push(`DTSTART;VALUE=DATE:${dt}`);
      if (ev.type === "peak") lines.push(`DTEND;VALUE=DATE:${addDaysISO(ev.date, ev.days || 7).replace(/-/g, "")}`);
    } else {
      lines.push(`DTSTART:${dt}T${(ev.time || "12:00").replace(":", "")}00`);
    }
    const extra = ev.type === "tekma" && ev.opponent ? ` vs ${ev.opponent}` : "";
    lines.push(`SUMMARY:${esc((ev.title || EV_LABEL[ev.type]) + extra)}`);
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(events) {
  const blob = new Blob([buildICS(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "athlos-koledar.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const MOBILITY = {
  "Nogomet": "Mobilnost kolkov + raztezanje zadnje lože",
  "Košarka": "Gleženj + skočna mobilnost, raztezanje mečnic",
  "Hokej": "Odpiranje kolkov + spodnji hrbet",
  "Tek / Atletika": "Raztezanje mečnic, kolkov in fleksorjev",
  "Tenis": "Rama + rotacija trupa, zapestja",
  "Plavanje": "Mobilnost ramen + prsna hrbtenica",
  "Kolesarstvo": "Razbremenitev kolkov + spodnji hrbet",
  "Fitnes / Moč": "Splošna mobilnost + valjanje mišic",
};

function mobilityFor(sport) {
  return MOBILITY[sport] || "Lahka mobilnost + raztezanje za tvoj šport";
}

function Legend({ color, label }) {
  const C = useTheme();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.muted, fontFamily: C.mono, fontWeight: 500, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

function AddEventForm({ onAdd, onCancel }) {
  const C = useTheme();
  const t = useT();
  const lang = useLang();
  const openDP = useDatePicker();
  const openTP = useTimePicker();
  const [type, setType] = useState("trening");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(isoOffset(0));
  const [time, setTime] = useState("17:00");
  const [location, setLocation] = useState("");
  const [opponent, setOpponent] = useState("");
  const [days, setDays] = useState(7);
  const isMarker = MARKER_TYPES.includes(type);
  const submit = () => {
    const fallback = EV_LABEL[type].charAt(0) + EV_LABEL[type].slice(1).toLowerCase();
    onAdd({
      type, title: title.trim() || fallback, date, time: isMarker ? "" : time,
      ...(type === "tekma" ? { location: location.trim(), opponent: opponent.trim() } : {}),
      ...(type === "peak" ? { days: Math.max(1, +days || 7) } : {}),
    });
  };
  const inputStyle = { width: "100%", padding: "9px 11px", minHeight: 50, borderRadius: 15, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontFamily: C.display, fontWeight: 600, fontSize: 15, outline: "none", boxSizing: "border-box", colorScheme: C.name === "dark" ? "dark" : "light" };
  const labelStyle = { display: "block", fontFamily: C.mono, fontWeight: 500, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted };
  return (
    <div style={{ background: C.surface, borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: C.name === "dark" ? "0 1px 2px rgba(0,0,0,0.35)" : "0 2px 10px rgba(16,24,40,0.05)", animation: "athlosFade 0.2s ease" }}>
      <span style={labelStyle}>{t("TIP")}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 11px" }}>
        {["trening", "tekma", "recovery", "peak", "season-start", "season-end"].map((ty) => (
          <button key={ty} onClick={() => setType(ty)} style={{ flex: "1 0 30%", padding: "8px 4px", borderRadius: 10, border: `1px solid ${type === ty ? C.border2 : "transparent"}`, background: type === ty ? C.surface3 : C.surface2, color: type === ty ? C.text : C.muted, fontFamily: C.display, fontSize: 12, textTransform: "lowercase", fontWeight: type === ty ? 700 : 500, cursor: "pointer", transition: "background 0.15s, color 0.15s" }}>{t(EV_LABEL[ty])}</button>
        ))}
      </div>
      {!isMarker && (
        <>
          <span style={labelStyle}>{t("NAZIV")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("npr. Moč · spodnji del")} style={{ ...inputStyle, marginTop: 6, marginBottom: 11 }} />
        </>
      )}
      {type === "tekma" && (
        <div style={{ display: "flex", gap: 9, marginBottom: 11, animation: "athlosFade 0.2s ease" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={labelStyle}>{t("NASPROTNIK")}</span>
            <input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder={t("npr. NK Bravo")} style={{ ...inputStyle, marginTop: 6 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={labelStyle}>{t("LOKACIJA")}</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("npr. Doma")} style={{ ...inputStyle, marginTop: 6 }} />
          </div>
        </div>
      )}
      {type === "peak" && (
        <div style={{ marginBottom: 11, animation: "athlosFade 0.2s ease" }}>
          <span style={labelStyle}>{t("TRAJANJE (DNI)")}</span>
          <input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric" style={{ ...inputStyle, marginTop: 6 }} />
          <span style={{ display: "block", fontFamily: C.display, fontSize: 11.5, lineHeight: 1.5, color: C.muted, marginTop: 6 }}>{t("Razpon dni, ko moraš biti najbolj pripravljen — v koledarju označen rumeno.")}</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 9, marginBottom: 11 }}>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>{t("DATUM")}</span>
          <button
            onClick={() => openDP && openDP({ value: date, onChange: (v) => setDate(v), futureDays: 14 })}
            style={{
              width: "100%", marginTop: 6, padding: "9px 11px", minHeight: 50,
              borderRadius: 15, border: `1px solid ${C.border}`,
              background: C.surface2, color: C.text,
              fontFamily: C.display, fontWeight: 600, fontSize: 14,
              textAlign: "left", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span>{fmtDate(date, lang)}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>
            </svg>
          </button>
        </div>
        {!isMarker && (
        <div style={{ width: 110 }}>
          <span style={labelStyle}>{t("URA")}</span>
          <button
            onClick={() => openTP && openTP({ value: time, onChange: (v) => setTime(v) })}
            style={{
              width: "100%", marginTop: 6, padding: "9px 11px", minHeight: 50,
              borderRadius: 15, border: `1px solid ${C.border}`,
              background: C.surface2, color: C.text,
              fontFamily: C.display, fontWeight: 600, fontSize: 14,
              textAlign: "center", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span>{time}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
            </svg>
          </button>
        </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Pressable onClick={onCancel} scale={0.97} style={{ flex: 1, padding: 15, borderRadius: 15, border: `1px solid ${C.border}`, background: C.surface2, color: C.text2, fontFamily: C.display, fontSize: 14, fontWeight: 700 }}>{t("Prekliči")}</Pressable>
        <PrimaryBtn onClick={submit} style={{ flex: 1 }}>{t("Dodaj")}</PrimaryBtn>
      </div>
    </div>
  );
}

function AiPlanForm({ sport, onPlan, onCancel }) {
  const C = useTheme();
  const t = useT();
  const lang = useLang();
  const DAYS = lang === "en" ? DAY_NAMES_EN : DAY_NAMES;
  const [days, setDays] = useState([0, 2, 4]);
  const [from, setFrom] = useState("16:00");
  const [to, setTo] = useState("20:00");
  const [matchDate, setMatchDate] = useState("");
  const [fillRest, setFillRest] = useState(false);
  const [loading, setLoading] = useState(false);
  const toggleDay = (i) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  const generate = () => {
    if (days.length === 0) return;
    setLoading(true);
    setTimeout(() => {
      const evs = [];
      let id = 1;
      const trainings = ["Moč · spodnji del", "Moč · zgornji del", "Eksplozivnost", "Hitrost + tehnika", "Volumen"];
      let ti = 0;
      for (let off = 0; off < 14; off++) {
        const iso = isoOffset(off);
        const wd = dayIdx(iso);
        const isMatch = matchDate && iso === matchDate;
        const dayBeforeMatch = matchDate && isoOffset(off + 1) === matchDate;
        const dayAfterMatch = matchDate && isoOffset(off - 1) === matchDate;
        if (isMatch) {
          evs.push({ id: id++, date: iso, type: "tekma", title: "Tekma", time: "19:00" });
        } else if (dayAfterMatch) {
          evs.push({ id: id++, date: iso, type: "recovery", title: "Regeneracija po tekmi", time: from });
        } else if (days.includes(wd)) {
          if (dayBeforeMatch) {
            evs.push({ id: id++, date: iso, type: "trening", title: "Aktivacija (pred tekmo)", time: from });
          } else {
            evs.push({ id: id++, date: iso, type: "trening", title: trainings[ti % trainings.length], time: from });
            ti++;
          }
        } else if (fillRest) {
          evs.push({ id: id++, date: iso, type: "recovery", title: mobilityFor(sport), time: from });
        }
      }
      onPlan(evs);
      setLoading(false);
    }, 1100);
  };
  const dateStyle = { width: "100%", marginTop: 6, padding: "9px 11px", minHeight: 50, borderRadius: 15, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontFamily: C.display, fontWeight: 600, fontSize: 15, outline: "none", boxSizing: "border-box", colorScheme: C.name === "dark" ? "dark" : "light", WebkitAppearance: "none", appearance: "none" };
  const labelStyle = { display: "block", fontFamily: C.mono, fontWeight: 500, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted };
  return (
    <div style={{ background: C.surface, borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: C.name === "dark" ? "0 1px 2px rgba(0,0,0,0.35)" : "0 2px 10px rgba(16,24,40,0.05)", animation: "athlosFade 0.2s ease" }}>
      <p style={{ margin: "0 0 11px", fontFamily: C.display, color: C.text2, fontSize: 13, lineHeight: 1.55 }}>{t("Povej kdaj imaš čas in kdaj je tekma — AI sestavi optimalen 2-tedenski urnik.")}</p>
      <span style={labelStyle}>{t("KATERE DNEVE LAHKO TRENIRAŠ")}</span>
      <div style={{ display: "flex", gap: 5, margin: "8px 0 11px" }}>
        {DAYS.map((dn, i) => {
          const on = days.includes(i);
          return (
            <button key={i} onClick={() => toggleDay(i)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: `1px solid ${on ? C.border2 : "transparent"}`, background: on ? C.surface3 : C.surface2, color: on ? C.text : C.muted, fontFamily: C.display, fontSize: 12, textTransform: "lowercase", cursor: "pointer", fontWeight: on ? 700 : 500, transition: "background 0.15s, color 0.15s" }}>{dn}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 9, marginBottom: 11 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={labelStyle}>{t("OD KDAJ")}</span>
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} style={dateStyle} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={labelStyle}>{t("DO KDAJ")}</span>
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} style={dateStyle} />
        </div>
      </div>
      <span style={labelStyle}>{t("DATUM TEKME (NEOBVEZNO)")}</span>
      <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} style={{ ...dateStyle, marginBottom: 11 }} />
      {days.length < 7 && (
        <button onClick={() => setFillRest((v) => !v)}
          style={{ width: "100%", textAlign: "left", display: "flex", gap: 9, alignItems: "flex-start", padding: 16, marginBottom: 11, borderRadius: 15, cursor: "pointer", border: `1px solid ${fillRest ? C.border2 : "transparent"}`, background: C.surface2, transition: "background 0.15s", WebkitTapHighlightColor: "transparent" }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1, border: `1.5px solid ${fillRest ? C.accent : C.border2}`, background: fillRest ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>
            {fillRest && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.btnText} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
          </span>
          <span>
            <span style={{ display: "block", fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text }}>{t("Izkoristi proste dni")}</span>
            <span style={{ display: "block", color: C.muted, fontSize: 12, lineHeight: 1.45, marginTop: 3 }}>
              {t("Na proste dni dodam lahke")} <strong style={{ color: C.text2 }}>{t("raztezne in mobilnostne vaje")}</strong> {t("za")} {sport || t("tvoj šport")}.
            </span>
          </span>
        </button>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Pressable onClick={onCancel} scale={0.97} style={{ flex: 1, padding: 15, borderRadius: 15, border: `1px solid ${C.border}`, background: C.surface2, color: C.text2, fontFamily: C.display, fontSize: 14, fontWeight: 700 }}>{t("Prekliči")}</Pressable>
        <PrimaryBtn onClick={generate} style={{ flex: 1, opacity: days.length === 0 ? 0.5 : 1 }}>{loading ? t("Generiram…") : t("Generiraj urnik")}</PrimaryBtn>
      </div>
    </div>
  );
}

// ── Calendar helpers ─────────────────────────────────────────
const MONTHS_SL = ["Januar","Februar","Marec","April","Maj","Junij","Julij","Avgust","September","Oktober","November","December"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getWeekDates(offset = 0) {
  const today = new Date();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startIdx = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  // prev-month trailing days
  for (let i = startIdx - 1; i >= 0; i--) {
    const d = new Date(year, month, 0 - i);
    cells.push({ iso: d.toISOString().slice(0, 10), outside: true });
  }
  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`, outside: false });
  }
  // next-month leading days
  let next = 1;
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, next++);
    cells.push({ iso: d.toISOString().slice(0, 10), outside: true });
  }
  return cells;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }


// ── Weekly view ───────────────────────────────────────────────
function WeekView({ C, t, lang, weekOffset, setWeekOffset, events, onDelete, onAddManual }) {
  const BAR_LABELS = lang === "en" ? ["M","T","W","T","F","S","S"] : ["P","T","S","Č","P","S","N"];
  const DAYS_FULL = lang === "en" ? DAY_NAMES_EN : DAY_NAMES;
  const MONTHS_SH = lang === "en"
    ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    : ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Avg","Sep","Okt","Nov","Dec"];

  const dates = getWeekDates(weekOffset);
  const today = todayISO();

  // Selected day inside the visible week. Derived (not synced via effect) so
  // that navigating weeks can never strand the selection off-screen: it falls
  // back to today when visible, else Monday.
  const [pickedDate, setPickedDate] = useState(null);
  const selected = pickedDate && dates.includes(pickedDate)
    ? pickedDate
    : dates.includes(today) ? today : dates[0];

  const mon = new Date(dates[0] + "T00:00:00");
  const sun = new Date(dates[6] + "T00:00:00");
  const rangeLabel = mon.getMonth() === sun.getMonth()
    ? `${MONTHS_SH[mon.getMonth()]} ${mon.getDate()} – ${sun.getDate()}`
    : `${MONTHS_SH[mon.getMonth()]} ${mon.getDate()} – ${MONTHS_SH[sun.getMonth()]} ${sun.getDate()}`;

  const weekEvs = events.filter(e => dates.includes(e.date));
  const peaks = peakRanges(events);
  const weekInPeak = dates.some((iso) => inRanges(iso, peaks));

  // Plain-language summary — how many of what, no load jargon.
  const countOf = (ty) => weekEvs.filter(e => e.type === ty).length;
  const summary = [
    ["trening", countOf("trening"), C.accent],
    ["tekma", countOf("tekma"), C.red],
    ["recovery", countOf("recovery"), C.yellow],
  ].filter(([, n]) => n > 0);

  const dayEvsOf = (iso) => events.filter(e => e.date === iso).sort((a, b) => (a.time < b.time ? -1 : 1));
  const selEvs = dayEvsOf(selected);
  // Featured = the day's headline: a match wins over everything, else first by time.
  const featured = selEvs.find(e => e.type === "tekma") || selEvs[0] || null;
  const restSelEvs = featured ? selEvs.filter(e => e.id !== featured.id) : [];
  const laterDates = dates.slice(dates.indexOf(selected) + 1);
  const selInPeak = inRanges(selected, peaks);

  const evMeta = (ev) =>
    (MARKER_TYPES.includes(ev.type) ? t(EV_LABEL[ev.type]) : ev.time) +
    (ev.type === "tekma" && ev.opponent ? ` · vs ${ev.opponent}` : "") +
    (ev.type === "tekma" ? ` · ${ev.location || t("Doma")}` : "");

  const statLabel = { display: "block", color: C.muted, fontFamily: C.mono, fontWeight: 500, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 5 };
  const doneBadge = (size) => (
    <span style={{ width: size, height: size, borderRadius: "50%", background: C.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={C.btnText} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </span>
  );

  // One timeline entry per event — thin line + dot + text, no card boxes.
  const TimelineEvent = (ev) => {
    const color = evColor(C, ev.type) || C.accent;
    const done = !!ev.completed;
    return (
      <div key={ev.id} style={{ position: "relative", padding: "7px 0", display: "flex", alignItems: "flex-start", gap: 9 }}>
        <span style={{ position: "absolute", left: -20, top: 14, width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 0 3px ${C.bg}` }} />
        <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.06em", width: 42, flexShrink: 0, marginTop: 3 }}>
          {MARKER_TYPES.includes(ev.type) ? "" : ev.time}
        </Mono>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text, textDecoration: done ? "line-through" : "none" }}>{ev.title}</span>
          <Mono style={{ display: "block", color: C.muted, fontSize: 9, marginTop: 2 }}>{evMeta(ev)}</Mono>
        </div>
        {done && doneBadge(16)}
        <button onClick={() => onDelete(ev.id)} style={{ background: "none", border: "none", color: C.muted2, fontSize: 16, cursor: "pointer", padding: "2px", lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>
    );
  };

  return (
    <div>
      {/* Week nav — centered, calm */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "5px 8px 5px 0", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 15.5, letterSpacing: "0.04em", color: C.text, textTransform: "uppercase" }}>{rangeLabel}</div>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={{ background: "none", border: "none", padding: "3px 5px", color: C.muted, fontFamily: C.mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              ↺ {t("nazaj na danes")}
            </button>
          )}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "5px 0 5px 8px", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Week selector — 7 compact day pills, selected = the one green element */}
      <div style={{ display: "flex", gap: 5, overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "4px 0 5px", marginBottom: 8 }}>
        {dates.map((iso, i) => {
          const isSel = iso === selected;
          const isToday = iso === today;
          const d = new Date(iso + "T00:00:00");
          const hasEvents = events.some(e => e.date === iso);
          return (
            <button key={iso} onClick={() => setPickedDate(iso)} style={{
              flex: "1 0 42px", minWidth: 42, padding: "8px 0 6px",
              borderRadius: 14, cursor: "pointer",
              border: isToday && !isSel ? `1px solid ${C.border2}` : "1px solid transparent",
              background: isSel ? C.btn : C.surface2,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              transform: isSel ? "scale(1.08)" : "none",
              transition: "transform 0.15s, background 0.15s",
              WebkitTapHighlightColor: "transparent",
            }}>
              <span style={{ fontFamily: C.mono, fontWeight: 500, fontSize: 8.5, letterSpacing: "0.16em", color: isSel ? C.btnText : C.muted2 }}>{BAR_LABELS[i]}</span>
              <span style={{ fontFamily: C.display, fontWeight: isSel ? 800 : 600, fontSize: isSel ? 18 : 15.5, lineHeight: 1, color: isSel ? C.btnText : C.text }}>{d.getDate()}</span>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: hasEvents ? (isSel ? C.btnText : C.muted) : "transparent" }} />
            </button>
          );
        })}
      </div>

      {/* at-a-glance summary: quiet mono line, dots are the legend */}
      {(summary.length > 0 || weekInPeak) && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          {summary.map(([ty, n, col]) => (
            <span key={ty} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />
              <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>{n}× {t(EV_LABEL[ty])}</Mono>
            </span>
          ))}
          {weekInPeak && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold }} />
              <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>{t("PEAK TEDEN")}</Mono>
            </span>
          )}
        </div>
      )}

      {/* Featured card — the selected day's headline event, elevated */}
      {featured ? (
        <div style={{ background: C.surface2, borderRadius: 18, padding: "15px 15px 14px", marginBottom: 18, boxShadow: C.name === "dark" ? "0 1px 2px rgba(0,0,0,0.35)" : "0 2px 10px rgba(16,24,40,0.05)", animation: "athlosFade 0.2s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: evColor(C, featured.type) || C.accent, flexShrink: 0 }} />
              <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>{t(EV_LABEL[featured.type])}</Mono>
            </span>
            <Mono style={{ color: C.muted2, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", flexShrink: 0 }}>
              {fmtDate(selected, lang)}{selected === today ? ` · ${t("danes")}` : ""}
            </Mono>
          </div>
          <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em", lineHeight: 1.15, color: C.text, marginTop: 9, textDecoration: featured.completed ? "line-through" : "none" }}>
            {featured.title}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: 13, flexWrap: "wrap" }}>
            {!MARKER_TYPES.includes(featured.type) && (
              <div>
                <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", lineHeight: 1, color: C.text }}>{featured.time}</div>
                <Mono style={statLabel}>{t("URA")}</Mono>
              </div>
            )}
            {featured.type === "peak" && (
              <div>
                <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", lineHeight: 1, color: C.text }}>{featured.days || 7}</div>
                <Mono style={statLabel}>{t("TRAJANJE (DNI)")}</Mono>
              </div>
            )}
            {featured.type === "tekma" && featured.opponent && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, lineHeight: 1.1, color: C.text }}>{featured.opponent}</div>
                <Mono style={statLabel}>{t("NASPROTNIK")}</Mono>
              </div>
            )}
            {featured.type === "tekma" && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, lineHeight: 1.1, color: C.text }}>{featured.location || t("Doma")}</div>
                <Mono style={statLabel}>{t("LOKACIJA")}</Mono>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 13, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            {featured.type === "tekma" && <Mono style={{ color: C.red, fontSize: 8.5, letterSpacing: "0.16em" }}>{t("DAN TEKME")}</Mono>}
            {selInPeak && <Mono style={{ color: C.gold, fontSize: 8.5, letterSpacing: "0.16em" }}>{t("PEAK TEDEN")}</Mono>}
            {!!featured.completed && doneBadge(18)}
            <span style={{ flex: 1 }} />
            <button onClick={() => onDelete(featured.id)} style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`, background: "transparent", color: C.muted2, fontSize: 16, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
          </div>
        </div>
      ) : (
        <button onClick={onAddManual} style={{ width: "100%", textAlign: "left", background: C.surface2, border: `1px dashed ${C.border2}`, borderRadius: 18, padding: 22, marginBottom: 18, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, WebkitTapHighlightColor: "transparent" }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", border: `1px dashed ${C.border2}`, color: C.muted2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, lineHeight: 1, flexShrink: 0 }}>+</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: C.display, fontStyle: "italic", fontWeight: 600, fontSize: 15, color: C.muted2 }}>
              {t("Prost dan")}{selInPeak ? ` · ${t("PEAK TEDEN")}` : ""}
            </span>
            <Mono style={{ display: "block", color: C.muted2, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 4 }}>
              {fmtDate(selected, lang)}{selected === today ? ` · ${t("danes")}` : ""}
            </Mono>
          </span>
        </button>
      )}

      {/* Timeline — rest of the selected day, then the days after it: thin
          line + dots + text, no card boxes. Rest days are one quiet entry. */}
      {(restSelEvs.length > 0 || laterDates.length > 0) && (
        <div style={{ position: "relative", marginLeft: 4, paddingLeft: 20 }}>
          <div style={{ position: "absolute", left: 3, top: 10, bottom: 12, width: 1, background: C.border }} />
          {restSelEvs.map(TimelineEvent)}
          {laterDates.map((iso) => {
            const dayEvs = dayEvsOf(iso);
            const inPeak = inRanges(iso, peaks);
            const dayLabel = `${DAYS_FULL[dayIdx(iso)]} · ${fmtDate(iso, lang)}`;
            return (
              <div key={iso}>
                <Mono style={{ display: "block", color: C.muted2, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", padding: "10px 0 4px" }}>{dayLabel}</Mono>
                {dayEvs.length === 0 ? (
                  <div style={{ position: "relative", padding: "5px 0" }}>
                    <span style={{ position: "absolute", left: -20, top: 11, width: 7, height: 7, borderRadius: "50%", border: `1px solid ${C.border2}`, background: C.bg, boxSizing: "border-box", boxShadow: `0 0 0 3px ${C.bg}` }} />
                    <button onClick={onAddManual} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                      <span style={{ fontFamily: C.display, fontStyle: "italic", fontSize: 13.5, color: C.muted2 }}>
                        {t("Prost dan")}{inPeak ? ` · ${t("PEAK TEDEN")}` : ""}
                      </span>
                    </button>
                  </div>
                ) : (
                  dayEvs.map(TimelineEvent)
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Monthly view ──────────────────────────────────────────────
function MonthView({ C, t, lang, monthOffset, setMonthOffset, events, onDelete }) {
  const DAY_LETTERS = lang === "en" ? ["M","T","W","T","F","S","S"] : ["P","T","S","Č","P","S","N"];
  const MONTHS = lang === "en" ? MONTHS_EN : MONTHS_SL;
  const today = todayISO();
  const [selectedDate, setSelectedDate] = useState(null);

  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const cells = getMonthGrid(year, month);
  const peaks = peakRanges(events); // yellow band per spec §05

  const selectedEvs = selectedDate
    ? events.filter(e => e.date === selectedDate).sort((a, b) => a.time < b.time ? -1 : 1)
    : [];

  return (
    <div>
      {/* Header: big month name + year + nav arrows */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 24, color: C.text, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{MONTHS[month]}</div>
          <Mono style={{ display: "block", fontSize: 9, letterSpacing: "0.16em", color: C.muted, marginTop: 4 }}>{year}</Mono>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4 }}>
          <button onClick={() => setMonthOffset(m => m - 1)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "5px 6px", lineHeight: 1, display: "flex", alignItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={() => setMonthOffset(m => m + 1)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "5px 6px", lineHeight: 1, display: "flex", alignItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      {/* Day letter headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
        {DAY_LETTERS.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontFamily: C.mono, fontWeight: 500, fontSize: 9, letterSpacing: "0.16em", color: C.muted, padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid — no container box, cells float on page bg */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 14 }}>
        {cells.map(({ iso, outside }, idx) => {
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const dayEvs = outside ? [] : events.filter(e => e.date === iso);
          const inPeak = !outside && inRanges(iso, peaks);
          const d = new Date(iso + "T00:00:00");
          return (
            <button key={idx} onClick={() => !outside && setSelectedDate(isSelected ? null : iso)} style={{
              background: inPeak ? `${C.gold}0f` : "none", border: "none", cursor: outside ? "default" : "pointer",
              padding: "8px 0 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              WebkitTapHighlightColor: "transparent",
            }}>
              {/* Date circle — today = single green fill, selected = subtle green */}
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isToday ? C.btn : isSelected ? `${C.accent}14` : "transparent",
                border: isSelected && !isToday ? `1px solid ${C.accent}40` : "none",
              }}>
                <span style={{
                  fontFamily: C.display,
                  fontWeight: isToday || isSelected ? 700 : 500,
                  fontSize: 14,
                  color: isToday ? C.btnText : outside ? C.muted2 : isSelected ? C.accent : C.text,
                }}>
                  {d.getDate()}
                </span>
              </div>
              {/* One dot per event */}
              <div style={{ display: "flex", gap: 2, justifyContent: "center", minHeight: 6 }}>
                {dayEvs.map((ev, ei) => (
                  <span key={ei} style={{
                    width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                    background: evColor(C, ev.type) || C.accent,
                    display: "inline-block",
                  }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend (spec §05 mockup: trening · tekma · peak teden) */}
      <div style={{ display: "flex", gap: 11, marginBottom: 11, textTransform: "lowercase", flexWrap: "wrap" }}>
        <Legend color={C.accent} label={t("TRENING")} />
        <Legend color={C.red} label={t("TEKMA")} />
        <Legend color={C.gold} label={t("PEAK TEDEN")} />
      </div>

      {/* Selected day events */}
      {selectedDate && (
        <div style={{ marginTop: 4, marginBottom: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
            <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text }}>{fmtDate(selectedDate, lang)}</span>
            {selectedDate === today && <Mono style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.accent }}>{t("danes")}</Mono>}
          </div>
          {selectedEvs.length === 0
            ? <div style={{ fontFamily: C.display, fontSize: 13, color: C.muted2 }}>{t("Ni treningov")}</div>
            : selectedEvs.map(ev => {
                const color = evColor(C, ev.type) || C.accent;
                const done = !!ev.completed;
                return (
                  <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 9, background: C.surface2, borderRadius: 15, marginBottom: 6, padding: "10px 11px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text, textDecoration: done ? "line-through" : "none" }}>{ev.title}</div>
                      <div style={{ fontFamily: C.mono, fontSize: 10, letterSpacing: "0.06em", color: C.muted, marginTop: 4 }}>
                        {MARKER_TYPES.includes(ev.type) ? t(EV_LABEL[ev.type]) : `${t("ob")} ${ev.time}`}
                        {ev.type === "tekma" && ev.opponent ? ` · vs ${ev.opponent}` : ""}
                        {ev.type === "tekma" ? ` · ${ev.location || t("Doma")}` : ""}
                      </div>
                    </div>
                    {done && <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.btnText} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>}
                    <button onClick={() => onDelete(ev.id)} style={{ background: "none", border: "none", color: C.muted2, fontSize: 22.5, cursor: "pointer", padding: "4px 2px", lineHeight: 1 }}>×</button>
                  </div>
                );
              })
          }
        </div>
      )}
    </div>
  );
}

export default function ScreenSeason({ profile, user }) {
  const C = useTheme();
  const t = useT();
  const lang = useLang();
  const [mode, setMode] = useState("list");       // "list" | "add" | "ai"
  const [calView, setCalView] = useState("week"); // "week" | "month"
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listEvents(user?.id);
        if (alive && Array.isArray(list)) setEvents(list);
      } catch {}
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const onAdd = async (ev) => {
    setMode("list");
    try {
      const saved = await addEvent(user?.id, ev);
      setEvents((e) => [...e, saved]);
    } catch {
      setEvents((e) => [...e, { ...ev, id: Date.now() }]);
    }
  };

  // onDelete just requests confirmation (below); doDeleteEvent is the real,
  // previously-instant action, now gated behind the confirm dialog.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const doDeleteEvent = (id) => {
    setEvents((list) => list.filter((x) => x.id !== id));
    deleteEvent(user?.id, id).catch(() => {});
  };

  const onPlan = async (evs) => {
    setMode("list");
    try {
      const saved = await replaceEvents(user?.id, evs);
      setEvents(saved);
    } catch {
      setEvents(evs);
    }
  };

  // In-app version of the day-before notification (spec §05 · Sinhronizacija).
  const tomorrow = isoOffset(1);
  const matchTomorrow = events.find((e) => e.type === "tekma" && e.date === tomorrow);
  const peakStartsMonday = events.find((e) => e.type === "peak" && e.date === isoOffset(1) && dayIdx(e.date) === 0);

  return (
    <div style={{ padding: "8px 13px 18px" }}>
      {(matchTomorrow || peakStartsMonday) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", marginBottom: 11, borderRadius: 15, background: `${C.red}0d`, border: `1px solid ${C.red}30`, animation: "athlosFade 0.25s ease" }}>
          <span style={{ display: "flex", color: C.red, flexShrink: 0 }}><IcBall size={16} /></span>
          <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 13, color: C.text, lineHeight: 1.4 }}>
            {matchTomorrow
              ? <>{t("Tekma jutri")} · <strong>{matchTomorrow.title}</strong>{matchTomorrow.opponent ? ` vs ${matchTomorrow.opponent}` : ""} {matchTomorrow.time && `ob ${matchTomorrow.time}`}</>
              : <>{t("Peak teden se začne jutri — bodi spočit.")}</>}
          </span>
        </div>
      )}

      {/* Header — quiet mono kicker + display title */}
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>SEZONA</Mono>
            <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em", margin: "5px 0 0", color: C.text }}>{t("Tvoj urnik")}</h2>
          </div>
          {/* Week / Month toggle */}
          <div style={{ display: "flex", background: C.surface2, borderRadius: 999, padding: 3, flexShrink: 0 }}>
            {["week","month"].map(v => (
              <button key={v} onClick={() => setCalView(v)} style={{
                padding: "5px 10px", borderRadius: 999, border: "none", cursor: "pointer",
                background: calView === v ? C.surface3 : "transparent",
                color: calView === v ? C.text : C.muted,
                fontFamily: C.display, fontWeight: 700, fontSize: 12, transition: "background 0.15s",
              }}>
                {v === "week" ? t("Teden") : t("Mesec")}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Actions — AI urnik leads, manual add + export follow (all quiet secondaries) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <Pressable onClick={() => setMode(mode === "ai" ? "list" : "ai")} scale={0.97} style={{
          flex: 1, padding: "10px", borderRadius: 15,
          background: mode === "ai" ? C.surface3 : C.surface2,
          color: C.text,
          fontFamily: C.display, fontSize: 13.5, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <IcBolt size={14} /> {t("AI urnik")}
        </Pressable>
        <Pressable onClick={() => setMode(mode === "add" ? "list" : "add")} scale={0.97} style={{ flex: 1, padding: "10px", borderRadius: 15, background: mode === "add" ? C.surface3 : C.surface2, color: C.text, fontFamily: C.display, fontSize: 13.5, fontWeight: 700 }}>{t("+ Dodaj sam")}</Pressable>
        {/* .ics export — Apple/Google Calendar (spec §05) */}
        <Pressable onClick={() => events.length && downloadICS(events)} scale={0.94} aria-label={t("Izvozi v koledar (.ics)")} style={{ width: 50, padding: "10px 0", borderRadius: 15, background: C.surface2, color: events.length ? C.muted : C.muted2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        </Pressable>
      </div>

      {mode === "add" && <AddEventForm onAdd={onAdd} onCancel={() => setMode("list")} />}
      {mode === "ai" && <AiPlanForm sport={profile?.sport} onPlan={onPlan} onCancel={() => setMode("list")} />}

      {!loaded && (
        <div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <SkeletonBlock width={140} height={20} radius={6} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 15, padding: "8px 6px" }}>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "5px 0" }}>
                <SkeletonBlock width={14} height={8} radius={3} />
                <SkeletonBlock width={28} height={28} radius={999} />
              </div>
            ))}
          </div>
          {[70, 55, 62].map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", marginBottom: 6 }}>
              <SkeletonBlock width={8} height={8} radius={999} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <SkeletonBlock width={`${w}%`} height={13} radius={4} />
                <SkeletonBlock width={`${w - 20}%`} height={10} radius={4} />
              </div>
            </div>
          ))}
        </div>
      )}

      {loaded && calView === "week" && (
        <WeekView C={C} t={t} lang={lang} weekOffset={weekOffset} setWeekOffset={setWeekOffset} events={events} onDelete={setConfirmDeleteId} onAddManual={() => setMode("add")} />
      )}
      {loaded && calView === "month" && (
        <MonthView C={C} t={t} lang={lang} monthOffset={monthOffset} setMonthOffset={setMonthOffset} events={events} onDelete={setConfirmDeleteId} />
      )}

      <ConfirmDialog
        open={confirmDeleteId != null}
        onClose={() => setConfirmDeleteId(null)}
        tone="danger"
        icon={<IcTrash size={30} />}
        title={t("Izbriši dogodek?")}
        description={t("Dogodka po izbrisu ni mogoče obnoviti.")}
        confirmLabel={t("Izbriši")}
        onConfirm={() => { doDeleteEvent(confirmDeleteId); setConfirmDeleteId(null); }}
      />
    </div>
  );
}
