import React, { useState } from "react";
import { useTheme, LANDING_URL } from "../theme";
import { Pressable } from "../components/UI";
import ConfirmDialog from "../components/ConfirmDialog";
import { uploadAvatar } from "../lib/api";
import { useT } from "../lib/i18n";

const FAQ_ITEMS = [
  { q: "Kako dodam nov trening?", a: "Pojdi na zavihek Trening, pritisni 'Začni trening' in sledi navodilom. Aplikacija te vodi skozi vsako vajo." },
  { q: "Kako deluje regeneracijski score?", a: "Score temelji na tvojih podatkih o spanju, HRV in srčnem utripu v mirovanju. Višji score pomeni boljšo pripravljenost za trening." },
  { q: "Ali so moji podatki varni?", a: "Vsi podatki so shranjeni lokalno na tvojem telefonu. Nič ni poslano na strežnike brez tvoje privolitve." },
  { q: "Kako sinhroniziram z uro?", a: "Trenutno podpiramo Apple Watch in Garmin. Pojdi v Nastavitve → Naprave in sledni navodilom za povezavo." },
  { q: "Kako spremenem cilj sezone?", a: "Odpri zavihek Sezona, pritisni na cilj in ga uredi. Aplikacija samodejno prilagodi tvoj program." },
  { q: "Zakaj ne vidim napredka?", a: "Napredek se izračuna po vsaj 2 tednih rednega beleženja. Poskrbi, da redno vnaša treninge in spanje." },
];

export default function ScreenSettings({ profile, setProfile, user, theme, setTheme, onPrivacy, onAccount, onLogout }) {
  const C = useTheme();
  const t = useT();
  const fileRef = React.useRef(null);

  // FAQ
  const [openFaq, setOpenFaq] = useState(null);

  // Contact
  const [contactOpen, setContactOpen] = useState(false);
  const [contactMsg, setContactMsg] = useState("");
  const [contactSent, setContactSent] = useState(false);

  // Full-screen profile-photo preview (tap the avatar, TikTok-style)
  const [photoPreview, setPhotoPreview] = useState(false);

  // Logout confirmation dialog — logout only fires after the user confirms.
  // Escape/Android-back dismissal is handled inside ConfirmDialog itself.
  const [confirmLogout, setConfirmLogout] = useState(false);

  const initial = (profile.name || "?").trim().charAt(0).toUpperCase();
  // Real account e-mail — hidden for the offline/local session (no address)
  const email = user?.email && user.id !== "local" ? user.email : null;

  // Downscale to ≤512px JPEG — uploads stay small and the offline fallback
  // (data URL) fits in the profile cache without breaking the cloud upsert.
  const compressImage = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 512;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const blob = await compressImage(f);
      // Cloud first: a Storage URL persists on the account across devices.
      // If the upload fails (offline, no bucket), fall back to a local data URL.
      let photo = null;
      if (user?.id && user.id !== "local") {
        try { photo = await uploadAvatar(user.id, blob); } catch {}
      }
      if (!photo) {
        photo = await new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(blob);
        });
      }
      setProfile((p) => ({ ...p, photo }));
    } catch {}
  };

  const sendContact = () => {
    if (!contactMsg.trim()) return;
    setContactSent(true);
    setTimeout(() => { setContactOpen(false); setContactMsg(""); setContactSent(false); }, 2000);
  };

  // ── Shared styles (de-duplicated) ───────────────────────────────
  const inp = { width: "100%", padding: "10px 11px", borderRadius: 15, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontFamily: C.display, fontWeight: 600, fontSize: 15, outline: "none", boxSizing: "border-box", colorScheme: C.name === "dark" ? "dark" : "light", marginTop: 6 };
  const primaryBtn = { borderRadius: 999, border: "none", background: C.btn, color: C.btnText, fontFamily: C.display, fontWeight: 800, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  const outlineBtn = { borderRadius: 999, border: `1px solid ${C.border2}`, background: "transparent", color: C.text, fontFamily: C.display, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 9 };

  // ── One consistent icon family (feather-style strokes) ──────────
  const sv = (c) => ({ width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" });
  const IC = {
    user:    (c) => (<svg {...sv(c)}><circle cx="12" cy="8" r="3.4" /><path d="M5 20v-1a7 7 0 0114 0v1" /></svg>),
    help:    (c) => (<svg {...sv(c)}><circle cx="12" cy="12" r="9" /><path d="M9.2 9.2a2.8 2.8 0 015.4 1c0 1.9-2.8 2.5-2.8 2.5" /><path d="M12 17h.01" /></svg>),
    mail:    (c) => (<svg {...sv(c)}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7.5l8.5 5.5 8.5-5.5" /></svg>),
    shield:  (c) => (<svg {...sv(c)}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>),
    globe:   (c) => (<svg {...sv(c)}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></svg>),
    logout:  (c) => (<svg {...sv(c)}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>),
    moon:    (c) => (<svg {...sv(c)}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>),
    sun:     (c) => (<svg {...sv(c)}><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>),
  };
  const chevron = (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.muted2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
  );

  // Clean list row — icon tile · title (+ subtitle) · right accessory.
  // Called as a function (not <Row/>) so element types stay stable and
  // inputs nested nearby never remount.
  const Row = ({ icon, title, subtitle, onClick, danger, first, accessory }) => {
    // Neutral tiles by default; green stays reserved for accents — the only
    // coloured icon here is the destructive logout (red).
    const iconCol = danger ? C.red : C.text2;
    return (
      <Pressable onClick={onClick} scale={0.985} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 9,
        padding: "9px 11px", background: "none",
        border: "none", borderTop: first ? "none" : `1px solid ${C.border}`,
        textAlign: "left",
      }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, background: C.surface2, border: `1px solid ${C.border}`, color: iconCol, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon(iconCol)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: C.display, fontWeight: 600, fontSize: 14, color: danger ? C.red : C.text }}>{title}</span>
          {subtitle && <span style={{ display: "block", fontFamily: C.display, fontSize: 11.5, color: C.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</span>}
        </span>
        {accessory !== undefined ? accessory : chevron}
      </Pressable>
    );
  };

  return (
    <div style={{ padding: "8px 13px 23px" }}>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

      {/* ── Profile header — spacious, centered ── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "10px 0 17px" }}>
        <div style={{ position: "relative", width: 112, height: 112, marginBottom: 11 }}>
          {/* Tap the avatar to preview it full-screen (TikTok-style); with no
              photo yet there's nothing to preview, so it opens the picker. */}
          <Pressable onClick={() => (profile.photo ? setPhotoPreview(true) : fileRef.current?.click())} scale={0.94} style={{ width: 112, height: 112, borderRadius: "50%", border: `1px solid ${C.border2}`, background: C.surface2, padding: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: C.text2, fontWeight: 800, fontSize: 44, fontFamily: C.display }}>
            {profile.photo ? <img src={profile.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
          </Pressable>
          {/* Subtle edit badge — neutral dark chip, opens the picker */}
          <Pressable onClick={() => fileRef.current && fileRef.current.click()} scale={0.9} style={{ position: "absolute", right: 4, bottom: 4, width: 28, height: 28, borderRadius: "50%", background: C.surface2, border: `2px solid ${C.bg}`, color: C.text2, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: C.name === "dark" ? "none" : "0 1px 3px rgba(28,24,20,0.12)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
            <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{t("Slika")}</span>
          </Pressable>
        </div>
        <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 20, color: C.text, letterSpacing: "-0.01em" }}>{profile.name}</div>
        {email && <div style={{ fontFamily: C.display, fontWeight: 500, fontSize: 13, color: C.muted, marginTop: 4 }}>{email}</div>}
        {profile.sport && (
          <span style={{ marginTop: 9, padding: "4px 9px", borderRadius: 999, background: C.surface2, border: `1px solid ${C.border2}`, color: C.accent, fontFamily: C.display, fontWeight: 600, fontSize: 11, letterSpacing: "0.01em" }}>{profile.sport}</span>
        )}
      </div>

      {/* ── Account ── */}
      <div style={card}>
        {Row({ icon: IC.user, title: profile.name, subtitle: t("Ime, e-pošta, geslo, jezik, obvestila in plan"), onClick: onAccount, first: true })}
      </div>

      {/* ── Appearance / theme — iOS-style segmented control ── */}
      <div style={card}>
        <div style={{ padding: 15 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, background: C.surface2, border: `1px solid ${C.border}`, color: C.text2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {(theme === "light" ? IC.sun : IC.moon)(C.text2)}
            </span>
            <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 14, color: C.text }}>{t("Tema")}</span>
          </div>
          <div role="group" aria-label={t("Tema")} style={{ display: "flex", gap: 4, padding: 4, borderRadius: 13, background: C.surface2, border: `1px solid ${C.border}` }}>
            {[["dark", IC.moon, t("Temna")], ["light", IC.sun, t("Svetla")]].map(([mode, ico, lbl]) => {
              const active = theme === mode;
              return (
                <button key={mode} onClick={() => setTheme(mode)} aria-pressed={active} style={{
                  flex: 1, padding: "8px", borderRadius: 9, cursor: "pointer", border: "none",
                  background: active ? C.accent : "transparent",
                  color: active ? C.btnText : C.muted,
                  fontFamily: C.display, fontWeight: active ? 700 : 600, fontSize: 13,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  WebkitTapHighlightColor: "transparent", transition: "background 0.18s ease, color 0.18s ease",
                }}>
                  {ico(active ? C.btnText : C.muted)}
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Support: FAQ + contact ── */}
      <div style={card}>
        {/* FAQ — collapsed row, or the expanded question list */}
        {!openFaq ? (
          Row({ icon: IC.help, title: t("Pogosta vprašanja"), subtitle: `${FAQ_ITEMS.length} ${t("vprašanj in odgovorov")}`, onClick: () => setOpenFaq(true), first: true })
        ) : (
          <div style={{ padding: "10px 11px", animation: "athlosFade 0.2s ease" }}>
            <Pressable onClick={() => setOpenFaq(null)} scale={0.99} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: "0 0 9px", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 13, color: C.muted }}>{t("ZAPRI")}</span>
            </Pressable>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {FAQ_ITEMS.map((item, i) => (
                <div key={i}>
                  <Pressable
                    onClick={() => setOpenFaq(openFaq === i ? true : i)}
                    scale={0.99}
                    style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: "9px 0", gap: 9 }}
                  >
                    <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 14, color: C.text, flex: 1 }}>{t(item.q)}</span>
                    <span style={{ color: C.muted, fontSize: 15.5, transition: "transform 0.2s", transform: openFaq === i ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}>›</span>
                  </Pressable>
                  {openFaq === i && (
                    <div style={{ padding: "0 0 9px", animation: "athlosFade 0.2s ease" }}>
                      <p style={{ fontFamily: C.display, fontSize: 13, color: C.text2, lineHeight: 1.6, margin: 0 }}>{t(item.a)}</p>
                    </div>
                  )}
                  {i < FAQ_ITEMS.length - 1 && <div style={{ height: 1, background: C.border }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact — collapsed row, success state, or the message form */}
        {!contactOpen ? (
          Row({ icon: IC.mail, title: t("Pošlji sporočilo"), subtitle: t("odgovorimo v 24 urah"), onClick: () => setContactOpen(true), first: false })
        ) : contactSent ? (
          <div style={{ borderTop: `1px solid ${C.border}`, padding: 16, animation: "athlosFade 0.2s ease" }}>
            <div style={{ padding: 16, borderRadius: 15, background: `${C.accent}14`, border: `1px solid ${C.accent}40`, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.accent }}>{t("Sporočilo poslano!")}</div>
              <div style={{ fontFamily: C.display, fontSize: 13, color: C.text2, marginTop: 4 }}>{t("Odgovorili vam bomo v 24 urah.")}</div>
            </div>
          </div>
        ) : (
          <div style={{ borderTop: `1px solid ${C.border}`, padding: 16, display: "flex", flexDirection: "column", gap: 6, animation: "athlosFade 0.2s ease" }}>
            <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 12, color: C.muted }}>{t("VAŠE SPOROČILO")}</span>
            <textarea
              value={contactMsg}
              onChange={(e) => setContactMsg(e.target.value)}
              placeholder={t("Opišite vašo težavo ali vprašanje...")}
              rows={4}
              style={{ ...inp, resize: "none", lineHeight: 1.5 }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
              <button onClick={() => { setContactOpen(false); setContactMsg(""); }} style={{ ...outlineBtn, flex: 1, padding: "9px", fontSize: 13 }}>{t("Prekliči")}</button>
              <button onClick={sendContact} style={{ ...primaryBtn, flex: 2, padding: "9px", fontSize: 13, opacity: contactMsg.trim() ? 1 : 0.4 }}>{t("Pošlji")}</button>
            </div>
          </div>
        )}
      </div>

      {/* ── About: legal + website ── */}
      <div style={card}>
        {Row({ icon: IC.shield, title: t("Politika zasebnosti"), onClick: onPrivacy, first: true })}
        {Row({ icon: IC.globe, title: "ATHLOS", subtitle: t("odpre v brskalniku"), onClick: () => window.open(LANDING_URL, "_blank", "noopener,noreferrer"), accessory: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
        ) })}
      </div>

      {/* ── Logout (opens a confirmation dialog) ── */}
      <div style={{ ...card, marginBottom: 14 }}>
        {Row({ icon: IC.logout, title: t("Odjava"), danger: true, first: true, onClick: () => setConfirmLogout(true), accessory: null })}
      </div>

      <p style={{ textAlign: "center", color: C.muted2, fontFamily: C.display, fontSize: 12, marginTop: 6 }}>ATHLOS v0.6 · © 2026</p>

      {/* Full-screen photo preview — TikTok-style: tap the avatar, see it big,
          tap the ✕ or backdrop to dismiss, or jump straight to changing it. */}
      {photoPreview && profile.photo && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setPhotoPreview(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,8,8,0.94)", display: "flex", flexDirection: "column", animation: "athlosFade 0.2s ease" }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "max(16px, env(safe-area-inset-top, 16px)) 18px 12px" }}>
            <button onClick={() => setPhotoPreview(false)} aria-label={t("Zapri")} style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.08)", color: "#FFFFFF", fontSize: 22.5, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>×</button>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
            <img src={profile.photo} alt="" style={{ width: "100%", maxWidth: 320, aspectRatio: "1 / 1", borderRadius: "50%", objectFit: "cover" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 24px max(24px, env(safe-area-inset-bottom, 24px))" }}>
            <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15.5, color: "#FFFFFF" }}>{profile.name}</div>
            <button
              onClick={() => { setPhotoPreview(false); fileRef.current?.click(); }}
              style={{ padding: "8px 15px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)", color: "#FFFFFF", fontFamily: C.display, fontWeight: 700, fontSize: 13, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
            >
              {t("Zamenjaj sliko")}
            </button>
          </div>
        </div>
      )}

      {/* Logout confirmation — shared ConfirmDialog. Its own primary button
          was already styled as a destructive coral pill before this pass
          (ending your session is the one "off-path exit" action, same
          convention as iOS's own red-styled Sign Out row) — tone="danger"
          matches that, rather than softening it to the accent green. */}
      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        tone="danger"
        title={`Are you sure you want to log out${profile?.name ? `, ${profile.name}` : ""}?`}
        description={t("Z odjavo boš zaključil trenutno sejo in ne boš več imel dostopa do svojega računa.")}
        confirmLabel={t("Odjava")}
        onConfirm={onLogout}
        cancelLabel={t("Prekliči")}
      />
    </div>
  );
}
