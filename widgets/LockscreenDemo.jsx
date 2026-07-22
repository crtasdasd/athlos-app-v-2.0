import React, { useEffect, useState } from "react";
import { Mono } from "../../components/UI";
import { fmtElapsed } from "../../lib/liveSession";
import { useLiveSession } from "./LiveTrainingBar";

// Per spec (ATHLOS-dodatki-spec.pdf, §07): presentation mock of the iOS
// lock-screen Live Activity. Real ActivityKit needs a native app (min iOS
// 16.1) — this overlay shows the team/investors exactly how it will look.
const DAYS_SL = ["NEDELJA", "PONEDELJEK", "TOREK", "SREDA", "ČETRTEK", "PETEK", "SOBOTA"];
const MONTHS_SL = ["JANUAR", "FEBRUAR", "MAREC", "APRIL", "MAJ", "JUNIJ", "JULIJ", "AVGUST", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DECEMBER"];

export default function LockscreenDemo({ onClose, t }) {
  const live = useLiveSession();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const clock = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  const dateLine = `${DAYS_SL[now.getDay()]} · ${now.getDate()}. ${MONTHS_SL[now.getMonth()]}`;
  const restLeft = live?.resting && live.restUntil ? Math.max(0, Math.ceil((live.restUntil - Date.now()) / 1000)) : 0;
  const pct = live ? Math.min(1, live.setDone / live.setsTotal) : 0;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 60, cursor: "pointer",
      background: "#14171C",
      display: "flex", flexDirection: "column", alignItems: "center",
      paddingTop: "max(env(safe-area-inset-top, 24px), 24px)",
      animation: "athlosFade 0.25s ease", color: "#fff", userSelect: "none",
    }}>
      {/* status hint */}
      <Mono style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, letterSpacing: "0.2em", marginTop: 8 }}>LIVE ACTIVITY · DEMO</Mono>

      {/* clock */}
      <div style={{ textAlign: "center", marginTop: 22 }}>
        <Mono style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, letterSpacing: "0.18em" }}>{dateLine}</Mono>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 85, lineHeight: 1.05, letterSpacing: "0.02em", textShadow: "0 4px 30px rgba(0,0,0,0.45)" }}>{clock}</div>
      </div>

      {/* Live Activity card */}
      <div style={{
        width: "min(92%, 380px)", marginTop: 38, borderRadius: 18, padding: "11px 13px",
        background: "rgba(24,28,24,0.94)",
        border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(20px)",
        boxShadow: "0 18px 44px rgba(0,0,0,0.5)", position: "relative", overflow: "hidden",
      }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(0,255,135,0.14)", border: "1px solid rgba(0,255,135,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 800, fontSize: 13, color: "#00FF87" }}>A</span>
          <Mono style={{ color: "rgba(244,239,230,0.6)", fontSize: 9, letterSpacing: "0.18em", flex: 1 }}>ATHLOS · {live ? t(live.focus) : "MOČ · SPODNJI DEL"}</Mono>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 14, color: "#00FF87" }}>{live ? fmtElapsed(live.startedAt) : "14:32"}</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 9 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 800, fontSize: 22, textTransform: "uppercase", color: "#F4EFE6", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {live ? `${live.block} · ${t(live.exName)}` : "A1 · Squat"}
            </div>
            <Mono style={{ color: restLeft ? "#00FF87" : "rgba(244,239,230,0.55)", fontSize: 10, letterSpacing: "0.08em", marginTop: 5, display: "block" }}>
              {restLeft
                ? `${t("ODMOR")} ${restLeft}s${live?.nextName ? ` · ${t("nato")}: ${t(live.nextName)}` : ""}`
                : live
                  ? `SET ${Math.min(live.setDone + 1, live.setsTotal)}/${live.setsTotal} · ${live.reps} ${t("pon.")}${live.load ? ` · ${live.load} ${live.unit}` : ""}`
                  : "SET 2/5 · 5 pon. · 120 KG"}
            </Mono>
          </div>
          {/* set-progress ring */}
          <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
            <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
            <circle cx="26" cy="26" r="22" fill="none" stroke="#00FF87" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 22} strokeDashoffset={2 * Math.PI * 22 * (1 - (live ? pct : 0.4))}
              transform="rotate(-90 26 26)" style={{ transition: "stroke-dashoffset 0.4s ease" }} />
            <text x="26" y="30" textAnchor="middle" fill="#F4EFE6" fontFamily="'JetBrains Mono',monospace" fontWeight="700" fontSize="11">
              {live ? `${live.setDone}/${live.setsTotal}` : "2/5"}
            </text>
          </svg>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* swipe hint */}
      <div style={{ textAlign: "center", paddingBottom: "max(env(safe-area-inset-bottom, 28px), 28px)" }}>
        <Mono style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: "0.24em" }}>SWIPE UP TO OPEN ATHLOS</Mono>
        <div style={{ width: 120, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.55)", margin: "14px auto 0" }} />
      </div>
    </div>
  );
}
