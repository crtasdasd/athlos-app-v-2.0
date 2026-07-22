import React, { useState } from "react";
import { useTheme } from "../theme";
import { Pressable, PrimaryBtn, BackBtn } from "../components/UI";
import { useT } from "../lib/i18n";
import { isNameAllowed } from "../lib/moderation";

export const SPORTS = [
  "Hokej", "Košarka", "Nogomet", "Odbojka", "Rokomet", "Borilne veščine", "Tenis",
  "Drugo",
];

export default function ScreenProfile({ go, profile, setProfile }) {
  const C = useTheme();
  const t = useT();
  const fileRef = React.useRef(null);
  const [name, setName] = useState(profile.name);
  const [nameErr, setNameErr] = useState("");
  const known = SPORTS.includes(profile.sport);
  const [sport, setSport] = useState(known ? profile.sport : "Drugo");
  const [customSport, setCustomSport] = useState(known ? "" : profile.sport);
  const [photo, setPhoto] = useState(profile.photo);
  const [pickSport, setPickSport] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase();

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(f);
  };

  const save = () => {
    if (!isNameAllowed(name)) { setNameErr("To ime ni dovoljeno — izberi drugo."); return; }
    const finalSport = sport === "Drugo" ? (customSport.trim() || "Drugo") : sport;
    // Merge — never replace the whole profile (would drop plan/lang/height/weight)
    setProfile((p) => ({ ...p, name: name.trim() || "Športnik", sport: finalSport, photo }));
    go("today");
  };


  const label = { fontFamily: C.display, fontWeight: 600, fontSize: 13, color: C.muted, display: "block" };
  const field = { width: "100%", marginTop: 6, padding: "10px 11px", borderRadius: 15, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontFamily: C.display, fontWeight: 700, fontSize: 15.5, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ padding: "8px 13px 18px", color: C.text }}>
      <header style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
        <BackBtn onClick={() => go("today")} />
        <span style={label}>{t("MOJ PROFIL")}</span>
      </header>

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11, marginBottom: 16 }}>
        <Pressable onClick={() => fileRef.current && fileRef.current.click()} scale={0.94} style={{ position: "relative", width: 110, height: 110, borderRadius: "50%", border: `1px solid ${C.border2}`, background: C.surface2, padding: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontWeight: 800, fontSize: 47, fontFamily: C.display }}>
          {photo
            ? <img src={photo} alt="profil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : initial}
          <span style={{ position: "absolute", bottom: 4, right: 4, width: 30, height: 30, borderRadius: "50%", background: C.accent, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
          </span>
        </Pressable>
        <div style={{ display: "flex", gap: 9 }}>
          <Pressable onClick={() => fileRef.current && fileRef.current.click()} scale={0.96} style={{ padding: "8px 13px", borderRadius: 999, border: `1px solid ${C.border}`, background: "none", color: C.text, fontFamily: C.display, fontSize: 13, fontWeight: 600 }}>{t("Naloži sliko")}</Pressable>
          {photo && (
            <Pressable onClick={() => setPhoto(null)} scale={0.96} style={{ padding: "8px 13px", borderRadius: 999, border: `1px solid ${C.border}`, background: "none", color: C.muted, fontFamily: C.display, fontSize: 13, fontWeight: 600 }}>{t("Odstrani")}</Pressable>
          )}
        </div>
      </div>

      <span style={label}>{t("IME")}</span>
      <input
        value={name}
        onChange={(e) => { setName(e.target.value); setNameErr(""); }}
        placeholder={t("Tvoje ime")}
        style={{ ...field, marginBottom: nameErr ? 5 : 16, ...(nameErr ? { borderColor: C.red } : {}) }}
      />
      {nameErr && <span style={{ color: C.red, fontFamily: C.display, fontSize: 12, marginBottom: 16, display: "block" }}>{t(nameErr)}</span>}

      <span style={label}>{t("ŠPORT")}</span>
      <Pressable onClick={() => setPickSport((v) => !v)} scale={0.99} style={{ ...field, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
        {sport}
        <span style={{ color: C.muted, transition: "transform 0.2s", transform: pickSport ? "rotate(180deg)" : "none" }}>▾</span>
      </Pressable>
      {pickSport && (
        <div style={{ marginTop: 6, border: `1px solid ${C.border}`, borderRadius: 15, overflow: "hidden", animation: "athlosFade 0.2s ease" }}>
          {SPORTS.map((s, i) => (
            <button key={i} onClick={() => { setSport(s); setPickSport(false); }}
              style={{ width: "100%", textAlign: "left", padding: "9px 11px", background: s === sport ? `${C.accent}14` : "transparent", border: "none", borderBottom: i < SPORTS.length - 1 ? `1px solid ${C.border}` : "none", color: s === sport ? C.accent : C.text2, fontFamily: C.display, fontWeight: 600, fontSize: 15, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {sport === "Drugo" && (
        <div style={{ animation: "athlosFade 0.2s ease" }}>
          <span style={{ ...label, marginTop: 11 }}>{t("VPIŠI ŠPORT")}</span>
          <input
            value={customSport}
            onChange={(e) => setCustomSport(e.target.value)}
            placeholder={t("npr. Odbojka, Judo, Veslanje...")}
            autoFocus
            style={field}
          />
        </div>
      )}

      <PrimaryBtn onClick={save} style={{ marginTop: 16 }}>{t("Shrani profil")}</PrimaryBtn>
    </div>
  );
}
