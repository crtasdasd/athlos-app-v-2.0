import React, { useState } from "react";
import { useTheme } from "../theme";
import { Pressable, Card, SectionLabel, BackBtn, Mono } from "../components/UI";
import { changePassword, requestPasswordReset, changeEmail, deleteAccount, isNameTaken } from "../lib/api";
import { useT } from "../lib/i18n";

const PLANS = [
  {
    id: "basic",
    name: "BASIC",
    earlyBird: "€29",
    regular: "€49",
    color: "#60A5FA",
    features: [
      "AI program + jedilnik",
      "Zasebni sezonski koledar",
      "AI asistent 24/7",
      "Dnevni log + history",
      "Community (opcijsko)",
    ],
    notIncluded: ["Daily Performance Report","Biometrija Apple Health","Video analiza","Post-match recovery","Tedna AI analiza","Ekskluzivni content","Early access"],
  },
  {
    id: "pro",
    name: "PRO",
    earlyBird: "€59",
    regular: "€99",
    color: "#863bff",
    badge: "PRILJUBLJEN",
    features: [
      "AI program + jedilnik",
      "Zasebni sezonski koledar",
      "AI asistent 24/7",
      "Dnevni log + history",
      "Community (opcijsko)",
      "Daily Performance Report",
      "Biometrija Apple Health",
      "Video analiza · 10/mes",
      "Post-match recovery",
    ],
    notIncluded: ["Tedna AI analiza","Ekskluzivni content (Tim)","Early access novih funkcij"],
  },
  {
    id: "elite",
    name: "ELITE",
    earlyBird: "€89",
    regular: "€149",
    color: "#FFB800",
    badge: "OPCIJSKO",
    features: [
      "Vse iz PRO plana",
      "Tedna AI analiza napredka",
      "Ekskluzivni content (Tim)",
      "Early access novih funkcij",
      "Video analiza · Neomejeno",
      "Post-match recovery",
    ],
    notIncluded: [],
    note: "Elite je opcijsko — se potrjuje.",
  },
];

// Account identity + security — split out of the main Settings list so that
// list doesn't have to carry name/email/password/language/plan alongside
// theme/legal. Reached from Settings via the "Račun" row.
export default function ScreenAccount({ profile, setProfile, user, onBack, onAccountDeleted }) {
  const C = useTheme();
  const t = useT();


  // Push-notification permission (device-level, via the browser API)
  const [notifPerm, setNotifPerm] = useState(() => {
    if (typeof window !== "undefined" && "Notification" in window) return Notification.permission;
    return "unsupported";
  });
  const toggleNotifs = async () => {
    if (!("Notification" in window) || notifPerm === "denied" || notifPerm === "granted") return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  const currentPlan = profile.plan || "basic";
  const [planOpen, setPlanOpen] = useState(false);

  const [name, setName] = useState(profile.name);
  const [editingName, setEditingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const [email, setEmail] = useState(user?.email || "");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  const [changingPw, setChangingPw] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const [resetMsg, setResetMsg] = useState("");
  const [resetting, setResetting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  // Plan tiers keep a distinct identity, but via C.* metric tokens (no raw hex)
  const planColors = { basic: C.aqua, pro: C.lav, elite: C.amber };

  const row = { display: "flex", justifyContent: "space-between", alignItems: "center" };
  const cardStyle = { marginBottom: 9 };
  const inp = { width: "100%", padding: "10px 11px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.surface3, color: C.text, fontFamily: C.display, fontWeight: 600, fontSize: 15, outline: "none", boxSizing: "border-box" };
  const editBtn = { padding: "7px 11px", borderRadius: 999, border: `1px solid ${C.border2}`, background: "transparent", color: C.accent, fontFamily: C.display, fontSize: 13, fontWeight: 700 };
  const primaryBtn = { borderRadius: 999, border: "none", background: C.btn, color: C.btnText, fontFamily: C.display, fontWeight: 800, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  const outlineBtn = { borderRadius: 999, border: `1px solid ${C.border2}`, background: "transparent", color: C.text, fontFamily: C.display, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  const msgBox = (ok) => ({ padding: "8px 10px", borderRadius: 12, background: ok ? `${C.accent}14` : `${C.red}14`, border: `1px solid ${ok ? C.accent : C.red}40`, color: ok ? C.accent : C.red, fontFamily: C.display, fontSize: 13, marginTop: 8 });

  const saveName = async () => {
    const n = name.trim();
    if (!n) return;
    // Display names are unique across accounts (matches the DB unique index)
    if (n.toLowerCase() !== (profile.name || "").toLowerCase() && await isNameTaken(n).catch(() => false)) {
      setNameMsg("To ime je že zasedeno — izberi drugo.");
      return;
    }
    setNameMsg("");
    setProfile((p) => ({ ...p, name: n }));
    setEditingName(false);
  };

  const saveEmail = async () => {
    if (!email.includes("@")) { setEmailMsg("Vnesi veljaven e-naslov."); return; }
    try {
      await changeEmail(email.trim());
      setEmailMsg("✓ Poslali smo potrditveno povezavo na nov e-naslov.");
      setTimeout(() => { setEditingEmail(false); setEmailMsg(""); }, 2400);
    } catch (e) {
      setEmailMsg(e.message || "Napaka pri spremembi e-pošte.");
    }
  };

  const savePassword = async () => {
    if (!oldPw || !newPw) { setPwMsg("Izpolni oba polja."); return; }
    if (newPw.length < 6) { setPwMsg("Novo geslo mora imeti vsaj 6 znakov."); return; }
    try {
      await changePassword(oldPw, newPw);
      setPwMsg("✓ Geslo uspešno posodobljeno.");
      setTimeout(() => { setChangingPw(false); setOldPw(""); setNewPw(""); setPwMsg(""); }, 1800);
    } catch (e) {
      setPwMsg(e.message || "Napaka pri spremembi gesla.");
    }
  };

  const confirmWord = "DELETE";
  const runDeleteAccount = async () => {
    setDeleting(true);
    setDeleteMsg("");
    try {
      await deleteAccount();
      onAccountDeleted?.();
    } catch (e) {
      setDeleteMsg(e.message || "Something went wrong — try again.");
      setDeleting(false);
    }
  };

  const sendReset = async () => {
    if (!email) { setResetMsg("Ni e-naslova za ta račun."); return; }
    setResetting(true);
    try {
      await requestPasswordReset(email);
      setResetMsg("✓ Povezava za ponastavitev je bila poslana na e-naslov zgoraj.");
    } catch (e) {
      setResetMsg(e.message || "Napaka pri pošiljanju.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ padding: "8px 13px 18px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 15 }}>
        <BackBtn onClick={onBack} />
        <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22, margin: 0, color: C.text, letterSpacing: "-0.02em" }}>{t("Račun")}</h2>
      </header>

      {/* Username */}
      <Card style={cardStyle}>
        <SectionLabel>{t("UPORABNIŠKO IME")}</SectionLabel>
        {!editingName ? (
          <div style={row}>
            <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 15, color: C.text }}>{profile.name}</span>
            <Pressable onClick={() => { setName(profile.name); setEditingName(true); }} scale={0.95} style={editBtn}>{t("Uredi")}</Pressable>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={name} onChange={(e) => { setName(e.target.value); setNameMsg(""); }} onKeyDown={(e) => e.key === "Enter" && saveName()} style={{ ...inp, flex: 1, borderColor: nameMsg ? C.red : C.border }} />
              <Pressable onClick={saveName} scale={0.93} style={{ ...primaryBtn, padding: "0 14px" }}>{t("Shrani")}</Pressable>
            </div>
            {nameMsg && <div style={msgBox(false)}>{t(nameMsg)}</div>}
          </>
        )}
      </Card>

      {/* Email */}
      <Card style={cardStyle}>
        <SectionLabel>{t("E-POŠTA")}</SectionLabel>
        {!editingEmail ? (
          <div style={row}>
            <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 15, color: C.text }}>{email || t("Ni nastavljeno")}</span>
            <Pressable onClick={() => { setEmailMsg(""); setEditingEmail(true); }} scale={0.95} style={editBtn}>{t("Uredi")}</Pressable>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ime@email.com" style={inp} />
            {emailMsg && <div style={msgBox(emailMsg.startsWith("✓"))}>{t(emailMsg)}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button onClick={() => { setEditingEmail(false); setEmail(user?.email || ""); setEmailMsg(""); }} style={{ ...outlineBtn, flex: 1, padding: "9px", fontSize: 13 }}>{t("Prekliči")}</button>
              <button onClick={saveEmail} style={{ ...primaryBtn, flex: 2, padding: "9px", fontSize: 13 }}>{t("Shrani")}</button>
            </div>
          </div>
        )}
      </Card>

      {/* Password */}
      <Card style={cardStyle}>
        <SectionLabel>{t("GESLO")}</SectionLabel>
        {!changingPw ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={row}>
              <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 14, color: C.text }}>{t("Spremeni geslo")}</span>
              <Pressable onClick={() => setChangingPw(true)} scale={0.95} style={editBtn}>{t("Uredi")}</Pressable>
            </div>
            <div style={{ width: "100%", height: 1, background: C.border }} />
            <div style={row}>
              <div>
                <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 14, color: C.text2 }}>{t("Pozabljeno geslo?")}</span>
                {email && <Mono style={{ display: "block", color: C.muted, fontSize: 9, marginTop: 3 }}>{email}</Mono>}
              </div>
              <Pressable onClick={sendReset} disabled={resetting} scale={0.95} style={{ ...editBtn, opacity: resetting ? 0.6 : 1 }}>{resetting ? t("Pošiljam…") : t("Ponastavi")}</Pressable>
            </div>
            {resetMsg && <div style={msgBox(resetMsg.startsWith("✓"))}>{t(resetMsg)}</div>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 12, color: C.muted }}>{t("TRENUTNO GESLO")}</span>
            <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="••••••••" style={inp} />
            <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 12, color: C.muted, marginTop: 6 }}>{t("NOVO GESLO")}</span>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••" style={inp} />
            {pwMsg && <div style={msgBox(pwMsg.startsWith("✓"))}>{t(pwMsg)}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => { setChangingPw(false); setOldPw(""); setNewPw(""); setPwMsg(""); }} style={{ ...outlineBtn, flex: 1, padding: "9px", fontSize: 13 }}>{t("Prekliči")}</button>
              <button onClick={savePassword} style={{ ...primaryBtn, flex: 2, padding: "9px", fontSize: 13 }}>{t("Shrani geslo")}</button>
            </div>
          </div>
        )}
      </Card>

      {/* Notifications — moved here from Settings so the account screen owns
          everything personal (identity, security, notifications, plan) */}
      <Card style={cardStyle}>
        <SectionLabel>{t("OBVESTILA")}</SectionLabel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 14, color: C.text }}>{t("Potisna obvestila")}</span>
            <div style={{ fontFamily: C.display, fontSize: 12, color: C.muted, marginTop: 3 }}>
              {notifPerm === "granted"
                ? t("Vklopljeno")
                : notifPerm === "denied"
                ? t("Blokirano — dovoli v nastavitvah naprave")
                : notifPerm === "unsupported"
                ? t("Ni podprto v tem brskalniku")
                : t("Izklopljeno")}
            </div>
          </div>
          {notifPerm !== "unsupported" && (
            <button
              onClick={toggleNotifs}
              disabled={notifPerm === "denied"}
              style={{
                width: 50, height: 28, borderRadius: 999, flexShrink: 0,
                background: notifPerm === "granted" ? C.accent : C.surface3,
                border: `1px solid ${notifPerm === "granted" ? C.accent : C.border2}`,
                cursor: notifPerm === "denied" ? "not-allowed" : "pointer",
                position: "relative", transition: "background 0.22s", padding: 0,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{
                position: "absolute", top: 3,
                left: notifPerm === "granted" ? 24 : 3,
                width: 22, height: 22, borderRadius: "50%",
                background: "#fff", transition: "left 0.22s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                display: "block",
              }} />
            </button>
          )}
        </div>
        {notifPerm === "denied" && (
          <div style={{ fontFamily: C.display, fontSize: 12, color: C.muted, marginTop: 8, padding: "8px 9px", borderRadius: 10, background: C.surface3, lineHeight: 1.5 }}>
            {t("Odpri nastavitve naprave → Aplikacije → Brskalnik → Obvestila in jih dovoli.")}
          </div>
        )}
      </Card>

      {/* Plan — current plan only, tap to reveal its info */}
      <Card style={cardStyle}>
        <SectionLabel>{t("MOJ PLAN")}</SectionLabel>
        {(() => {
          const plan = PLANS.find((p) => p.id === currentPlan) || PLANS[0];
          const pc = planColors[plan.id] || C.accent;
          return (
            <>
              <Pressable
                onClick={() => setPlanOpen((o) => !o)}
                scale={0.99}
                style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0 }}
              >
                <div>
                  <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 14, color: C.text }}>{t("Trenutni plan")}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ padding: "4px 9px", borderRadius: 999, background: `${pc}1a`, border: `1px solid ${pc}40` }}>
                      <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 11, letterSpacing: "0.04em", color: pc }}>{plan.name}</span>
                    </span>
                    <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 13, color: C.muted }}>{plan.earlyBird}{t("/mes")}</span>
                  </div>
                </div>
                <span style={{ color: C.muted, fontSize: 17, transition: "transform 0.2s", transform: planOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              </Pressable>

              {planOpen && (
                <div style={{ marginTop: 11, paddingTop: 16, borderTop: `1px solid ${C.border}`, animation: "athlosFade 0.2s ease" }}>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22, color: C.text, letterSpacing: "-0.02em" }}>{plan.earlyBird}</span>
                    <span style={{ fontFamily: C.display, fontSize: 12, color: C.muted }}>{t("/mes · early bird")}</span>
                    <div style={{ fontFamily: C.display, fontSize: 12, color: C.muted, marginTop: 4 }}>{t("Redna cena:")} {plan.regular}{t("/mes")}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {plan.features.map((f) => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="6" r="6" fill={`${pc}20`} />
                          <path d="M3.5 6l1.8 1.8 3.2-3.6" stroke={pc} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span style={{ fontFamily: C.display, fontSize: 14, color: C.text2 }}>{t(f)}</span>
                      </div>
                    ))}
                  </div>
                  {plan.note && <div style={{ fontFamily: C.display, fontSize: 12, color: C.muted, marginTop: 9 }}>{t(plan.note)}</div>}
                </div>
              )}
            </>
          );
        })()}
      </Card>

      {/* Danger zone — permanent account deletion */}
      <Card style={{ ...cardStyle, borderColor: `${C.red}40` }}>
        <SectionLabel>{t("NEVARNO OBMOČJE")}</SectionLabel>
        {!deleteOpen ? (
          <div style={row}>
            <div>
              <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 14, color: C.text }}>{t("Izbriši račun")}</span>
              <div style={{ fontFamily: C.display, fontSize: 11.5, color: C.muted, marginTop: 3 }}>{t("Trajno izbriše vse tvoje podatke.")}</div>
            </div>
            <Pressable onClick={() => setDeleteOpen(true)} scale={0.95} style={{ ...editBtn, color: C.red, borderColor: `${C.red}40` }}>{t("Izbriši")}</Pressable>
          </div>
        ) : (
          <div>
            <p style={{ fontFamily: C.display, fontSize: 12.5, color: C.text2, lineHeight: 1.55, margin: "0 0 10px" }}>
              {t("To dejanje je nepovratno. Izbrisani bodo tvoj profil, treningi, koledar, klepeti in vsi drugi podatki. Za potrditev vtipkaj")} <strong style={{ color: C.text }}>{confirmWord}</strong>.
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteMsg(""); }}
              placeholder={confirmWord}
              style={{ ...inp, borderColor: deleteMsg ? C.red : C.border, marginBottom: 8 }}
            />
            {deleteMsg && <div style={msgBox(false)}>{t(deleteMsg)}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button
                onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); setDeleteMsg(""); }}
                style={{ ...outlineBtn, flex: 1, padding: "9px", fontSize: 13 }}
              >
                {t("Prekliči")}
              </button>
              <button
                onClick={runDeleteAccount}
                disabled={deleteConfirm !== confirmWord || deleting}
                style={{
                  flex: 2, padding: "9px", fontSize: 13, borderRadius: 999, border: "none",
                  background: C.red, color: "#fff", fontFamily: C.display, fontWeight: 800,
                  cursor: deleteConfirm === confirmWord && !deleting ? "pointer" : "not-allowed",
                  opacity: deleteConfirm === confirmWord && !deleting ? 1 : 0.45,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {deleting ? t("Brišem…") : t("Trajno izbriši")}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
