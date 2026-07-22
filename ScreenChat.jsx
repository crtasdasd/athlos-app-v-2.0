import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../theme";
import { BackBtn, Pressable, Mono, SkeletonBlock } from "../components/UI";
import ConfirmDialog from "../components/ConfirmDialog";
import { IcTrash } from "../components/Icons";
import { useT } from "../lib/i18n";
import {
  listConversations, listMessages, sendMessage, listClubmates,
  getOrCreateDirectConversation, createGroupConversation,
  blockUser, listBlocks, updateConversationBackground,
  uploadChatFile, hasSupabase, loadChatReads, markChatRead, searchUsers,
} from "../lib/api";

// ─── Constants ───────────────────────────────────────────────
const STICKERS = [
  "💪","🔥","⚡","🏆","⚽","🏃","🥇","👊","🎯","💯",
  "😤","🦾","🏋️","🤸","🧘","🚴","🤼","🏊","🥊","🎽",
  "😎","🙌","👏","✨","⭐","🎉","😅","🤙","🫡","❤️",
];

const BG_OPTIONS = [
  { id: "default",  label: "Privzeto",   color: null },
  { id: "marble",   label: "Marmor",     color: "#F4EFE6" },
  { id: "dark",     label: "Temno",      color: "#1a1714" },
  { id: "white",    label: "Belo",       color: "#FFFFFF" },
  { id: "sand",     label: "Pesek",      color: "#E8DCC8" },
  { id: "olive",    label: "Olivno",     color: "#1e2d1a" },
  { id: "navy",     label: "Mornarsko",  color: "#0f1a2e" },
  { id: "bronze",   label: "Bronzasto",  color: "#2d1e0a" },
];

const DEMO_AUTO_REPLIES = [
  "Super trening!", "Se vidimo jutri!", "OK!", "Hvala za info!", "Res!",
  "Jasno!", "Bom tam ob 17:00!", "Odlično!", "Pogledal bom!",
];

// Prototype conversations seeded locally so the chat list always has content
const PROTO_PEOPLE = [
  { user_id: "proto-nina",   name: "Nina Mlakar",      initials: "NM", club: "NK Domžale", sport: "Nogomet" },
  { user_id: "proto-tim",    name: "Tim Žagar",        initials: "TŽ", club: "NK Domžale", sport: "Nogomet" },
  { user_id: "proto-eva",    name: "Eva Horvat",       initials: "EH", club: "NK Domžale", sport: "Atletika" },
  { user_id: "proto-matej",  name: "Coach Matej",      initials: "M",  club: "NK Domžale", sport: "Trener" },
  { user_id: "proto-luka",   name: "Luka Kovač",       initials: "LK", club: "NK Domžale", sport: "Nogomet" },
  { user_id: "proto-ana",    name: "Ana Kos",          initials: "AK", club: "NK Domžale", sport: "Nogomet" },
  { user_id: "proto-jure",   name: "Jure Novak",       initials: "JN", club: "NK Domžale", sport: "Nogomet" },
  { user_id: "proto-marko",  name: "Marko Potočnik",   initials: "MP", club: "NK Domžale", sport: "Nogomet" },
  { user_id: "proto-sara",   name: "Sara Vidmar",      initials: "SV", club: "AK Kladivar", sport: "Atletika" },
  { user_id: "proto-ziga",   name: "Žiga Kranjc",      initials: "ŽK", club: "NK Domžale", sport: "Nogomet" },
  { user_id: "proto-maja",   name: "Maja Petek",       initials: "MP", club: "Fizioterapija", sport: "Fizioterapevtka" },
  { user_id: "proto-rok",    name: "Rok Zupan",        initials: "RZ", club: "NK Bravo", sport: "Nogomet" },
];
const PROTO_SEEDS = [
  { otherId: "proto-matej", msgs: [
    { from: "proto-matej", text: "Jutri pridemo 15 min prej — video analiza tekme.", ago: 12 },
    { from: "me",          text: "Razumem, bom tam.", ago: 8 },
  ]},
  { otherId: "proto-nina",  msgs: [
    { from: "proto-nina", text: "Živjo! Jutri trening ob 17:00.", ago: 82 },
    { from: "me",         text: "Super, sem tam!", ago: 80 },
    { from: "proto-nina", text: "Odlično, se vidiva!", ago: 79 },
  ]},
  { otherId: "proto-tim",   msgs: [
    { from: "proto-tim",  text: "Kaj kažeš za skupinski trening v soboto?", ago: 200 },
    { from: "me",         text: "Zveni dobro, ob kateri uri?", ago: 198 },
    { from: "proto-tim",  text: "10:00, zbirališče pri dvorani", ago: 197 },
  ]},
  { otherId: "proto-eva",   msgs: [
    { from: "proto-eva",  text: "Pogledala sem tvoje čase — odlično napredovanje!", ago: 300 },
    { from: "me",         text: "Hvala! Trdo delam.", ago: 298 },
  ]},
  { otherId: "proto-luka",  msgs: [
    { from: "proto-luka", text: "A mi posodiš elastike za jutri?", ago: 460 },
    { from: "me",         text: "Ja, prinesem jih na trening.", ago: 455 },
  ]},
  { otherId: "proto-maja",  msgs: [
    { from: "proto-maja", text: "Kako je s kolenom po zadnji terapiji?", ago: 690 },
    { from: "me",         text: "Precej bolje, hvala. Jutri spet lahko tečem.", ago: 640 },
    { from: "proto-maja", text: "Odlično. V četrtek nadaljujeva z re-load fazo.", ago: 620 },
  ]},
  { otherId: "proto-ana",   msgs: [
    { from: "proto-ana",  text: "Vidiš tabelo? Tri točke zaostanka!", ago: 1500 },
    { from: "me",         text: "Ja! V soboto jih ujamemo.", ago: 1480 },
  ]},
  { otherId: "proto-jure",  msgs: [
    { from: "proto-jure", text: "Kdo pobere dres pri opremi?", ago: 2900 },
  ]},
  { otherId: "proto-sara",  msgs: [
    { from: "proto-sara", text: "Prideš pogledat miting v nedeljo?", ago: 4300 },
    { from: "me",         text: "Če ne bo tekme, pridem!", ago: 4200 },
  ]},
  { otherId: "proto-marko", msgs: [
    { from: "proto-marko", text: "Gleženj je spet v redu, naslednji teden sem nazaj.", ago: 5800 },
    { from: "me",          text: "Super novica! Pazi nase.", ago: 5700 },
  ]},
  { otherId: "proto-ziga",  msgs: [
    { from: "proto-ziga", text: "Deliš svoj program za moč? Zanima me tvoj počep.", ago: 7300 },
  ]},
  { otherId: "proto-rok",   msgs: [
    { from: "proto-rok",  text: "Dobra tekma prejšnji teden. Se vidimo v povratni!", ago: 8600 },
    { from: "me",         text: "Hvala, enako. Brez milosti :)", ago: 8500 },
  ]},
];

function seedProtoConvs(userId) {
  if (!userId) return;
  const LS = "athlos:v1";
  let state;
  try { state = JSON.parse(localStorage.getItem(LS)) || {}; } catch { state = {}; }
  const chat = state.chat || {};
  const convs = { ...(chat.convs || {}) };
  const msgs  = { ...(chat.msgs  || {}) };
  const now = Date.now();
  for (const seed of PROTO_SEEDS) {
    const key = [userId, seed.otherId].sort().join("~");
    if (!convs[key]) {
      convs[key] = { id: key, type: "direct", created_by: userId, background: "default", created_at: new Date(now - 400 * 60000).toISOString(), otherUser: PROTO_PEOPLE.find(p => p.user_id === seed.otherId) };
      msgs[key] = seed.msgs.map((m, i) => ({
        id: `proto-${key}-${i}`,
        conversation_id: key,
        sender_id: m.from === "me" ? userId : m.from,
        type: "text",
        content: m.text,
        created_at: new Date(now - m.ago * 60000).toISOString(),
      }));
    }
  }
  state.chat = { ...chat, convs, msgs };
  try { localStorage.setItem(LS, JSON.stringify(state)); } catch {}
}

// ─── Avatar ──────────────────────────────────────────────────
// Latin → Greek monogram, transliterated by sound. Lowercase glyphs on
// purpose: half the Greek capitals share the Latin shape (Α, Ε, Μ, Τ…),
// so only the lowercase alphabet reads unmistakably Greek.
const GREEK = {
  A: "α", B: "β", C: "κ", Č: "κ", Ć: "κ", D: "δ", E: "ε", F: "φ", G: "γ",
  H: "η", I: "ι", J: "ι", K: "κ", L: "λ", M: "μ", N: "ν", O: "ο", P: "π",
  Q: "κ", R: "ρ", S: "σ", Š: "σ", T: "τ", U: "υ", V: "υ", W: "ω", X: "χ",
  Y: "υ", Z: "ζ", Ž: "ζ",
};
export const toGreek = (s) => String(s).split("").map((ch) => GREEK[ch.toUpperCase()] || ch).join("");

// Apple-style avatar: photo when there is one, otherwise a quiet grey disc
// with the first letter of the name — no colour, no ornament.
function Avatar({ initials = "?", size = 44, isGroup, photo }) {
  const C = useTheme();
  const dark = C.name === "dark";
  if (photo && !isGroup) {
    return (
      <img src={photo} alt="" style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover",
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: dark ? "#2C2C2E" : "#D8D8DC",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: C.display, fontWeight: 600, fontSize: size * 0.42, lineHeight: 1,
      color: dark ? "#9A9AA0" : "#6E6E73",
    }}>
      {isGroup ? (
        <svg width={size * 0.44} height={size * 0.44} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      ) : (String(initials || "?").trim().charAt(0) || "?").toUpperCase()}
    </div>
  );
}

// ─── Greek-key divider (shared ornament) ─────────────────────
function Meander({ color, width = 96, opacity = 0.5 }) {
  const mask = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='14'%3E%3Cpath d='M0 12h6V3h6v9h6V3h6v9h2' fill='none' stroke='%23000' stroke-width='2'/%3E%3C/svg%3E\") repeat-x center / 32px 14px";
  return <div aria-hidden="true" style={{ height: 14, width, background: color, opacity, WebkitMask: mask, mask }} />;
}

// ─── Day divider — engraved rule with a mono date ────────────
function DayDivider({ label, C, muted, line }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "11px 5px 8px" }}>
      <span style={{ flex: 1, height: 1, background: line }} />
      <Mono style={{ color: muted, fontSize: 8.5, letterSpacing: "0.28em" }}>{label}</Mono>
      <span style={{ flex: 1, height: 1, background: line }} />
    </div>
  );
}

// ─── Message bubble ──────────────────────────────────────────
// The correspondence reads like a classical dialogue: the other side speaks
// in italic Cormorant on a marble tablet; my replies are engraved ink panels
// with a faint green "oracle" breath in the corner. Timestamps only close a
// run of messages, like a catalog mark.
function Bubble({ msg, isMine, C, onLongPress, showTime = true, darkBg = false }) {
  const isSticker = msg.type === "sticker";
  if (isSticker) {
    return (
      <div style={{ textAlign: isMine ? "right" : "left", margin: "4px 0" }}>
        <span
          onContextMenu={e => { e.preventDefault(); onLongPress?.(msg); }}
          style={{ fontSize: 62.5, lineHeight: 1.1, display: "inline-block", cursor: "context-menu" }}
        >{msg.content}</span>
      </div>
    );
  }

  const isImage = msg.type === "image";
  const isVideo = msg.type === "video";
  const isFile  = msg.type === "file";
  // Mine = dark "ink" panel with warm marble text (the premium statement of the
  // design system); theirs = raised marble surface with a vein border on light
  // backdrops, a translucent light panel on dark ones. Text color is tied to
  // the BUBBLE surface, never to the conversation backdrop — that's what kept
  // making white-on-marble unreadable on dark chat backgrounds.
  const bgBubble = isMine
    ? "#1C1814"
    : (darkBg ? "rgba(255,255,255,0.09)" : "#FFFFFF");
  const bubbleBorder = isMine
    ? `1px solid ${darkBg ? "rgba(244,239,230,0.22)" : "rgba(244,239,230,0.10)"}`
    : `1px solid ${darkBg ? "rgba(255,255,255,0.16)" : "#D6DAE0"}`;
  const textColor = isMine ? "#F4EFE6" : (darkBg ? "rgba(255,255,255,0.92)" : "#1C1814");

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: isMine ? "flex-end" : "flex-start",
      margin: "2px 0",
      animation: isMine ? "athlosMsgUser 0.2s ease" : "athlosMsgBot 0.2s ease",
    }}>
      <div
        onContextMenu={e => { e.preventDefault(); onLongPress?.(msg); }}
        style={{
          maxWidth: "74%",
          padding: (isImage || isVideo) ? 0 : "11px 16px",
          borderRadius: isMine ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
          background: bgBubble,
          border: bubbleBorder,
          color: textColor,
          overflow: "hidden",
          cursor: "context-menu",
          position: "relative",
          boxShadow: isMine ? "0 6px 16px rgba(28,24,20,0.18)" : (darkBg ? "none" : "0 3px 10px rgba(28,24,20,0.05)"),
        }}
      >
        {isImage && msg.attachment_url && (
          <img
            src={msg.attachment_url} alt=""
            style={{ width: "100%", maxWidth: 220, maxHeight: 260, objectFit: "cover", display: "block",
              borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px" }}
          />
        )}
        {isVideo && msg.attachment_url && (
          <video
            src={msg.attachment_url} controls playsInline
            style={{ width: "100%", maxWidth: 220, display: "block",
              borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px" }}
          />
        )}
        {isFile && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span style={{ fontFamily: C.display, fontSize: 13, fontWeight: 600 }}>
              {msg.content || "Datoteka"}
            </span>
          </div>
        )}
        {msg.type === "text" && (
          <span style={{
            fontFamily: C.display, fontSize: 14.5, fontWeight: 500, lineHeight: 1.45,
            position: "relative",
          }}>
            {msg.content}
          </span>
        )}
      </div>
      {showTime && (
        <Mono style={{ fontSize: 8.5, color: C.accent, margin: "4px 4px 2px", letterSpacing: "0.12em", opacity: 0.85 }}>
          {msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })
            : ""}
        </Mono>
      )}
    </div>
  );
}

// ─── Profile Sheet ────────────────────────────────────────────
function ProfileSheet({ user, C, t, onClose, onMessage, onBlock }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.52)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: C.bg, borderRadius: "28px 28px 0 0", padding: "16px 15px 26px",
        animation: "athlosRise 0.32s cubic-bezier(0.22,1,0.36,1)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border2, margin: "0 auto 22px" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 17 }}>
          <div style={{
            width: 76, height: 76, borderRadius: "50%",
            background: `${C.accent}18`, border: `2px solid ${C.accent}45`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: C.heading, fontSize: 23, fontWeight: 700, color: C.accent,
          }}>{toGreek(user?.initials || "?")}</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: C.heading, fontSize: 21.5, fontWeight: 700, color: C.text, letterSpacing: "0.04em" }}>
              {user?.name}
            </div>
            {user?.sport && (
              <Mono style={{ color: C.accent, fontSize: 10, display: "block", marginTop: 3 }}>
                {user.sport}
              </Mono>
            )}
            {user?.club && (
              <Mono style={{ color: C.muted, fontSize: 10, display: "block", marginTop: 2 }}>
                {user.club}
              </Mono>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={onMessage} style={{
            padding: "11px", borderRadius: 12, border: "none",
            background: C.accent, color: C.name === "dark" ? "#04130a" : "#fff",
            fontFamily: C.display, fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}>
            {t("Pošlji sporočilo")}
          </button>
          <button onClick={() => onBlock(user?.user_id)} style={{
            padding: "11px", borderRadius: 12, border: "1px solid rgba(229,83,75,0.35)",
            background: "transparent", color: "#e5534b",
            fontFamily: C.display, fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}>
            {t("Blokiraj")}
          </button>
          <button onClick={onClose} style={{
            padding: "9px", borderRadius: 12, border: `1px solid ${C.border}`,
            background: "transparent", color: C.muted,
            fontFamily: C.display, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            {t("Zapri")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Background Sheet ─────────────────────────────────────────
function BgSheet({ current, C, t, onSelect, onClose }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.52)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: C.bg, borderRadius: "28px 28px 0 0", padding: "16px 14px 30px",
        animation: "athlosRise 0.32s cubic-bezier(0.22,1,0.36,1)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border2, margin: "0 auto 18px" }} />
        <div style={{ fontFamily: C.heading, fontSize: 15.5, fontWeight: 700, color: C.text, marginBottom: 11 }}>
          {t("Ozadje pogovora")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {BG_OPTIONS.map(bg => (
            <button key={bg.id} onClick={() => { onSelect(bg.id); onClose(); }} style={{
              aspectRatio: "1", borderRadius: 12,
              background: bg.color || C.bg,
              border: current === bg.id
                ? `2.5px solid ${C.accent}`
                : `1.5px solid ${C.border}`,
              cursor: "pointer", position: "relative",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              padding: "0 0 5px",
            }}>
              <span style={{
                fontFamily: C.display, fontSize: 9, fontWeight: 700,
                color: bg.id === "dark" || bg.id === "olive" || bg.id === "navy" || bg.id === "bronze"
                  ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.55)",
                letterSpacing: "0.02em",
              }}>
                {bg.label}
              </span>
              {current === bg.id && (
                <div style={{
                  position: "absolute", top: 6, right: 6, width: 14, height: 14,
                  borderRadius: "50%", background: C.accent,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width={8} height={6} viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke={C.name === "dark" ? "#04130a" : "#fff"} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Survives a page refresh: the open conversation is remembered per tab, so a
// reload lands back inside the chat instead of kicking the user to the list.
const CHAT_RESTORE_KEY = "athlos:chat-open";
const loadOpenConv = () => {
  try { return JSON.parse(sessionStorage.getItem(CHAT_RESTORE_KEY) || "null"); } catch { return null; }
};

// ─── Main Screen ─────────────────────────────────────────────
export default function ScreenChat({ user, profile, onConvOpenChange }) {
  const C = useTheme();
  const t = useT();

  const userId = user?.id;
  // Only restore a conversation saved by THIS account (tab may switch users)
  const restoredRaw = useRef(loadOpenConv()).current;
  const restored = restoredRaw && restoredRaw.uid === userId ? restoredRaw : null;

  const [view, setView]             = useState(restored?.conv ? "detail" : "list");
  const [convs, setConvs]           = useState([]);
  const [activeConv, setActiveConv] = useState(restored?.conv || null);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState("");
  const [stickerOpen, setStickerOpen] = useState(false);
  const [profileSheet, setProfileSheet] = useState(null);
  const [bgSheet, setBgSheet]       = useState(false);
  const [blockTarget, setBlockTarget] = useState(null);
  const [msgMenu, setMsgMenu]       = useState(null);
  const [blocks, setBlocks]         = useState([]);
  const [clubmates, setClubmates]   = useState([]);
  const [groupSelected, setGroupSelected] = useState([]);
  const [groupName, setGroupName]   = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [convBg, setConvBg]         = useState(restored?.conv?.background || "default");
  const [search, setSearch]         = useState("");
  const [searchOpen, setSearchOpen] = useState(false); // search collapses behind the header icon (reference)
  const [filter, setFilter]         = useState("all"); // all | unread | groups
  const [reads, setReads]           = useState(() => loadChatReads());
  const [userQ, setUserQ]           = useState("");   // "new chat" name search
  const [userHits, setUserHits]     = useState([]);

  const msgsEndRef   = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef      = useRef(null);
  const detailSwipe  = useRef(null); // start point of a swipe inside an open conversation

  // ── Load conversations ──────────────────────────────────────
  const loadConvs = useCallback(async () => {
    if (!userId) return;
    // Demo conversations exist only in local demo mode — real accounts start
    // with an empty chat list and find people via the name search.
    if (!hasSupabase) seedProtoConvs(userId);
    try {
      const remote = await listConversations(userId);
      // Also pull from localStorage (prototype / locally sent messages)
      const LS = "athlos:v1";
      let localConvs = [];
      try {
        const state = JSON.parse(localStorage.getItem(LS)) || {};
        const chat = state.chat || {};
        localConvs = Object.values(chat.convs || {}).map(conv => {
          const convMsgs = (chat.msgs || {})[conv.id] || [];
          const lastMsg = convMsgs[convMsgs.length - 1] || null;
          const otherId = conv.id.split("~").find(p => p !== userId);
          const otherUser = conv.otherUser || PROTO_PEOPLE.find(p => p.user_id === otherId) || null;
          return { ...conv, lastMsg, otherUser };
        }).sort((a, b) => new Date(b.lastMsg?.created_at || b.created_at) - new Date(a.lastMsg?.created_at || a.created_at));
        // With a real backend, hide previously-seeded prototype conversations
        // (devices that ran an older build still carry them in localStorage).
        if (hasSupabase) localConvs = localConvs.filter(c => !String(c.id).includes("proto-"));
      } catch {}
      // Merge: remote takes precedence, local fills in the rest
      const remoteIds = new Set(remote.map(c => c.id));
      const merged = [...remote, ...localConvs.filter(c => !remoteIds.has(c.id))];
      setConvs(merged);
    } catch {}
    setLoadingConvs(false);
  }, [userId]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  // ── Load blocks & clubmates ─────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    listBlocks(userId).then(setBlocks).catch(() => {});
    listClubmates(userId).then(setClubmates).catch(() => {});
  }, [userId]);

  // ── Tell the app when a full-screen chat subview is open (conversation,
  // new chat, new group) so it can hide the bottom nav ──
  useEffect(() => {
    onConvOpenChange?.(view !== "list");
    return () => onConvOpenChange?.(false);
  }, [view, onConvOpenChange]);

  // ── Persist the open conversation so a refresh lands back in it ──
  useEffect(() => {
    try {
      if (view === "detail" && activeConv) sessionStorage.setItem(CHAT_RESTORE_KEY, JSON.stringify({ uid: userId, conv: activeConv }));
      else sessionStorage.removeItem(CHAT_RESTORE_KEY);
    } catch {}
  }, [view, activeConv]);

  // ── Name search (new chat) — debounced, min 2 characters ────
  useEffect(() => {
    if (view !== "new-chat" || userQ.trim().length < 2) { setUserHits([]); return; }
    const tmr = setTimeout(() => { searchUsers(userQ).then(setUserHits).catch(() => {}); }, 300);
    return () => clearTimeout(tmr);
  }, [userQ, view]);

  // ── Load messages + poll ────────────────────────────────────
  const loadMsgs = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const remote = await listMessages(convId);
      if (remote.length > 0) { setMessages(remote); return; }
      // Fall back to localStorage (prototype convs)
      const state = JSON.parse(localStorage.getItem("athlos:v1") || "{}");
      const local = (state.chat?.msgs?.[convId] || []);
      setMessages(local);
    } catch {}
  }, []);

  useEffect(() => {
    if (view !== "detail" || !activeConv) {
      clearInterval(pollRef.current);
      return;
    }
    loadMsgs(activeConv.id);
    pollRef.current = setInterval(() => loadMsgs(activeConv.id), 4000);
    return () => clearInterval(pollRef.current);
  }, [view, activeConv?.id, loadMsgs]);

  // ── Auto-scroll ─────────────────────────────────────────────
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Open conversation ───────────────────────────────────────
  const openConv = useCallback((conv) => {
    setActiveConv(conv);
    setConvBg(conv.background || "default");
    setMessages([]);
    setInput("");
    setStickerOpen(false);
    setView("detail");
    // Mark read → clears the unread dot for this conversation (persisted).
    setReads(markChatRead(conv.id));
  }, []);

  // ── Start / open DM with a user ────────────────────────────
  const startChat = useCallback(async (otherId, otherUser) => {
    if (!userId) return;
    try {
      const conv = await getOrCreateDirectConversation(userId, otherId);
      const mate = otherUser || clubmates.find(m => m.user_id === otherId);
      openConv({ ...conv, otherUser: mate || null });
    } catch {}
  }, [userId, clubmates, openConv]);

  // ── Send message ────────────────────────────────────────────
  const doSend = useCallback(async (type = "text", content = input.trim(), attachmentUrl = null) => {
    if (!activeConv || !userId || (!content && !attachmentUrl)) return;
    const optimistic = {
      id: `opt-${Date.now()}`,
      conversation_id: activeConv.id,
      sender_id: userId, type, content,
      attachment_url: attachmentUrl,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    if (type === "text") setInput("");
    setStickerOpen(false);

    try {
      const saved = await sendMessage(activeConv.id, userId, type, content, attachmentUrl);
      setMessages(prev => prev.map(m => m.id === optimistic.id ? saved : m));
      loadConvs();

      // Demo auto-reply (local/demo mode). Capture the target conversation in
      // locals so a mid-delay switch to another chat doesn't misfile the reply.
      if (!hasSupabase && activeConv.type === "direct" && type === "text" && Math.random() > 0.3) {
        const replyConvId = activeConv.id;
        const otherId = activeConv.otherUser?.user_id;
        if (otherId) {
          setTimeout(async () => {
            const reply = DEMO_AUTO_REPLIES[Math.floor(Math.random() * DEMO_AUTO_REPLIES.length)];
            await sendMessage(replyConvId, otherId, "text", reply);
            loadMsgs(replyConvId);
          }, 1400 + Math.random() * 1800);
        }
      }
    } catch {}
  }, [activeConv, userId, input, loadConvs, loadMsgs]);

  // ── File / photo / video attachment ────────────────────────
  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    const isImg   = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const msgType = isImg ? "image" : isVideo ? "video" : "file";
    try {
      const url = await uploadChatFile(file, userId);
      await doSend(msgType, file.name, url);
    } catch {}
    e.target.value = "";
  }, [userId, doSend]);

  // ── Block ────────────────────────────────────────────────────
  const doBlock = useCallback(async () => {
    if (!userId || !blockTarget) return;
    await blockUser(userId, blockTarget.user_id).catch(() => {});
    setBlocks(prev => [...new Set([...prev, blockTarget.user_id])]);
    setBlockTarget(null);
    setProfileSheet(null);
    setView("list");
    loadConvs();
  }, [userId, blockTarget, loadConvs]);

  // ── Delete message ───────────────────────────────────────────
  const doDeleteMsg = useCallback(async () => {
    if (!msgMenu || !userId) return;
    const { deleteMessage } = await import("../lib/api");
    await deleteMessage(msgMenu.id, userId).catch(() => {});
    setMessages(prev => prev.filter(m => m.id !== msgMenu.id));
    setMsgMenu(null);
  }, [msgMenu, userId]);

  // ── Change background ────────────────────────────────────────
  const doChangeBg = useCallback(async (bgId) => {
    setConvBg(bgId);
    if (activeConv) {
      setActiveConv(c => c ? { ...c, background: bgId } : c);
      // Reflect immediately in the list too, so reopening without a reload
      // still shows the just-picked background.
      setConvs(list => list.map(c => c.id === activeConv.id ? { ...c, background: bgId } : c));
      await updateConversationBackground(activeConv.id, bgId).catch(() => {});
    }
    setBgSheet(false);
  }, [activeConv]);

  // ── Create group ─────────────────────────────────────────────
  const doCreateGroup = useCallback(async () => {
    if (!userId || !groupName.trim() || groupSelected.length === 0) return;
    try {
      const conv = await createGroupConversation(userId, groupName.trim(), groupSelected);
      setGroupSelected([]);
      setGroupName("");
      openConv({ ...conv, name: groupName.trim() });
    } catch {}
  }, [userId, groupName, groupSelected, openConv]);

  // ── Helpers ──────────────────────────────────────────────────
  const bgColor = BG_OPTIONS.find(b => b.id === convBg)?.color || C.bg;
  // Is the conversation sitting on a dark backdrop (dark theme or a dark
  // custom background)? Bubbles pick their surface + text from this.
  const darkBackdrop = C.name === "dark" || ["dark", "olive", "navy", "bronze"].includes(convBg);
  const textOnBg = (() => {
    const dark = ["dark", "olive", "navy", "bronze"].includes(convBg);
    return dark ? "rgba(255,255,255,0.9)" : C.text;
  })();
  const mutedOnBg = (() => {
    const dark = ["dark", "olive", "navy", "bronze"].includes(convBg);
    return dark ? "rgba(255,255,255,0.45)" : C.muted;
  })();
  const borderOnBg = (() => {
    const dark = ["dark", "olive", "navy", "bronze"].includes(convBg);
    return dark ? "rgba(255,255,255,0.12)" : C.border;
  })();
  const surfaceOnBg = (() => {
    const dark = ["dark", "olive", "navy", "bronze"].includes(convBg);
    return dark ? "rgba(255,255,255,0.06)" : C.surface;
  })();

  const convName = (conv) =>
    conv.type === "group" ? (conv.name || "Skupina") : (conv.otherUser?.name || "Neznano");
  // Single engraved initial (like a Greek monogram) — first letter of the
  // name, not a two-letter initial pair.
  const convInitials = (conv) =>
    conv.type === "group" ? "" : (conv.otherUser?.name?.trim()?.[0]?.toUpperCase() || "?");
  // Unread = their latest message is newer than the last time we opened the
  // conversation; prototype-seeded demo messages never count.
  const isUnread = (conv) =>
    !!conv.lastMsg && conv.lastMsg.sender_id && conv.lastMsg.sender_id !== userId
    && !String(conv.lastMsg.id || "").startsWith("proto-")
    && (!reads[conv.id] || new Date(conv.lastMsg.created_at) > new Date(reads[conv.id]));
  const lastMsgLabel = (conv) => {
    const msg = conv.lastMsg;
    if (!msg) return t("Začni pogovor");
    if (msg.type === "sticker") return "Nalepka";
    if (msg.type === "image")   return "Slika";
    if (msg.type === "video")   return "Video";
    if (msg.type === "file")    return "Datoteka";
    return msg.content || "";
  };
  const fmtTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" });
    const days = Math.floor((now - d) / 86400000);
    if (days < 7) return d.toLocaleDateString("sl-SI", { weekday: "short" });
    return d.toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit" });
  };
  const dayLabel = (iso) => {
    const d = new Date(iso), now = new Date();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return t("DANES");
    if (d.toDateString() === yest.toDateString()) return t("VČERAJ");
    return d.toLocaleDateString("sl-SI", { day: "numeric", month: "short" }).toUpperCase();
  };

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <>
      {/* ════════════════════ LIST VIEW ════════════════════════ */}
      {view === "list" && (() => {
        const dark = C.name === "dark";
        const sep = dark ? "rgba(255,255,255,0.07)" : "rgba(28,24,20,0.08)";
        const q = search.trim().toLowerCase();
        let shown = convs.filter(c => convName(c).toLowerCase().includes(q));
        if (filter === "unread") shown = shown.filter(isUnread);
        if (filter === "groups") shown = shown.filter(c => c.type === "group");
        const roundBtn = {
          background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 50, flexShrink: 0,
          width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: C.text,
          boxShadow: dark ? "none" : "0 2px 8px rgba(28,24,20,0.06)",
        };
        return (
        <div style={{ paddingBottom: 20 }}>
          {/* Header — big title left, round search / new-chat actions right
              (the reference's Chats header) */}
          <div style={{ padding: "13px 11px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <h1 style={{ fontFamily: C.display, fontSize: 24, fontWeight: 800, margin: 0, color: C.text, lineHeight: 1, letterSpacing: "-0.01em" }}>
                {t("Pogovori")}
              </h1>
              <div style={{ display: "flex", gap: 6 }}>
                <Pressable onClick={() => { setSearchOpen(v => !v); if (searchOpen) setSearch(""); }} scale={0.9}
                  style={{ ...roundBtn, color: searchOpen ? C.accent : C.text, borderColor: searchOpen ? `${C.accent}55` : C.border }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                </Pressable>
                <Pressable onClick={() => setView("new-chat")} scale={0.9} style={{ ...roundBtn, color: C.accent }}>
                  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                </Pressable>
              </div>
            </div>

            {searchOpen && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 999, padding: "8px 11px", marginBottom: 9, boxShadow: dark ? "none" : "0 2px 8px rgba(28,24,20,0.04)", animation: "athlosFade 0.2s ease" }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={C.muted2} strokeWidth={2.2} strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t("Iskanje")}
                  autoFocus
                  className="athlos-conv-search"
                  style={{ flex: 1, border: "none", background: "none", outline: "none", fontFamily: C.display, fontWeight: 500, color: C.text, minWidth: 0 }}
                />
                <style>{`.athlos-conv-search::placeholder { color: ${C.muted2}; font-style: italic; }`}</style>
                {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", color: C.muted, cursor: "pointer", padding: 0, fontSize: 17, lineHeight: 1 }}>×</button>}
              </div>
            )}

            {/* people rail — me (+ new chat), then whoever you've actually
                messaged, most-recently-active conversation first (`convs` is
                already sorted that way by listConversations/loadConvs). Starting
                or replying to a chat surfaces that person here automatically —
                this is conversation history, not the full clubmate roster. */}
            <div className="athlos-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", padding: "2px 2px 10px" }}>
              <button onClick={() => setView("new-chat")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, width: 60 }}>
                <span style={{ position: "relative" }}>
                  <Avatar initials={(profile?.name || "?").trim()[0]?.toUpperCase()} photo={profile?.photo} size={56} />
                  <span style={{ position: "absolute", bottom: -1, right: -1, width: 19, height: 19, borderRadius: "50%", background: C.accent, border: `2px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={dark ? "#04130A" : "#FFFFFF"} strokeWidth={3} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  </span>
                </span>
                <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 10, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 60 }}>{t("Jaz")}</span>
              </button>
              {convs
                .filter(c => c.type === "direct" && c.otherUser && !blocks.includes(c.otherUser.user_id))
                .slice(0, 12)
                .map(c => (
                <button key={c.id} onClick={() => openConv(c)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, width: 60 }}>
                  <span style={{ padding: 2, borderRadius: "50%", border: `1.5px solid ${C.accent}55` }}>
                    <Avatar initials={convInitials(c)} photo={c.otherUser?.photo} size={52} />
                  </span>
                  <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 10, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 60 }}>
                    {(c.otherUser?.name || "?").trim().split(/\s+/)[0]}
                  </span>
                </button>
              ))}
            </div>

            {/* filter chips — Vsi / Neprebrani / Skupine */}
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {[["all", t("Vsi")], ["unread", t("Neprebrani")], ["groups", t("Skupine")]].map(([key, lbl]) => (
                <button key={key} onClick={() => setFilter(key)} style={{
                  padding: "6px 11px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${filter === key ? `${C.accent}55` : C.border}`,
                  background: filter === key ? `${C.accent}16` : C.surface,
                  color: filter === key ? C.accent : C.muted,
                  fontFamily: C.display, fontWeight: 600, fontSize: 12,
                  WebkitTapHighlightColor: "transparent",
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Loading skeletons */}
          {loadingConvs && (
            <div style={{ padding: "4px 11px" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0" }}>
                  <SkeletonBlock width={52} height={52} radius={999} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <SkeletonBlock width={`${55 - i * 4}%`} height={14} radius={5} />
                    <SkeletonBlock width={`${78 - i * 5}%`} height={12} radius={5} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loadingConvs && shown.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 16px", color: C.muted, fontFamily: C.display, fontStyle: "italic", fontSize: 15 }}>
              {q ? t("Ni zadetkov") : t("Ni pogovorov")}
            </div>
          )}

          {/* Rows — reference structure: avatar · name + preview · time + badge */}
          {!loadingConvs && shown.map((conv, i) => {
            const isBlocked = conv.type === "direct" && blocks.includes(conv.otherUser?.user_id);
            const unread = isUnread(conv);
            const mineLast = conv.lastMsg?.sender_id === userId;
            const last = i === shown.length - 1;
            return (
              <button
                key={conv.id}
                onClick={() => openConv(conv)}
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center",
                  padding: "0 11px", background: "none", border: "none",
                  cursor: "pointer", WebkitTapHighlightColor: "transparent",
                  opacity: isBlocked ? 0.45 : 1,
                }}
              >
                <Avatar initials={convInitials(conv)} photo={conv.type === "direct" ? conv.otherUser?.photo : null} isGroup={conv.type === "group"} size={52} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, marginLeft: 13, padding: "10px 0", borderBottom: last ? "none" : `1px solid ${sep}` }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: C.display, fontWeight: unread ? 800 : 700, fontSize: 14.5, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {convName(conv)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, minWidth: 0 }}>
                      {mineLast && !isBlocked && (
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M2 12l4 4L14 8" /><path d="M9 14.5L11.5 17 21 7" />
                        </svg>
                      )}
                      <span style={{
                        fontFamily: C.display, fontSize: 13, fontWeight: 500,
                        color: unread ? C.text2 : C.muted, lineHeight: 1.35,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {isBlocked ? t("Blokirano") : lastMsgLabel(conv)}
                      </span>
                    </span>
                  </span>
                  {/* right column — time on top, unread badge under it */}
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontFamily: C.mono, fontSize: 9, color: unread ? C.accent : C.muted2, letterSpacing: "0.06em" }}>
                      {fmtTime(conv.lastMsg?.created_at || conv.created_at)}
                    </span>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: unread ? C.red : "transparent", boxShadow: unread ? `0 0 8px ${C.red}66` : "none" }} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        );
      })()}

      {/* ════════════════ DETAIL (full-screen) ═════════════════ */}
      {view === "detail" && activeConv && (
        <div
          // data-noswipe keeps the app-level tab swipe out of an open
          // conversation; a right swipe here closes the conversation first
          // (iOS-style back), instead of jumping straight to another tab.
          data-noswipe
          onTouchStart={(e) => {
            // don't hijack drags that belong to a control (text selection in the input)
            detailSwipe.current = e.target.closest && e.target.closest("input, textarea")
              ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            const s = detailSwipe.current;
            detailSwipe.current = null;
            if (!s) return;
            const dx = e.changedTouches[0].clientX - s.x;
            const dy = e.changedTouches[0].clientY - s.y;
            if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) setView("list");
          }}
          style={{
          position: "fixed", inset: 0, zIndex: 15,
          background: bgColor,
          display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 10px 8px",
            paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
            background: bgColor,
            borderBottom: `1px solid ${borderOnBg}`,
          }}>
            {/* Back — follows the conversation's own backdrop (borderOnBg/textOnBg),
                not the app theme, so it stays visible on a dark custom background */}
            <Pressable onClick={() => { setReads(markChatRead(activeConv.id)); setView("list"); loadConvs(); }} scale={0.88} style={{
              background: "transparent", border: `1px solid ${borderOnBg}`, borderRadius: 50,
              width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
              color: textOnBg, marginRight: 4, lineHeight: 1, flexShrink: 0,
            }}>
              <svg width="9" height="16" viewBox="0 0 10 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 1L1 9l8 8"/>
              </svg>
            </Pressable>

            {/* Avatar + name tap → profile sheet */}
            <button
              onClick={() => {
                if (activeConv.type === "direct" && activeConv.otherUser)
                  setProfileSheet(activeConv.otherUser);
              }}
              style={{
                background: "none", border: "none", cursor: activeConv.type === "direct" ? "pointer" : "default",
                display: "flex", alignItems: "center", gap: 8, flex: 1, textAlign: "left", padding: 0,
              }}
            >
              <Avatar initials={convInitials(activeConv)} photo={activeConv.type === "direct" ? activeConv.otherUser?.photo : null} isGroup={activeConv.type === "group"} size={40} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: C.display, fontSize: 14.5, fontWeight: 700, color: textOnBg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {convName(activeConv)}
                </div>
                {/* green status line under the name, like the reference */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent2, boxShadow: `0 0 6px ${C.accent2}88`, flexShrink: 0 }} />
                  <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 10.5, color: C.accent2 }}>
                    {activeConv.type === "group" ? t("Skupina") : (activeConv.otherUser?.club || t("Športnik"))}
                  </span>
                </div>
              </div>
            </button>

            {/* Background picker button */}
            <Pressable
              onClick={() => setBgSheet(true)}
              style={{
                background: "transparent", border: `1px solid ${borderOnBg}`, borderRadius: 50,
                width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                color: mutedOnBg,
              }}
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10z"/>
                <path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/>
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
              </svg>
            </Pressable>
          </div>

          {/* Messages — on faintly veined, halftoned marble */}
          <div
            className="athlos-scroll"
            style={{
              flex: 1, overflowY: "auto", padding: "9px 10px", display: "flex", flexDirection: "column", gap: 2,
              ...(convBg === "default" && C.name !== "dark" ? {
                backgroundImage: "radial-gradient(rgba(28,24,20,0.045) 0.8px, transparent 1.2px)",
                backgroundSize: "5px 5px, 100% 100%, 100% 100%",
              } : {}),
            }}
          >
            {messages.length === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, opacity: 0.7 }}>
                <Meander color={C.gold} width={120} />
                <div style={{ fontFamily: C.display, fontStyle: "italic", fontSize: 15, color: mutedOnBg }}>
                  {t("Začni pogovor")}
                </div>
              </div>
            )}

            {/* engraved inscription that opens every correspondence */}
            {messages.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 0 13px" }}>
                <Meander color={C.gold} width={96} />
                <Mono style={{ color: C.gold, fontSize: 8.5, letterSpacing: "0.34em", paddingLeft: "0.34em" }}>
                  {convName(activeConv)}
                </Mono>
              </div>
            )}

            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const newDay = msg.created_at && (!prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString());
              const closesRun = !next || next.sender_id !== msg.sender_id ||
                (new Date(next.created_at) - new Date(msg.created_at)) > 5 * 60000;
              return (
                <React.Fragment key={msg.id}>
                  {newDay && <DayDivider label={dayLabel(msg.created_at)} C={C} muted={mutedOnBg} line={borderOnBg} />}
                  <Bubble
                    msg={msg}
                    isMine={msg.sender_id === userId}
                    C={{ ...C, text: textOnBg, muted2: mutedOnBg }}
                    onLongPress={msg.sender_id === userId ? setMsgMenu : undefined}
                    showTime={closesRun}
                    darkBg={darkBackdrop}
                  />
                </React.Fragment>
              );
            })}
            <div ref={msgsEndRef} />
          </div>

          {/* Sticker picker */}
          {stickerOpen && (
            <div style={{ background: surfaceOnBg, borderTop: `1px solid ${borderOnBg}`, padding: "8px 5px 5px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 2 }}>
                {STICKERS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInput((prev) => prev + s)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 31.5, padding: "5px 2px", lineHeight: 1,
                      borderRadius: 8, WebkitTapHighlightColor: "transparent",
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Composer — "+" (stickers) on the left, text pill in the middle,
              round accent send button on the right */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 9px",
            paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
            background: surfaceOnBg, borderTop: `1px solid ${borderOnBg}`,
          }}>
            {/* "+" stickers — on the left, centered with the text */}
            <Pressable
              onClick={() => setStickerOpen(o => !o)}
              style={{
                background: darkBackdrop ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.55)",
                borderRadius: 50, width: 42, height: 42,
                border: `1px solid ${darkBackdrop ? "rgba(255,255,255,0.14)" : "#D6DAE0"}`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                color: stickerOpen ? C.accent : textOnBg,
                transition: "color 0.2s",
              }}
            >
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ transition: "transform 0.2s", transform: stickerOpen ? "rotate(45deg)" : "none" }}><path d="M12 5v14M5 12h14"/></svg>
            </Pressable>

            <div style={{
              flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end",
              background: darkBackdrop ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.55)",
              border: `1px solid ${darkBackdrop ? "rgba(255,255,255,0.14)" : "#D6DAE0"}`,
              borderRadius: 18, padding: "4px 11px",
            }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }}
                placeholder={t("Sporočilo…")}
                rows={1}
                className="athlos-chat-input"
                style={{
                  flex: 1, minWidth: 0, padding: "6px 0",
                  border: "none", background: "none",
                  color: textOnBg, fontFamily: C.display, fontSize: 14.5, fontWeight: 500,
                  resize: "none", outline: "none", lineHeight: 1.4,
                  minHeight: 20, maxHeight: 100, overflowY: "auto",
                }}
              />
              <style>{`.athlos-chat-input::placeholder { color: ${mutedOnBg}; }`}</style>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,*/*"
                style={{ display: "none" }}
                onChange={handleFile}
              />
            </div>

            {/* Send button — on the right, green once there's text */}
            <Pressable
              onClick={() => input.trim() && doSend()}
              style={{
                background: input.trim() ? C.accent : (darkBackdrop ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.55)"),
                borderRadius: 50, width: 42, height: 42,
                border: input.trim() ? "none" : `1px solid ${darkBackdrop ? "rgba(255,255,255,0.14)" : "#D6DAE0"}`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                color: input.trim() ? (C.name === "dark" ? "#04130A" : "#FFFFFF") : mutedOnBg,
                boxShadow: input.trim() ? `0 6px 16px ${C.accent}44` : "none",
                transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
              }}
            >
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </Pressable>
          </div>
        </div>
      )}

      {/* ═════════════ NEW CHAT (full-screen) ══════════════════ */}
      {view === "new-chat" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 15, background: C.bg, display: "flex", flexDirection: "column" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 11px 8px",
            paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
            borderBottom: `1px solid ${C.border}`,
          }}>
            <BackBtn onClick={() => setView("list")} />
            <div style={{ fontFamily: C.heading, fontSize: 16, fontWeight: 700, color: C.text }}>
              Nov pogovor
            </div>
          </div>

          <div className="athlos-scroll" style={{ flex: 1, overflowY: "auto", padding: "10px 13px" }}>
            {/* Create group */}
            <button
              onClick={() => { setGroupSelected([]); setGroupName(""); setView("new-group"); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 11px", marginBottom: 15,
                background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 12,
                cursor: "pointer", WebkitTapHighlightColor: "transparent",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: `${C.accent}1a`, border: `1.5px solid ${C.accent}40`,
                display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, flexShrink: 0,
              }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15, color: C.text }}>
                Ustvari skupino
              </span>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2} strokeLinecap="round" style={{ marginLeft: "auto" }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>

            {/* Search anyone by display name (RPC — works across clubs) */}
            <Mono style={{ color: C.muted, fontSize: 10, display: "block", marginBottom: 8, letterSpacing: "0.12em" }}>
              {t("IŠČI PO IMENU")}
            </Mono>
            <input
              value={userQ}
              onChange={(e) => setUserQ(e.target.value)}
              placeholder={t("Vpiši ime …")}
              style={{
                width: "100%", padding: "9px 11px", borderRadius: 12, boxSizing: "border-box",
                border: `1px solid ${C.border2}`, background: C.surface2, color: C.text,
                fontFamily: C.display, fontWeight: 600, fontSize: 14.5, outline: "none",
                marginBottom: 5,
              }}
            />
            {userHits.filter(u => u.user_id !== userId && !blocks.includes(u.user_id)).map(u => (
              <button
                key={u.user_id}
                onClick={() => { setUserQ(""); setUserHits([]); startChat(u.user_id, u); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 0", background: "none", border: "none",
                  borderBottom: `1px solid ${C.border}`,
                  cursor: "pointer", WebkitTapHighlightColor: "transparent",
                }}
              >
                <Avatar initials={u.initials} photo={u.photo} size={42} />
                <div style={{ flex: 1, textAlign: "left", fontFamily: C.display, fontWeight: 700, fontSize: 15, color: C.text }}>
                  {u.name}
                </div>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2} strokeLinecap="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            ))}
            {userQ.trim().length >= 2 && userHits.length === 0 && (
              <div style={{ textAlign: "center", padding: "10px 0 4px", fontFamily: C.display, fontStyle: "italic", color: C.muted, fontSize: 13 }}>
                {t("Ni zadetkov")}
              </div>
            )}

            <Mono style={{ color: C.muted, fontSize: 10, display: "block", margin: "15px 0 8px", letterSpacing: "0.12em" }}>
              SOTEKMOVALCI
            </Mono>

            {clubmates.filter(m => !blocks.includes(m.user_id)).map(mate => (
              <button
                key={mate.user_id}
                onClick={() => startChat(mate.user_id, mate)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 0", background: "none", border: "none",
                  borderBottom: `1px solid ${C.border}`,
                  cursor: "pointer", WebkitTapHighlightColor: "transparent",
                }}
              >
                <Avatar initials={mate.initials} photo={mate.photo} size={42} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15, color: C.text }}>
                    {mate.name}
                  </div>
                  {mate.club && (
                    <Mono style={{ fontSize: 9, color: C.muted, display: "block", marginTop: 1 }}>
                      {mate.club}
                    </Mono>
                  )}
                </div>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2} strokeLinecap="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            ))}

            {clubmates.length === 0 && (
              <div style={{ textAlign: "center", padding: "16px 14px", fontFamily: C.display, color: C.muted, fontSize: 14 }}>
                {t("Nisi še v klubu — poišči prijatelja po imenu zgoraj.")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ NEW GROUP (full-screen) ════════════════ */}
      {view === "new-group" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 15, background: C.bg, display: "flex", flexDirection: "column" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 11px 8px",
            paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
            borderBottom: `1px solid ${C.border}`,
          }}>
            <BackBtn onClick={() => setView("new-chat")} />
            <div style={{ fontFamily: C.heading, fontSize: 16, fontWeight: 700, color: C.text, flex: 1 }}>
              Nova skupina
            </div>
            <button
              onClick={doCreateGroup}
              disabled={!groupName.trim() || groupSelected.length === 0}
              style={{
                background: C.accent, color: C.name === "dark" ? "#04130a" : "#fff",
                border: "none", borderRadius: 16, padding: "6px 13px",
                fontFamily: C.display, fontWeight: 700, fontSize: 13, cursor: "pointer",
                opacity: (!groupName.trim() || groupSelected.length === 0) ? 0.38 : 1,
              }}
            >
              Ustvari
            </button>
          </div>

          <div className="athlos-scroll" style={{ flex: 1, overflowY: "auto", padding: "11px 13px" }}>
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Ime skupine…"
              style={{
                width: "100%", padding: "9px 11px", borderRadius: 12,
                border: `1.5px solid ${C.border}`,
                background: C.surface2, color: C.text, fontFamily: C.display, fontSize: 15,
                outline: "none", marginBottom: 15, boxSizing: "border-box",
              }}
            />

            <Mono style={{ color: C.muted, fontSize: 10, display: "block", marginBottom: 8, letterSpacing: "0.12em" }}>
              IZBERI ČLANE ({groupSelected.length} izbranih)
            </Mono>

            {clubmates.map(mate => {
              const sel = groupSelected.includes(mate.user_id);
              return (
                <button
                  key={mate.user_id}
                  onClick={() => setGroupSelected(s => sel ? s.filter(id => id !== mate.user_id) : [...s, mate.user_id])}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 0", background: "none", border: "none",
                    borderBottom: `1px solid ${C.border}`,
                    cursor: "pointer", WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <Avatar initials={mate.initials} photo={mate.photo} size={42} />
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15, color: C.text }}>
                      {mate.name}
                    </div>
                    {mate.club && (
                      <Mono style={{ fontSize: 9, color: C.muted, display: "block", marginTop: 1 }}>
                        {mate.club}
                      </Mono>
                    )}
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: sel ? C.accent : "transparent",
                    border: `2px solid ${sel ? C.accent : C.border2}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s, border-color 0.15s",
                  }}>
                    {sel && (
                      <svg width={10} height={8} viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke={C.name === "dark" ? "#04130a" : "#fff"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────── Overlays ─────────────────────────── */}

      {profileSheet && (
        <ProfileSheet
          user={profileSheet}
          C={C} t={t}
          onClose={() => setProfileSheet(null)}
          onMessage={() => { setProfileSheet(null); startChat(profileSheet.user_id, profileSheet); }}
          onBlock={(uid) => { setBlockTarget({ user_id: uid, name: profileSheet.name }); setProfileSheet(null); }}
        />
      )}

      {bgSheet && (
        <BgSheet
          current={convBg}
          C={C} t={t}
          onSelect={doChangeBg}
          onClose={() => setBgSheet(false)}
        />
      )}

      <ConfirmDialog
        open={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        tone="danger"
        icon={
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M6.3 6.3l11.4 11.4" />
          </svg>
        }
        title={`${t("Blokiraj")} ${blockTarget?.name || ""}`}
        description={t("Uporabnik vam ne bo mogel pošiljati sporočil.")}
        confirmLabel={t("Blokiraj")}
        onConfirm={doBlock}
      />

      <ConfirmDialog
        open={!!msgMenu}
        onClose={() => setMsgMenu(null)}
        tone="danger"
        icon={<IcTrash size={30} />}
        title={t("Izbriši sporočilo?")}
        description={t("Sporočila po izbrisu ni mogoče obnoviti.")}
        confirmLabel={t("Izbriši")}
        onConfirm={doDeleteMsg}
      />
    </>
  );
}
