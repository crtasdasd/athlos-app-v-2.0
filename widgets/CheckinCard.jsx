import React, { useState } from "react";
import { Mono } from "../../components/UI";
import { IcFlame } from "../../components/Icons";

// Per spec (ATHLOS-dodatki-spec.pdf, §04 · Wellness check-in):
// A morning questionnaire card at the top of the home screen. 4 questions on
// a 1–5 scale feed straight into the readiness battery. Once submitted the
// questionnaire disappears for the day and only a slim streak strip remains —
// a Duolingo-style 🔥 counter with the current week's dots (P T S Č P S N).
// Missing a day resets the streak to 0.
// Streak / week-dot state is stored PER USER, so a second account on the same
// browser doesn't inherit the first one's "checked in today" flag. Falls back
// to a "local" namespace when there's no signed-in user (demo mode).
const storeKey = (userId) => `athlos:wellness:${userId || "local"}`;

const pad = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const loadWellness = (userId) => {
  try { return { days: {}, ...JSON.parse(localStorage.getItem(storeKey(userId)) || "{}") }; }
  catch { return { days: {} }; }
};
const saveWellness = (userId, s) => { try { localStorage.setItem(storeKey(userId), JSON.stringify(s)); } catch {} };

// Marks today (or a given date) as checked-in — feeds the streak, the week
// dots, and checkinPendingToday(). Called by ScreenToday's live check-in
// sliders, which are the actual check-in UI (this component's own form
// isn't mounted anywhere — only its storage helpers are reused).
export function markWellnessDone(userId, answers, date = new Date()) {
  const s = loadWellness(userId);
  const iso = isoLocal(date);
  saveWellness(userId, { ...s, days: { ...s.days, [iso]: answers } });
}

// A check-in answered before auth resolves is written to the "local"
// namespace, because `user?.id` was still undefined. Once the account id
// arrives, every later read looks in `athlos:wellness:<id>` — which is empty —
// and the day reads as never done, permanently.
//
// ScreenToday auto-opens the check-in 650ms after mount, so that window is not
// theoretical: it is the normal path on a cold start. Fold the local days into
// the account's namespace as soon as an id exists. The account always wins on
// a collision, and the local bucket is cleared so this runs at most once.
export function adoptLocalWellness(userId) {
  if (!userId) return false;
  const localDays = loadWellness(null).days || {};
  if (!Object.keys(localDays).length) return false;
  const mine = loadWellness(userId);
  saveWellness(userId, { ...mine, days: { ...localDays, ...(mine.days || {}) } });
  try { localStorage.removeItem(storeKey(null)); } catch {}
  return true;
}

// Fold the account's real check-in history (already synced to Supabase by
// lib/api.js's saveCheckin/listCheckins) into this local "done" map.
//
// This is the actual cross-device gap: the check-in ANSWERS are safely in the
// `checkins` table the moment they're submitted, but streak, the week dots and
// checkinPendingToday() all read ONLY this local store — which starts empty on
// a new device, a cleared browser, or a reinstall. Without this fold, someone
// who checked in every day for a month sees their streak reset to 0 the first
// time they open the app on a different device, and the app tells them
// today's check-in is still pending even though it already happened elsewhere.
//
// `rows` come from lib/api.js listCheckins(userId, days) — real Supabase rows
// when available, its own local cache otherwise. A day already present here is
// never touched, since it may hold the richer answer object markWellnessDone
// writes; a day known only from the cloud gets a lightweight marker, because
// every consumer of `days[iso]` (streak, week dots, checkinPendingToday) only
// ever tests truthiness and never reads into an entry it didn't write itself.
export function syncWellnessFromCheckins(userId, rows) {
  if (!rows?.length) return false;
  const s = loadWellness(userId);
  const days = { ...s.days };
  let changed = false;
  for (const row of rows) {
    if (!row?.date || days[row.date]) continue;
    days[row.date] = { fromCloud: true };
    changed = true;
  }
  if (changed) saveWellness(userId, { ...s, days });
  return changed;
}

// Consecutive days ending today (or yesterday, when today isn't done yet —
// the streak isn't lost until the day is actually missed).
export function computeStreak(days, now = new Date()) {
  const d = new Date(now);
  if (!days[isoLocal(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days[isoLocal(d)]) { n += 1; d.setDate(d.getDate() - 1); }
  return n;
}

// Monday-first week of `now`: [{label, iso, done, isToday}]
function weekDots(days, now = new Date(), lang = "sl") {
  const labels = lang === "en" ? ["M", "T", "W", "T", "F", "S", "S"] : ["P", "T", "S", "Č", "P", "S", "N"];
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = isoLocal(d);
    return { label, iso, done: !!days[iso], isToday: iso === isoLocal(now) };
  });
}

const QUESTIONS = [
  { key: "sleepQuality", label: "Kako si spal?" },
  { key: "soreness", label: "Bolečine, mišična napetost?" },
  { key: "stress", label: "Stres / razpoloženje?" },
  { key: "mood", label: "Energija danes?" },
];

function ScaleRow({ q, value, onPick, C, t }) {
  return (
    <div>
      <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15, color: C.text, display: "block", marginBottom: 6 }}>{t(q.label)}</span>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onPick(n)} style={{
            flex: 1, padding: "8px 0", borderRadius: 9, cursor: "pointer",
            border: `1px solid ${value === n ? C.accent : C.border2}`,
            background: value === n ? `${C.accent}1f` : "transparent",
            color: value === n ? C.accent : C.muted,
            fontFamily: C.mono, fontWeight: 700, fontSize: 13, WebkitTapHighlightColor: "transparent",
          }}>{n}</button>
        ))}
      </div>
    </div>
  );
}

function StreakStrip({ days, C, t, lang, style }) {
  const streak = computeStreak(days);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ display: "flex", color: streak > 0 ? C.gold : C.muted2 }}><IcFlame size={19} /></span>
        <span style={{ fontFamily: C.heading, fontWeight: 800, fontSize: 24.5, color: C.text, lineHeight: 1 }}>{streak}</span>
        <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.1em" }}>{t("DNI ZAPORED · STREAK")}</Mono>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        {weekDots(days, new Date(), lang).map((d, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <Mono style={{ color: d.isToday ? C.text : C.muted2, fontSize: 8.5 }}>{d.label}</Mono>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: d.done ? C.accent : "transparent",
              border: `1px solid ${d.done ? C.accent : C.border2}`,
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CheckinCard({ C, t, lang, onSubmit, userId }) {
  const [store, setStore] = useState(() => loadWellness(userId));
  const [answers, setAnswers] = useState({});
  const today = isoLocal(new Date());
  const doneToday = !!store.days[today];

  // Done for today → streak strip on top, today's answers as four bare stat
  // columns (value large, label whisper-quiet) — same grammar as the battery.
  if (doneToday) {
    const a = store.days[today] || {};
    const stats = [
      [`${a.sleepQuality ?? "–"}/5`, t("SPANEC")],
      [`${a.mood ?? "–"}/5`, t("ENERGIJA")],
      [`${a.soreness ?? "–"}/5`, t("SORNOST")],
      [`${a.stress ?? "–"}/5`, t("STRES")],
    ];
    return (
      <div style={{ background: C.surface2, borderRadius: 18, padding: "11px 13px", marginBottom: 9, boxShadow: C.name === "dark" ? "0 1px 2px rgba(0,0,0,0.35)" : "0 2px 10px rgba(16,24,40,0.05)" }}>
        <StreakStrip days={store.days} C={C} t={t} lang={lang} style={{ paddingBottom: 13, borderBottom: `1px solid ${C.border}`, marginBottom: 10 }} />
        <div style={{ display: "flex", alignItems: "stretch" }}>
          {stats.map(([val, label], i) => (
            <React.Fragment key={label}>
              {i > 0 && <span style={{ width: 1, background: C.border }} />}
              <span style={{ flex: 1, textAlign: "center" }}>
                <span style={{ display: "block", fontFamily: C.display, fontWeight: 800, fontSize: 14.5, color: C.text, lineHeight: 1 }}>{val}</span>
                <Mono style={{ color: C.muted2, fontSize: 7.5, letterSpacing: "0.12em", display: "block", marginTop: 4 }}>{label}</Mono>
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  const complete = QUESTIONS.every((q) => answers[q.key]);

  const submit = () => {
    if (!complete) return;
    const next = { ...store, days: { ...store.days, [today]: { ...answers, at: Date.now() } } };
    setStore(next);
    saveWellness(userId, next);
    onSubmit?.(answers);
  };

  return (
    <div style={{ background: C.surface2, borderRadius: 18, padding: 18, marginBottom: 9, boxShadow: C.name === "dark" ? "0 1px 2px rgba(0,0,0,0.35)" : "0 2px 10px rgba(16,24,40,0.05)" }}>
      {/* icon-chip header row, matching the rest of the home cards */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.2 1.8 3.5 1.8 3.5-1.8 3.5-1.8M9 10h.01M15 10h.01" /></svg>
        </span>
        <span style={{ flex: 1, fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text }}>{t("Kako se počutiš?")}</span>
        <Mono style={{ color: C.accent, fontSize: 8.5, letterSpacing: "0.1em" }}>{t("JUTRANJI CHECK-IN")}</Mono>
      </div>

      <StreakStrip days={store.days} C={C} t={t} lang={lang} style={{ paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 10 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {QUESTIONS.map((q) => (
          <ScaleRow key={q.key} q={q} value={answers[q.key]} onPick={(n) => setAnswers((a) => ({ ...a, [q.key]: n }))} C={C} t={t} />
        ))}
      </div>

      <button onClick={submit} disabled={!complete} style={{
        width: "100%", marginTop: 11, padding: "11px 0", borderRadius: 999, border: "none",
        cursor: complete ? "pointer" : "default",
        background: complete ? C.btn : C.surface3, color: complete ? C.btnText : C.muted,
        fontFamily: C.display, fontWeight: 700, fontSize: 13.5,
        transition: "background 0.2s, color 0.2s", WebkitTapHighlightColor: "transparent",
      }}>
        {t("Pošlji & posodobi readiness")} <span style={{ color: complete ? C.accent2 : C.muted2 }}>→</span>
      </button>
    </div>
  );
}
