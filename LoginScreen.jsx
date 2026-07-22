import React, { useState } from "react";
import { LANDING_URL, useTheme } from "../theme";
import { PrimaryBtn, Wordmark } from "../components/UI";
import { signIn, signUp, signInWithProvider } from "../lib/api";
import { useT } from "../lib/i18n";

// ── Post-login launch splash — clean brand wordmark that blooms open, then
// fades into the app. No decorative artwork; matte-black canvas from tokens. ──
function LaunchAnimation({ onDone, C }) {
  React.useEffect(() => {
    const timer = setTimeout(onDone, 1220);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div className="app-fullscreen" style={{
      position: "fixed", inset: 0, zIndex: 1000, background: C.bg,
      display: "grid", placeItems: "center", overflow: "hidden",
      animation: "athlosSplashFade 1.22s cubic-bezier(.2,.8,.2,1) forwards",
    }}>
      <style>{`
        @keyframes athlosSplashFade { 0%,74%{opacity:1} 100%{opacity:0} }
        @keyframes athlosHeroOpen {
          0% { opacity: 0; transform: scale(0.9); filter: blur(4px); }
          38% { opacity: 1; transform: scale(1); filter: blur(0); }
          72% { opacity: 1; transform: scale(1.04); }
          100% { opacity: 0; transform: scale(1.5); filter: blur(4px); }
        }
        @media (prefers-reduced-motion: reduce) { .athlos-launch *{animation-duration:.001ms!important} }
      `}</style>
      <div className="athlos-launch" style={{ animation: "athlosHeroOpen 1.22s cubic-bezier(.18,.86,.24,1) forwards" }}>
        <Wordmark size={38} />
      </div>
    </div>
  );
}

export default function LoginScreen({ profile, setProfile, onLogin, onPrivacy }) {
  const C = useTheme();
  const t = useT();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  const slError = (msg = "") => {
    const m = msg.toLowerCase();
    if (m.includes("already registered") || m.includes("already been registered")) return "Račun s tem e-naslovom že obstaja. Prijavi se.";
    if (m.includes("invalid login credentials") || m.includes("napačni podatki")) return "Napačni podatki za prijavo.";
    if (m.includes("email not confirmed")) return "E-naslov še ni potrjen. Preveri svojo pošto.";
    if (m.includes("password should be") || m.includes("at least 6")) return "Geslo mora imeti vsaj 6 znakov.";
    if (m.includes("invalid email") || m.includes("validate email")) return "Vnesi veljaven e-naslov.";
    if (m.includes("rate limit") || m.includes("too many")) return "Preveč poskusov. Počakaj trenutek in poskusi znova.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Ni povezave s strežnikom. Preveri internet.";
    return msg || "Prišlo je do napake. Poskusi znova.";
  };

  const submit = async () => {
    if (!email.includes("@") || password.length < 1) { setError("Vnesi veljaven e-naslov in geslo."); return; }
    setBusy(true); setError("");
    try {
      if (mode === "signup") {
        if (password.length < 6) { setError("Geslo mora imeti vsaj 6 znakov."); setBusy(false); return; }
        try { await signUp(email, password); }
        catch (e) { setError(slError(e.message)); setBusy(false); return; }
      }
      const u = await signIn(email, password);
      setPendingUser(u); setLaunching(true);
    } catch (e) {
      const msg = slError(e.message);
      if (mode === "signup" && msg.includes("Napačni podatki")) {
        setError("Račun s tem e-naslovom že obstaja, geslo pa ni pravilno. Prijavi se s pravim geslom ali uporabi drugo e-pošto.");
      } else { setError(msg); }
    } finally { setBusy(false); }
  };

  const social = async (provider) => {
    setError(""); setBusy(true);
    try { await signInWithProvider(provider); }
    catch (e) {
      const m = (e.message || "").toLowerCase();
      if (m.includes("not enabled") || m.includes("unsupported provider") || m.includes("validation_failed")) {
        setError(provider === "apple" ? "Prijava z Apple računom še ni vklopljena." : "Prijava z Google računom še ni vklopljena.");
      } else { setError(slError(e.message)); }
      setBusy(false);
    }
  };

  // Consistent design-system form field — rounded, soft dark fill, hairline
  // border that lights up green on focus.
  const inp = {
    width: "100%", padding: "11px 11px", boxSizing: "border-box",
    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14,
    color: C.text, fontFamily: C.display, fontWeight: 600, fontSize: 14.5,
    outline: "none", transition: "border-color 0.2s", caretColor: C.accent,
  };
  const label = { fontFamily: C.mono, fontSize: 9, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, display: "block", marginBottom: 6 };

  if (launching) return <LaunchAnimation onDone={() => onLogin(pendingUser)} C={C} />;

  const socialBtn = {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "10px 8px", borderRadius: 14, border: "none", background: C.surface2,
    color: C.text, fontFamily: C.display, fontWeight: 600, fontSize: 14,
    cursor: "pointer", WebkitTapHighlightColor: "transparent",
  };

  return (
    <div className="app-fullscreen" style={{
      // Fill the phone shell (top+bottom anchors, height from .app-fullscreen:100%).
      position: "fixed", inset: 0,
      // Gym photo backdrop with a dark scrim so the form + text stay legible.
      backgroundColor: C.bg,
      backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.72) 55%, rgba(0,0,0,0.88) 100%), url('/img/login-gym.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      display: "flex", flexDirection: "column",
      overflow: "hidden", color: C.text,
    }}>
      <div style={{
        position: "relative", zIndex: 1, flex: 1, minHeight: 0,
        width: "100%", maxWidth: 430, margin: "0 auto",
        display: "flex", flexDirection: "column",
        padding: "calc(env(safe-area-inset-top, 24px) + 24px) 28px calc(env(safe-area-inset-bottom, 0px) * 0.6 + 16px)",
      }}>

        {/* ── Wordmark, top center ── */}
        <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <Wordmark size={22} />
        </div>

        <div style={{ flex: 1, minHeight: 24 }} />

        {/* ── Title block ── */}
        <h1 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 34, letterSpacing: "-0.02em", color: C.text, lineHeight: 1.05, margin: 0 }}>
          {mode === "signup" ? t("Registracija") : t("Prijava")}
        </h1>
        <p style={{ fontFamily: C.display, fontStyle: "italic", fontSize: 14, color: C.muted, margin: "6px 0 18px", lineHeight: 1.4 }}>
          {t("sistem, ki pozna vsakega športnika")}
        </p>

        {/* ── Email ── */}
        <div style={{ marginBottom: 11 }}>
          <span style={label}>{t("E-POŠTA")}</span>
          <input type="email" value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
            onFocus={e => e.target.style.borderColor = C.accent}
            onBlur={e => e.target.style.borderColor = C.border}
            placeholder="ime@email.com" autoComplete="email" style={inp} />
        </div>

        {/* ── Password ── */}
        <div style={{ marginBottom: 4 }}>
          <span style={label}>{t("GESLO")}</span>
          <div style={{ position: "relative" }}>
            <input type={showPass ? "text" : "password"} value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && submit()}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border}
              placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} style={{ ...inp, paddingRight: 46 }} />
            <button onClick={() => setShowPass(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4, lineHeight: 0 }}>
              {showPass
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8a18.1 18.1 0 015.06-5.94M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8a18.1 18.1 0 01-2.14 2.86M1 1l22 22"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: C.red, fontSize: 12.5, marginTop: 10, fontFamily: C.display, padding: "8px 10px", borderRadius: 10, background: `${C.red}1f`, border: `1px solid ${C.red}55` }}>
            {t(error)}
          </div>
        )}

        <button onClick={() => window.open(LANDING_URL, "_blank", "noopener,noreferrer")} style={{ alignSelf: "flex-end", background: "none", border: "none", color: C.muted, fontFamily: C.display, fontSize: 12, fontWeight: 500, cursor: "pointer", marginTop: 9, padding: 0 }}>
          {t("Pozabljeno geslo?")}
        </button>

        {/* ── Primary CTA — solid brand green ── */}
        <PrimaryBtn onClick={submit} disabled={busy} style={{ marginTop: 14 }}>
          {busy ? t("Počakaj…") : mode === "signup" ? t("Ustvari račun") : t("Vstopi")}
        </PrimaryBtn>

        {/* ── Secondary — soft surface, toggles login/signup ── */}
        <button onClick={() => { setMode(m => (m === "signup" ? "login" : "signup")); setError(""); }} style={{
          width: "100%", height: 52, marginTop: 8, borderRadius: 15, border: "none",
          background: C.surface2, color: C.text,
          fontFamily: C.display, fontWeight: 600, fontSize: 14,
          cursor: "pointer", WebkitTapHighlightColor: "transparent",
        }}>
          {mode === "signup" ? t("Prijava") : t("Registracija")}
        </button>

        {/* ── Social ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "16px 0 10px" }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ ...label, marginBottom: 0, fontSize: 9 }}>{t("ALI")}</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => social("apple")} style={socialBtn}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            Apple
          </button>
          <button onClick={() => social("google")} style={socialBtn}>
            <svg width="17" height="17" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </button>
        </div>

        <button onClick={onPrivacy} style={{ background: "none", border: "none", color: C.muted2, fontFamily: C.display, fontSize: 12, fontWeight: 500, cursor: "pointer", marginTop: 11, padding: 0, textAlign: "center", width: "100%" }}>
          {t("Politika zasebnosti")}
        </button>
      </div>
    </div>
  );
}
