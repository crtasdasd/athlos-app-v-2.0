import React from "react";
import { useTheme } from "../theme";
import { Mono, Card, SectionLabel, StatTile, PrimaryBtn, BackBtn } from "../components/UI";
import { useT } from "../lib/i18n";

export default function ScreenSession({ go }) {
  const C = useTheme();
  const t = useT();
  return (
    <div style={{ padding: "6px 14px 26px", color: C.text }}>
      {/* Header — quiet eyebrow + big heading, back on the left */}
      <header style={{ display: "flex", alignItems: "center", margin: "8px 0 20px" }}>
        <BackBtn onClick={() => go("train")} />
        <div style={{ minWidth: 0 }}>
          <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em", display: "block", marginBottom: 5 }}>{t("TRENING V ŽIVO")}</Mono>
          <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22, margin: 0, color: C.text, letterSpacing: "-0.02em", lineHeight: 1.05 }}>Squat — {t("serija")} 3/5</h2>
        </div>
      </header>

      {/* Record — soft dark tile, no border */}
      <button style={{ width: "100%", height: 176, borderRadius: 18, border: "none", background: C.surface2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.surface3, color: C.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.16em" }}>{t("POSNEMI VAJO ZA ANALIZO")}</Mono>
      </button>

      {/* Current set — target header, metric tiles, log button */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: C.mono, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, fontWeight: 600 }}>{t("SERIJA 3 OD 5")}</span>
          <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 12.5, color: C.accent }}>{t("CILJ")} 82.5 KG ✓</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 11 }}>
          <StatTile style={{ flex: 1, minWidth: 0 }} label={t("TEŽA")} value="82.5 KG" barPct={0.72} />
          <StatTile style={{ flex: 1, minWidth: 0 }} label={t("PONOVITVE")} value="3" barPct={0.50} />
          <StatTile style={{ flex: 1, minWidth: 0 }} label={t("TEŽAVNOST")} value="7.5 / 10" barPct={0.78} />
        </div>
        <PrimaryBtn>{t("Zabeleži serijo")}</PrimaryBtn>
      </div>

      {/* AI note — soft dark card */}
      <Card>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <Mono style={{ color: C.accent, fontSize: 9, letterSpacing: "0.16em", marginTop: 3, flexShrink: 0 }}>AI</Mono>
          <span style={{ fontFamily: C.display, color: C.text2, fontSize: 13, lineHeight: 1.55 }}>{t("Tvoja izvedba je stabilna in hitra. Kar tako naprej — tehnika je odlična.")}</span>
        </div>
      </Card>
    </div>
  );
}
