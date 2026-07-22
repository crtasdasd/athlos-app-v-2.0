import React, { useState, useEffect } from "react";
import { useTheme } from "../theme";
import { Mono } from "./UI";
import { useLang, useT } from "../lib/i18n";
import WheelColumn from "./WheelPicker";

const MONTHS_SL = ["Januar","Februar","Marec","April","Maj","Junij","Julij","Avgust","September","Oktober","November","December"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

const MIN_AGE = 10; // person must be at least 10 years old

function getMaxDate() {
  const d = new Date();
  return new Date(d.getFullYear() - MIN_AGE, d.getMonth(), d.getDate());
}

/* ── Future-only day picker (urnik) ── */
const DAYS_SL_SHORT = ["ned","pon","tor","sre","čet","pet","sob"];
const DAYS_EN_SHORT = ["sun","mon","tue","wed","thu","fri","sat"];
const MONTHS_SL_SHORT = ["jan","feb","mar","apr","maj","jun","jul","avg","sep","okt","nov","dec"];
const MONTHS_EN_SHORT = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

function FutureDatePicker({ value, onChange, onClose, futureDays }) {
  const C = useTheme();
  const t = useT();
  const lang = useLang();
  const daysShort = lang === "en" ? DAYS_EN_SHORT : DAYS_SL_SHORT;
  const monthsShort = lang === "en" ? MONTHS_EN_SHORT : MONTHS_SL_SHORT;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: futureDays + 1 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const toISO = (d) => d.toISOString().slice(0, 10);
  const [sel, setSel] = useState(value || toISO(today));

  const confirm = () => { onChange(sel); onClose(); };

  const fmtSel = () => {
    const d = new Date(sel + "T00:00:00");
    return `${d.getDate()}. ${monthsShort[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <style>{`@keyframes dpUp { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }`}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg, borderRadius: "26px 26px 0 0", border: `1px solid ${C.border2}`, borderBottom: "none", overflow: "hidden", animation: "dpUp 0.3s cubic-bezier(.2,.8,.2,1)" }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "9px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: C.border2 }} />
        </div>
        {/* Selected label */}
        <div style={{ padding: "4px 14px 10px", borderBottom: `1px solid ${C.border}` }}>
          <Mono style={{ color: C.gold, fontSize: 8.5, letterSpacing: "0.22em" }}>{t("IZBRANI DATUM")}</Mono>
          <div style={{ fontFamily: C.heading, fontWeight: 700, fontSize: 21.5, color: sel ? C.text : C.muted, marginTop: 4 }}>{fmtSel()}</div>
        </div>
        {/* Day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: "10px 8px 8px" }}>
          {days.map((d, i) => {
            const iso = toISO(d);
            const active = sel === iso;
            const isToday = i === 0;
            return (
              <button
                key={iso}
                onClick={() => setSel(iso)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 4, padding: "6px 2px", borderRadius: 10,
                  border: active ? "none" : isToday ? `1.5px solid ${C.gold}66` : `1.5px solid transparent`,
                  background: active ? C.btn : "transparent",
                  cursor: "pointer", WebkitTapHighlightColor: "transparent",
                  transition: "background 0.12s, transform 0.1s",
                }}
              >
                <span style={{ fontFamily: C.mono, fontSize: 8.5, color: active ? C.btnText : C.muted, letterSpacing: "0.06em" }}>
                  {daysShort[d.getDay()].toUpperCase()}
                </span>
                <span style={{ fontFamily: C.display, fontWeight: active ? 800 : isToday ? 700 : 400, fontSize: 15, color: active ? C.btnText : C.text, lineHeight: 1 }}>
                  {d.getDate()}
                </span>
                {isToday && !active && (
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.gold }} />
                )}
              </button>
            );
          })}
        </div>
        {/* Actions */}
        <div style={{ display: "flex", gap: 8, padding: "6px 11px 18px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${C.border2}`, background: "transparent", color: C.text, fontFamily: C.display, fontWeight: 700, fontSize: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{t("Prekliči")}</button>
          <button onClick={confirm} style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: C.btn, color: C.btnText, fontFamily: C.heading, fontWeight: 700, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{t("Potrdi")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main DatePicker — iOS-style sliding wheel (day / month / year) ── */
function BirthDatePicker({ value, onChange, onClose }) {
  const C = useTheme();
  const t = useT();
  const lang = useLang();
  const months = lang === "en" ? MONTHS_EN : MONTHS_SL;
  const maxDate = getMaxDate();
  const init = value ? new Date(value) : maxDate;

  const startY = 1940;
  const endY = maxDate.getFullYear();
  const years = Array.from({ length: endY - startY + 1 }, (_, i) => startY + i);
  const monthIdxs = Array.from({ length: 12 }, (_, i) => i);

  const [day, setDay] = useState(init.getDate());
  const [month, setMonth] = useState(init.getMonth());
  const [year, setYear] = useState(Math.min(init.getFullYear(), endY));

  const dim = daysInMonth(year, month);
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  // Clamp day when the month/year combo shortens it (e.g. 31 → 28/29/30)
  useEffect(() => { if (day > dim) setDay(dim); }, [dim]); // eslint-disable-line
  // Clamp month/day so the date never goes past maxDate (min-age limit)
  useEffect(() => { if (year === endY && month > maxDate.getMonth()) setMonth(maxDate.getMonth()); }, [year]); // eslint-disable-line
  useEffect(() => { if (year === endY && month === maxDate.getMonth() && day > maxDate.getDate()) setDay(maxDate.getDate()); }, [year, month]); // eslint-disable-line

  const sel = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const confirm = () => { onChange(sel); onClose(); };

  const fmtSel = () => {
    const d = new Date(sel);
    return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Live age — the number this screen actually exists for (it drives the
  // program's norms), so it gets the hero treatment.
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() < month || (now.getMonth() === month && now.getDate() < day)) age -= 1;

  const dark = C.name === "dark";

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 60,
      background: C.bg, color: C.text,
      display: "flex", flexDirection: "column",
      paddingTop: "max(env(safe-area-inset-top, 16px), 16px)",
      paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
      animation: "dpFull 0.34s cubic-bezier(.22,1,.36,1)",
      overflow: "hidden",
    }}>
      <style>{`@keyframes dpFull { from { transform:translateY(5%); opacity:0; } to { transform:translateY(0); opacity:1; } }`}</style>

      {/* quiet accent aura behind the age numeral */}
      <div aria-hidden="true" style={{
        position: "absolute", top: "-6%", left: "50%", transform: "translateX(-50%)",
        width: 420, height: 320, pointerEvents: "none",
        background: `radial-gradient(closest-side, ${dark ? "rgba(0,255,135,0.12)" : "rgba(31,122,82,0.09)"} 0%, transparent 72%)`,
      }} />

      {/* close */}
      <button onClick={onClose} aria-label={t("Prekliči")} style={{
        position: "absolute", top: "max(env(safe-area-inset-top, 14px), 14px)", left: 18, zIndex: 2,
        width: 38, height: 38, borderRadius: "50%", cursor: "pointer",
        background: C.surface, border: `1px solid ${C.border}`,
        color: C.text, fontSize: 18, lineHeight: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        WebkitTapHighlightColor: "transparent",
      }}>×</button>

      {/* hero — the age counts live while the wheels spin */}
      <div style={{ textAlign: "center", padding: "26px 16px 6px", position: "relative" }}>
        <Mono style={{ color: C.gold, fontSize: 9, letterSpacing: "0.26em" }}>{t("DATUM ROJSTVA")}</Mono>
        <div key={age} style={{
          fontFamily: C.display, fontWeight: 800, fontSize: 88, lineHeight: 1,
          color: C.text, marginTop: 8, letterSpacing: "-0.03em",
          animation: "dpAgePop 0.24s cubic-bezier(.34,1.56,.64,1)",
        }}>
          {age}
        </div>
        <style>{`@keyframes dpAgePop { from { transform:scale(0.94); opacity:0.4; } to { transform:scale(1); opacity:1; } }`}</style>
        <div style={{ fontFamily: C.display, fontWeight: 600, fontSize: 13.5, color: C.muted, marginTop: 6 }}>
          {t("LET")} · {fmtSel()}
        </div>
      </div>

      {/* wheels — day / month / year, centered in the remaining space */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "0 10px" }}>
        <WheelColumn items={days} value={day} onChange={setDay} width={62} C={C} />
        <WheelColumn items={monthIdxs} value={month} onChange={setMonth} width={140} C={C} render={(m) => months[m]} />
        <WheelColumn items={years} value={year} onChange={setYear} width={78} C={C} />
      </div>

      {/* confirm — one full-width pill; × is the way out */}
      <div style={{ padding: "8px 16px 5px" }}>
        <button onClick={confirm} style={{
          width: "100%", padding: "11px", borderRadius: 999, border: "none",
          background: C.btn, color: C.btnText,
          fontFamily: C.display, fontWeight: 700, fontSize: 14,
          cursor: "pointer", WebkitTapHighlightColor: "transparent",
        }}>
          {t("Potrdi datum")}
        </button>
      </div>
    </div>
  );
}

/* ── Future wheel picker — same day/month/year WheelColumn mechanics as
   BirthDatePicker (the "isti kolesce kot datum rojstva" ask), but scoped to
   today…+yearsAhead instead of birth-year…now-10-years, and no age hero
   (there's no "age" concept for an event date). Used for scheduling things
   like community events. ── */
function FutureWheelDatePicker({ value, onChange, onClose, yearsAhead = 2, label }) {
  const C = useTheme();
  const t = useT();
  const lang = useLang();
  const months = lang === "en" ? MONTHS_EN : MONTHS_SL;
  const minDate = new Date(); minDate.setHours(0, 0, 0, 0);
  const maxDate = new Date(minDate); maxDate.setFullYear(maxDate.getFullYear() + yearsAhead);
  const init = value ? new Date(value + "T00:00:00") : minDate;

  const startY = minDate.getFullYear();
  const endY = maxDate.getFullYear();
  const years = Array.from({ length: endY - startY + 1 }, (_, i) => startY + i);
  const monthIdxs = Array.from({ length: 12 }, (_, i) => i);

  const [day, setDay] = useState(init.getDate());
  const [month, setMonth] = useState(init.getMonth());
  const [year, setYear] = useState(Math.max(startY, Math.min(init.getFullYear(), endY)));

  const dim = daysInMonth(year, month);
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  // Clamp day when the month/year combo shortens it (e.g. 31 → 28/29/30)
  useEffect(() => { if (day > dim) setDay(dim); }, [dim]); // eslint-disable-line
  // Clamp so the date can never land before today…
  useEffect(() => { if (year === startY && month < minDate.getMonth()) setMonth(minDate.getMonth()); }, [year]); // eslint-disable-line
  useEffect(() => { if (year === startY && month === minDate.getMonth() && day < minDate.getDate()) setDay(minDate.getDate()); }, [year, month]); // eslint-disable-line
  // …or past the +yearsAhead ceiling.
  useEffect(() => { if (year === endY && month > maxDate.getMonth()) setMonth(maxDate.getMonth()); }, [year]); // eslint-disable-line
  useEffect(() => { if (year === endY && month === maxDate.getMonth() && day > maxDate.getDate()) setDay(maxDate.getDate()); }, [year, month]); // eslint-disable-line

  const sel = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const confirm = () => { onChange(sel); onClose(); };

  const fmtSel = () => {
    const d = new Date(sel + "T00:00:00");
    return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 60,
      background: C.bg, color: C.text,
      display: "flex", flexDirection: "column",
      paddingTop: "max(env(safe-area-inset-top, 16px), 16px)",
      paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
      animation: "dpFull 0.34s cubic-bezier(.22,1,.36,1)",
      overflow: "hidden",
    }}>
      <style>{`@keyframes dpFull { from { transform:translateY(5%); opacity:0; } to { transform:translateY(0); opacity:1; } }`}</style>

      <button onClick={onClose} aria-label={t("Prekliči")} style={{
        position: "absolute", top: "max(env(safe-area-inset-top, 14px), 14px)", left: 18, zIndex: 2,
        width: 38, height: 38, borderRadius: "50%", cursor: "pointer",
        background: C.surface, border: `1px solid ${C.border}`,
        color: C.text, fontSize: 18, lineHeight: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        WebkitTapHighlightColor: "transparent",
      }}>×</button>

      <div style={{ textAlign: "center", padding: "30px 16px 8px" }}>
        <Mono style={{ color: C.gold, fontSize: 9, letterSpacing: "0.26em" }}>{label || t("IZBRANI DATUM")}</Mono>
        <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 32, color: C.text, marginTop: 10, letterSpacing: "-0.02em" }}>
          {fmtSel()}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "0 10px" }}>
        <WheelColumn items={days} value={day} onChange={setDay} width={62} C={C} />
        <WheelColumn items={monthIdxs} value={month} onChange={setMonth} width={140} C={C} render={(m) => months[m]} />
        <WheelColumn items={years} value={year} onChange={setYear} width={78} C={C} />
      </div>

      <div style={{ padding: "8px 16px 5px" }}>
        <button onClick={confirm} style={{
          width: "100%", padding: "11px", borderRadius: 999, border: "none",
          background: C.btn, color: C.btnText,
          fontFamily: C.display, fontWeight: 700, fontSize: 14,
          cursor: "pointer", WebkitTapHighlightColor: "transparent",
        }}>
          {t("Potrdi datum")}
        </button>
      </div>
    </div>
  );
}

export default function DatePicker({ value, onChange, onClose, futureDays, wheel, yearsAhead, label }) {
  if (wheel) return <FutureWheelDatePicker value={value} onChange={onChange} onClose={onClose} yearsAhead={yearsAhead} label={label} />;
  if (futureDays != null) return <FutureDatePicker value={value} onChange={onChange} onClose={onClose} futureDays={futureDays} />;
  return <BirthDatePicker value={value} onChange={onChange} onClose={onClose} />;
}
