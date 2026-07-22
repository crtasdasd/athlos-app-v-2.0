import React, { useState } from "react";
import { Mono } from "../../components/UI";

// Per spec (ATHLOS-dodatki-spec.pdf, §02 · Poškodba):
// Sits directly below the readiness medallion. Completely hidden when there's
// no active injury — never shows an empty "0 injuries" placeholder.
//
// injury shape: { name, phase: 0-3, progressNote, returnWeeks, returnDate, coachNote? }
const PHASES = ["Akutno", "Protokol", "Re-load", "Return"];

export default function InjuryWidget({ injury, C, t, isCoach = false }) {
  const [coachView, setCoachView] = useState(false);

  if (!injury) return null;

  const showCoachNote = isCoach && coachView && injury.coachNote;

  return (
    <div style={{ display: "flex", gap: 11, padding: "5px 4px", marginBottom: 14 }}>
      {/* vertical phase rail — the injury reads as a timeline, not a card */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 5 }}>
        {PHASES.map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && <span style={{ width: 2, flex: 1, minHeight: 16, background: i <= injury.phase ? C.red : C.border2 }} />}
            <span style={{
              width: i === injury.phase ? 12 : 8, height: i === injury.phase ? 12 : 8,
              borderRadius: "50%", flexShrink: 0,
              background: i <= injury.phase ? C.red : "transparent",
              border: `2px solid ${i <= injury.phase ? C.red : C.border2}`,
              transition: "background 0.3s, border-color 0.3s",
            }} />
          </React.Fragment>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
          <Mono style={{ color: C.red, fontSize: 9, letterSpacing: "0.16em" }}>{t("AKTIVNA POŠKODBA")}</Mono>
          {isCoach ? (
            <button
              onClick={() => setCoachView((v) => !v)}
              style={{ fontFamily: C.display, fontWeight: 600, fontSize: 11, color: C.muted, background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
            >
              {coachView ? t("Pogled trenerja") : t("Pogled igralca")}
            </button>
          ) : (
            <Mono style={{ color: C.muted, fontSize: 9 }}>~{injury.returnWeeks} {t("tedne")}</Mono>
          )}
        </div>

        <h3 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 17, color: C.text, margin: "0 0 5px", lineHeight: 1.2 }}>{t(injury.name)}</h3>
        <Mono style={{ color: C.muted, fontSize: 8.5, display: "block", marginBottom: 8 }}>
          {t("FAZA")} {injury.phase + 1}/{PHASES.length} · {t(PHASES[injury.phase])} · {t(injury.returnDate)}
        </Mono>

        <p style={{ fontFamily: C.display, fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>{t(injury.progressNote)}</p>

      {showCoachNote && (
        <div style={{ marginTop: 9, padding: 12, borderRadius: 10, background: C.surface3, border: `1px solid ${C.border}` }}>
          <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>{t("INTERNE OPOMBE")}</Mono>
          <p style={{ fontFamily: C.display, fontSize: 12, color: C.text2, margin: 0 }}>{injury.coachNote}</p>
        </div>
      )}
      </div>
    </div>
  );
}
