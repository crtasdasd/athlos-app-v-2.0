// ATHLOS — Daily Coach: a premium, WHOOP-style coaching card that is
// entirely deterministic (see DailyCoachEngine.ts) — no LLM, no API call.
// Logic lives in DailyCoachRules/Templates/Engine; this file only renders.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { GlassSurface } from "../LiquidGlass";
import { Icon, Mono } from "../UI";
import { RefreshCw, Sparkles } from "lucide-react";
import { generateDailyCoach, splitHighlights } from "./DailyCoachEngine";
import type { DailyCoachMetrics } from "./DailyCoachRules";
import { animateDailyCoachIn } from "./DailyCoachAnimations";

interface DailyCoachCardProps {
  metrics: DailyCoachMetrics;
  t: (s: string) => string;
  userId?: string | null;
  dateIso: string;
}

// Fixed dark glass palette — deliberately NOT theme-derived (same choice the
// login/splash screens already make in App.jsx: "always the dark theme,
// regardless of device preference — the brand's premium-dark entrance").
// Daily Coach is meant to read as one distinct premium moment on the page,
// not a card that changes with the app's light/dark setting.
const INK = {
  bg: "linear-gradient(165deg, #14141A 0%, #0B0B0F 100%)",
  text: "rgba(255,255,255,0.94)",
  text2: "rgba(255,255,255,0.72)",
  muted: "rgba(255,255,255,0.46)",
  border: "rgba(255,255,255,0.08)",
  accent: "#00FF87",
};
// Matches THEMES.*.display in src/theme.js — identical across the light/dark
// theme variants, so it's safe to hardcode here alongside the fixed palette.
const DISPLAY_FONT = "'Poppins',system-ui,sans-serif";

export default function DailyCoachCard({ metrics, t, userId, dateIso }: DailyCoachCardProps) {
  const [nonce, setNonce] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const paraRefs = useRef<HTMLParagraphElement[]>([]);

  const result = useMemo(
    () => generateDailyCoach(metrics, { userId, dateIso, refreshNonce: nonce }),
    [metrics, userId, dateIso, nonce]
  );

  useEffect(() => {
    const cleanup = animateDailyCoachIn(cardRef.current, paraRefs.current.filter(Boolean));
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const renderRuns = (raw: string) =>
    splitHighlights(t(raw)).map((run, i) =>
      run.bold ? (
        <strong key={i} style={{ color: "#fff", fontWeight: 700 }}>{run.text}</strong>
      ) : (
        <React.Fragment key={i}>{run.text}</React.Fragment>
      )
    );

  return (
    <GlassSurface
      dark
      radius={24}
      blur={26}
      saturate={160}
      elevation="float"
      style={{ width: "100%", background: INK.bg, border: `1px solid ${INK.border}` }}
    >
      <div ref={cardRef} style={{ padding: 24, position: "relative" }}>
        {/* HEADER — ATHLOS mark + badge top-left, refresh + sparkles top-right */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 26, height: 26, borderRadius: 8, background: "rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon name="ai" size={14} color={INK.accent} />
            </span>
            <Mono style={{ color: INK.muted, fontSize: 9, letterSpacing: "0.18em" }}>{t("DAILY COACH")}</Mono>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => setNonce((n) => n + 1)}
              aria-label={t("Osveži")}
              style={{
                width: 30, height: 30, borderRadius: "50%", border: `1px solid ${INK.border}`, background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                color: INK.text2, WebkitTapHighlightColor: "transparent",
              }}
            >
              <RefreshCw size={13} strokeWidth={1.8} />
            </button>
            <span style={{
              width: 30, height: 30, borderRadius: "50%", border: `1px solid ${INK.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", color: INK.accent,
            }} aria-hidden="true">
              <Sparkles size={13} strokeWidth={1.8} />
            </span>
          </div>
        </div>

        {/* TITLE — the day's headline */}
        <div style={{
          fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 17, lineHeight: 1.4,
          color: INK.text, marginBottom: result.empty ? 0 : 16,
        }}>
          {renderRuns(result.title)}
        </div>

        {/* BODY — 3 paragraphs: why / activity / recommendation */}
        {!result.empty && (
          <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
            {result.paragraphs.map((p, i) => (
              <p
                key={i}
                ref={(el) => { if (el) paraRefs.current[i] = el; }}
                style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: INK.text2, fontFamily: DISPLAY_FONT }}
              >
                {renderRuns(p)}
              </p>
            ))}
          </div>
        )}

        {/* CLOSING QUESTION */}
        <p style={{
          margin: 0, paddingTop: 14, borderTop: `1px solid ${INK.border}`,
          fontSize: 13, fontStyle: "italic", color: INK.muted, fontFamily: DISPLAY_FONT,
        }}>
          {t(result.question)}
        </p>
      </div>
    </GlassSurface>
  );
}
