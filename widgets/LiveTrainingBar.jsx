import React, { useEffect, useState } from "react";
import { Mono } from "../../components/UI";
import { getLive, subscribeLive, fmtElapsed } from "../../lib/liveSession";

// Per spec (ATHLOS-dodatki-spec.pdf, §07 · Live trening widget):
// the in-app equivalent of a lock-screen Live Activity. While a workout is
// running, a dark sticky bar shows the current exercise, set, load and the
// session timer on EVERY tab; tapping it jumps straight back to the workout
// (spec: "tap odpre app točno na ekranu trenutne vaje").
export function useLiveSession() {
  const [live, setLiveState] = useState(getLive);
  useEffect(() => subscribeLive(setLiveState), []);
  return live;
}

export default function LiveTrainingBar({ C, t, onOpen }) {
  const live = useLiveSession();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [live]);

  if (!live) return null;

  const restLeft = live.resting && live.restUntil ? Math.max(0, Math.ceil((live.restUntil - Date.now()) / 1000)) : 0;

  return (
    <button onClick={onOpen} style={{
      width: "100%", maxWidth: 560, marginInline: "auto", marginBottom: 6,
      display: "flex", alignItems: "center", gap: 9, padding: "8px 11px",
      background: C.surface2,
      border: `1px solid ${C.accent}33`, borderRadius: 15,
      boxShadow: C.name === "dark" ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(16,24,40,0.12)",
      cursor: "pointer", textAlign: "left", pointerEvents: "auto",
      animation: "athlosSlideDown 0.3s ease", WebkitTapHighlightColor: "transparent",
      position: "relative", overflow: "hidden",
    }}>
      {/* pulsing live dot */}
      <span style={{ position: "relative", width: 9, height: 9, flexShrink: 0 }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: C.accent, animation: "athlosPulse 1.6s ease infinite" }} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {live.block} · {t(live.exName)}
        </span>
        <Mono style={{ color: restLeft ? C.accent : C.muted, fontSize: 9, letterSpacing: "0.08em" }}>
          {restLeft
            ? <>{t("ODMOR")} {restLeft}s{live.nextName ? ` · ${t("nato")}: ${t(live.nextName)}` : ""}</>
            : <>SET {Math.min(live.setDone + 1, live.setsTotal)}/{live.setsTotal}{live.load ? ` · ${live.load} ${live.unit}` : ""} · {live.reps} {t("pon.")}</>}
        </Mono>
      </span>

      <span style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{ display: "block", fontFamily: C.mono, fontWeight: 700, fontSize: 15, color: C.accent }}>{fmtElapsed(live.startedAt)}</span>
        <Mono style={{ color: C.muted2, fontSize: 8.5, letterSpacing: "0.1em" }}>{t("TRENING")}</Mono>
      </span>
    </button>
  );
}
