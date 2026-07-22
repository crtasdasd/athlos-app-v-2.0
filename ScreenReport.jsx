import React, { useEffect, useState } from "react";
import { useTheme } from "../theme";
import { BackBtn, Card, SectionLabel, StatTile } from "../components/UI";
import { useT } from "../lib/i18n";

// The daily report is valid for the calendar day — it expires at midnight,
// when the next day's report takes over. Seconds until then:
const untilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, Math.floor((midnight - now) / 1000));
};
const fmtHMS = (s) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function ScreenReport({ go }) {
  const C = useTheme();
  const t = useT();

  const [left, setLeft] = useState(untilMidnight);
  useEffect(() => {
    const iv = setInterval(() => setLeft(untilMidnight()), 1000);
    return () => clearInterval(iv);
  }, []);

  const kicker = { fontFamily: C.mono, fontWeight: 600, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted };

  return (
    <div style={{ padding: "11px 14px 26px", color: C.text }}>
      <header style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
        <BackBtn onClick={() => go("today")} />
        <span style={kicker}>{t("DNEVNO POROČILO")}</span>
        <span style={{ flex: 1 }} />
        {/* live countdown to midnight; the last hour turns soft red */}
        <span style={{ ...kicker, fontSize: 8.5, letterSpacing: "0.1em" }}>{t("POTEČE ČEZ")}</span>
        <span style={{ fontFamily: C.mono, fontSize: 11, fontVariantNumeric: "tabular-nums", color: left < 3600 ? C.red : C.text2 }}>{fmtHMS(left)}</span>
      </header>

      {/* HERO — the score as pure typography, no container */}
      <section style={{ marginBottom: 9 }}>
        <span style={kicker}>{t("TRENING")} #14 · {t("SKUPNA OCENA")}</span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 11, marginTop: 11, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 72, lineHeight: 0.82, color: C.accent, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>92</span>
            <span style={{ fontFamily: C.mono, fontSize: 12.5, color: C.muted2 }}>/100</span>
          </div>
          <div style={{ paddingBottom: 2 }}>
            <div style={{ ...kicker, color: C.text2, marginBottom: 5 }}>{t("odlično")}</div>
            <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, margin: 0, letterSpacing: "-0.02em", color: C.text, lineHeight: 1.1 }}>{t("Moč · Spodnji del")}</h2>
          </div>
        </div>
      </section>

      {/* floating stat tiles — horizontal strip */}
      <div style={{ display: "flex", gap: 6, margin: "24px -20px 32px", padding: "0 14px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {[["8.6", "T", t("DVIGNJENO"), "+0.5T"], ["7.2", "/10", t("TEŽAVNOST"), t("OPTIMALNO")], ["6", "/6", t("OPRAVLJENE VAJE"), t("VSE")]].map(([v, u, l, s], i) => (
          <StatTile
            key={i}
            style={{ flex: "0 0 auto", minWidth: 124 }}
            label={l}
            value={<span style={{ fontVariantNumeric: "tabular-nums" }}>{v}<span style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginLeft: 3 }}>{u}</span></span>}
            sub={s}
          />
        ))}
      </div>

      {/* dominant panel — AI analysis with hairline breakdown rows */}
      <div style={{ marginBottom: 20 }}>
        <SectionLabel>{t("AI ANALIZA")}</SectionLabel>
        <Card pad={22} radius={24}>
        <p style={{ margin: 0, color: C.text, fontSize: 15, lineHeight: 1.5, fontWeight: 500, letterSpacing: "-0.01em" }}>{t("Močan trening. Povečaj breme za 2.5 kg na počepu naslednji teden. Tehnika je stabilna — idealen čas za napredovanje.")}</p>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", color: C.text }}>+5 {t("KG / TEDEN")}</span>
            <span style={{ color: C.muted2, fontSize: 12.5 }}>›</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: C.mono, fontWeight: 500, fontSize: 10, letterSpacing: "0.06em", color: C.text2 }}>{t("TEHNIKA STABILNA")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: C.mono, fontWeight: 500, fontSize: 10, letterSpacing: "0.06em", color: C.text2 }}>{t("FOKUS: HITROST")}</span>
          </div>
        </div>
        </Card>
      </div>

      {/* navigation — pressable card row */}
      <Card onClick={() => go("assessment")} pad={18} radius={24}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M4 20V12M8 20V8M12 20V4M16 20V10M20 20V6" />
          </svg>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: C.display, fontWeight: 700, fontSize: 13.5, color: C.text, marginBottom: 4 }}>{t("Performans ocena")}</span>
            <span style={{ fontFamily: C.mono, fontSize: 9, letterSpacing: "0.08em", color: C.muted }}>{t("Benchmark primerjava · trenerjev komentar")}</span>
          </span>
          <span style={{ color: C.muted2, fontSize: 15.5 }}>›</span>
        </span>
      </Card>
    </div>
  );
}
