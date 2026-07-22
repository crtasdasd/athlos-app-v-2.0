import React from "react";
import { useTheme } from "../theme";
import { Mono } from "../components/UI";

export default function ConsentScreen({ onAccept, onReject }) {
  const C = useTheme();

  return (
    <div className="app-fullscreen" style={{
      // top+bottom so it fills the whole phone shell (no empty strip at the
      // bottom on mobile, where 100dvh can be shorter than the shell)
      position: "fixed", inset: 0,
      background: C.bg,
      display: "flex", flexDirection: "column",
      paddingTop: "env(safe-area-inset-top, 44px)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {/* Title */}
      <div style={{ padding: "11px 16px 9px", borderBottom: `1px solid ${C.border}`, flexShrink: 0, textAlign: "center" }}>
        <Mono style={{ color: C.muted, fontSize: 10 }}>ATHLOS · PERSONALIZACIJA</Mono>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "14px 15px 6px" }}>
        <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 24.5, color: C.text, margin: "0 0 11px", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
          Upravljaj svoje izbire
        </h2>

        <p style={{ color: C.text2, fontSize: 13, lineHeight: 1.65, margin: "0 0 10px", fontFamily: C.display }}>
          Da ti lahko zagotovimo najboljšo izkušnjo, ATHLOS d.o.o. uporablja določene tehnologije za personalizacijo vsebin, analitiko in varnost aplikacije.
        </p>

        <p style={{ color: C.text2, fontSize: 13, lineHeight: 1.65, margin: "0 0 10px", fontFamily: C.display }}>
          Nekatera od teh so <span style={{ color: C.text, fontWeight: 600 }}>obvezna</span> — brez njih aplikacija ne more delovati. Ostale so opcijske in nam pomagajo izboljšati storitev.
        </p>

        {[
          { title: "Nujno potrebne tehnologije", body: "Omogočajo osnovno delovanje aplikacije: prijavo, varno sejo in shranjevanje tvojih podatkov o treningih.", required: true },
          { title: "Analitika in izboljšave", body: "Analiziramo, kako uporabljaš ATHLOS, da izboljšamo funkcije in odpravljamo napake. Podatki so anonimizirani." },
          { title: "Personalizirana priporočila", body: "Na podlagi tvojih podatkov ti generiramo prilagojene treninge in prehransko svetovanje." },
        ].map(s => (
          <div key={s.title} style={{ padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text }}>{s.title}</span>
              {s.required && <span style={{ fontFamily: C.mono, fontSize: 8.5, letterSpacing: "0.1em", color: "#000", background: C.accent, padding: "2px 6px", borderRadius: 999, fontWeight: 700 }}>OBVEZNO</span>}
            </div>
            <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, margin: 0, fontFamily: C.display }}>{s.body}</p>
          </div>
        ))}

        <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, margin: "10px 0 0", fontFamily: C.display, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          Svojo izbiro lahko kadar koli spreminjaš v <span style={{ color: C.text }}>Nastavitve → Zasebnost</span>.
        </p>
      </div>

      {/* Buttons */}
      <div style={{ flexShrink: 0, padding: "9px 11px", borderTop: `1px solid ${C.border}`, background: C.bg, display: "flex", gap: 8 }}>
        <button onClick={onReject} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${C.border2}`, background: "transparent", color: C.text, fontFamily: C.display, fontWeight: 700, fontSize: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          Zavrni vse
        </button>
        <button onClick={onAccept} style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: C.accent, color: "#000", fontFamily: C.display, fontWeight: 800, fontSize: 14, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          Sprejmi vse
        </button>
      </div>

      <div style={{ padding: "8px 11px", paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)", textAlign: "center", flexShrink: 0 }}>
        <button onClick={onAccept} style={{ background: "none", border: "none", color: C.accent, fontFamily: C.display, fontWeight: 600, fontSize: 13, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
          Prilagodi svoje izbire
        </button>
      </div>
    </div>
  );
}
