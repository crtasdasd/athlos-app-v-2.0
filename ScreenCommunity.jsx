import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { useTheme } from "../theme";
import ScreenChat from "./ScreenChat";
import CommunityDetail, { CreateCommunitySheet } from "./widgets/CommunityDetail";
import { listCommunities, joinCommunity, leaveCommunity, getCommunity, hasSupabase } from "../lib/api";
import { getMyClub, leaveClub, findClubs, joinClub, getMyJoinRequest } from "../lib/api";

// ══════════════════════════════════════════════════════════════
// ATHLOS — Community
// Two sections: Private (real groups + chats — the existing ScreenChat
// engine, Supabase-backed) and Public (discover communities). Premium,
// minimal, WHOOP-inspired but fully ATHLOS.
//
// Public communities are real rows (public.communities / community_members
// in Supabase, see supabase/schema.sql) — currently seeded with exactly two:
// Slovenija and Muharji, every already-registered athlete added as a member.
// ══════════════════════════════════════════════════════════════

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`);
const haptic = () => { try { navigator.vibrate?.(8); } catch {} };

// ── SegmentedControl — sliding indicator, smooth ─────────────
function SegmentedControl({ tabs, value, onChange, C }) {
  const i = Math.max(0, tabs.findIndex((t) => t.key === value));
  return (
    <div style={{
      position: "relative", display: "flex", padding: 4, borderRadius: 999,
      background: C.surface2,
    }}>
      <div aria-hidden="true" style={{
        position: "absolute", top: 4, bottom: 4, left: 4, width: `calc((100% - 8px) / ${tabs.length})`,
        borderRadius: 999, background: C.accent,
        transform: `translateX(${i * 100}%)`,
        transition: "transform 0.32s cubic-bezier(0.22,1,0.36,1)",
        boxShadow: `0 4px 14px ${C.accent}33`,
      }} />
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button key={t.key} onClick={() => { haptic(); onChange(t.key); }} style={{
            position: "relative", zIndex: 1, flex: 1, border: "none", background: "none",
            padding: "8px 0", borderRadius: 999, cursor: "pointer", WebkitTapHighlightColor: "transparent",
            fontFamily: C.display, fontWeight: 700, fontSize: 13,
            color: on ? C.btnText : C.muted, transition: "color 0.25s",
          }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── SearchBar — expands (brightens + lifts) on focus ─────────
function SearchBar({ value, onChange, placeholder, C }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "0 11px", height: 48,
      borderRadius: 13, background: C.surface2,
      boxShadow: focus ? `0 0 0 3px ${C.accent}1f` : "none",
      transform: focus ? "scale(1.01)" : "scale(1)",
      transition: "box-shadow 0.2s, transform 0.2s cubic-bezier(0.22,1,0.36,1)",
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={focus ? C.accent : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "stroke 0.2s" }}>
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontFamily: C.display, fontWeight: 500, fontSize: 13.5 }}
      />
    </div>
  );
}

// Picture for a community: a real photo (Muharji, once it has one) beats an
// emoji flag (Slovenija's 🇸🇮) beats a plain first-letter disc (same graceful
// fallback used for people's avatars elsewhere in the app).
function CommunityPicture({ community, size, C }) {
  const base = { width: size, height: size, borderRadius: "50%", flexShrink: 0, background: C.surface3, border: `1px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" };
  if (community.image_url) return <span style={base}><img src={community.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></span>;
  if (community.flag) return <span style={{ ...base, fontSize: size * 0.42 }}>{community.flag}</span>;
  return <span style={{ ...base, fontFamily: C.display, fontWeight: 700, fontSize: size * 0.42, color: C.muted }}>{(community.name || "?").trim().charAt(0).toUpperCase()}</span>;
}

// ── CommunityCard — variant "featured" (hero) or "trending" ──
function CommunityCard({ community, variant, C, onToggleJoin, onOpen }) {
  const joined = !!community.myRole;
  const isAdmin = community.myRole === "admin";
  // A private community can't be self-joined (needs its invite code) — send
  // that tap to the detail screen, which has the actual code-entry field,
  // instead of firing a join request that RLS would just silently refuse.
  const isPrivate = community.privacy === "private";
  const JoinBtn = (
    <button
      className="ath-press"
      onClick={(e) => { e.stopPropagation(); haptic(); (!joined && isPrivate) ? onOpen?.(community) : onToggleJoin?.(community); }}
      style={{
        border: "none", borderRadius: 999, padding: "7px 13px", cursor: "pointer", flexShrink: 0,
        fontFamily: C.display, fontWeight: 800, fontSize: 11.5, WebkitTapHighlightColor: "transparent",
        background: joined ? "transparent" : C.accent,
        color: joined ? C.muted : C.btnText,
        boxShadow: joined ? "none" : `0 6px 18px ${C.accent}33`,
        outline: joined ? `1px solid ${C.border2}` : "none",
        transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
      }}>
      {joined ? "Joined" : isPrivate ? "Enter code" : "Join"}
    </button>
  );
  // Small precious badge — only the actual community admin(s) see this on
  // their own card, not a generic decoration.
  const AdminBadge = isAdmin && (
    <span style={{ fontFamily: C.mono, fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", color: C.accent, border: `1px solid ${C.accent}45`, background: `${C.accent}14`, borderRadius: 999, padding: "2px 7px", flexShrink: 0 }}>ADMIN</span>
  );

  if (variant === "featured") {
    return (
      <div className="ath-press" onClick={() => onOpen?.(community)} style={{
        position: "relative", overflow: "hidden", borderRadius: 20, padding: "20px 20px 22px", cursor: "pointer",
        background: `radial-gradient(120% 90% at 85% -10%, ${C.accent}14, transparent 55%), ${C.surface}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CommunityPicture community={community} size={56} C={C} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <span style={{ fontFamily: C.mono, fontSize: 8.5, letterSpacing: "0.18em", color: C.accent }}>FEATURED</span>
              {AdminBadge}
            </div>
            <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 19, color: C.text, letterSpacing: "-0.01em" }}>{community.name}</div>
          </div>
        </div>
        {community.description && <p style={{ fontFamily: C.display, fontSize: 12.5, lineHeight: 1.6, color: C.text2, margin: "13px 0 0", maxWidth: "92%" }}>{community.description}</p>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <span style={{ fontFamily: C.display, fontSize: 12, color: C.muted }}><span style={{ fontWeight: 800, color: C.text, fontSize: 14.5 }}>{fmt(community.members)}</span> members</span>
          {JoinBtn}
        </div>
      </div>
    );
  }

  return (
    <div className="ath-press" onClick={() => onOpen?.(community)} style={{
      display: "flex", alignItems: "center", gap: 11, padding: "12px 0", cursor: "pointer",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <CommunityPicture community={community} size={42} C={C} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14, color: C.text }}>{community.name}</div>
          {AdminBadge}
        </div>
        <div style={{ fontFamily: C.display, fontSize: 11, color: C.muted, marginTop: 2 }}>{fmt(community.members)} members</div>
      </div>
      {JoinBtn}
    </div>
  );
}

const SectionHeader = ({ children, C }) => (
  <h3 style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13.5, color: C.text, margin: "0 0 9px", letterSpacing: "-0.01em" }}>{children}</h3>
);

// ── Private — the real chat engine (groups + direct messages, Supabase-
// backed). ScreenChat already renders its own "Your groups / all chats"
// filter chips, search, new-chat + new-group flows and full conversation
// detail view (fixed full-screen overlay), so it's mounted directly rather
// than re-built as a mock — same premium UI, real data underneath.
function PrivateTab({ user, profile, onConvOpenChange, C }) {
  return (
    <div style={{ animation: "athlosCommFade 0.3s ease" }}>
      <div style={{ padding: "0 18px" }}>
        <MyClubCard user={user} profile={profile} C={C} />
      </div>
      <div style={{ margin: "0 -18px" }}>
        <ScreenChat user={user} profile={profile} onConvOpenChange={onConvOpenChange} />
      </div>
    </div>
  );
}

// ── My Club — find/join a club (public joins instantly, private sends a
// request the coach approves/declines — see Settings → Club privacy on the
// coach side), or shows the athlete's current club with a Leave option.
// No club-search UI existed anywhere in the app before this; findClubs()/
// joinClub() in lib/api.js were already built but never wired up.
function MyClubCard({ user, profile, C }) {
  const [loading, setLoading] = useState(true);
  const [myClub, setMyClub] = useState(null);   // { membershipId, club } | null
  const [request, setRequest] = useState(null); // pending/most-recent join request | null
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(() => {
    if (!user?.id) { setLoading(false); return; }
    Promise.all([getMyClub(user.id), getMyJoinRequest(user.id)])
      .then(([c, r]) => { setMyClub(c); setRequest(c ? null : r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    let live = true;
    findClubs(term).then((r) => { if (live) setResults(r); }).catch(() => {});
    return () => { live = false; };
  }, [q]);

  const doJoin = async (club) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await joinClub(user.id, profile, club);
      if (res?.pending) setRequest({ club_id: club.id, status: "pending" });
      else load();
      setQ(""); setResults([]);
    } catch (e) {
      window.alert?.(e?.message || "Something went wrong — try again.");
    } finally { setBusy(false); }
  };

  const doLeave = async () => {
    if (!myClub || leaving) return;
    setLeaving(true);
    try { await leaveClub(user.id, myClub.membershipId, myClub.club.conversation_id); load(); }
    finally { setLeaving(false); }
  };

  if (loading) return null;

  // Already in a club — compact info card + Leave.
  if (myClub) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 15px", marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 14.5, color: C.text }}>{myClub.club.name}</div>
            {myClub.club.location && <div style={{ fontFamily: C.display, fontSize: 11, color: C.muted, marginTop: 2 }}>{myClub.club.location}</div>}
          </div>
          <button onClick={doLeave} disabled={leaving} className="ath-press" style={{
            flexShrink: 0, padding: "7px 12px", borderRadius: 999, border: `1px solid ${C.border2}`,
            background: "transparent", color: C.muted, fontFamily: C.display, fontWeight: 700, fontSize: 11,
            cursor: "pointer", opacity: leaving ? 0.6 : 1, WebkitTapHighlightColor: "transparent",
          }}>
            {leaving ? "…" : "Leave"}
          </button>
        </div>
      </div>
    );
  }

  // A private-club request already sent — waiting on the coach.
  if (request?.status === "pending") {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 15px", marginBottom: 13 }}>
        <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13, color: C.text }}>Request sent</div>
        <div style={{ fontFamily: C.display, fontSize: 11.5, color: C.muted, marginTop: 3 }}>Waiting for the coach to approve your join request.</div>
      </div>
    );
  }

  // Not in a club — search + join.
  return (
    <div style={{ marginBottom: 13 }}>
      <SearchBar value={q} onChange={setQ} placeholder="Find your club…" C={C} />
      {results.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {results.map((c) => (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13, color: C.text }}>{c.name}</div>
                <div style={{ fontFamily: C.display, fontSize: 10.5, color: C.muted, marginTop: 2 }}>
                  {c.location ? `${c.location} · ` : ""}{c.privacy === "private" ? "Private" : "Public"}
                </div>
              </div>
              <button onClick={() => doJoin(c)} disabled={busy} className="ath-press" style={{
                flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: "none",
                background: C.accent, color: C.btnText, fontFamily: C.display, fontWeight: 700, fontSize: 11,
                cursor: "pointer", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent",
              }}>
                {c.privacy === "private" ? "Request" : "Join"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Public — real communities (public.communities / community_members in
// Supabase). Slovenija (has a description) leads as the featured hero; any
// others (Muharji, and whatever gets added later) list below it. ──
function PublicTab({ C, user, onOpen, reloadRef }) {
  const [q, setQ] = useState("");
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    listCommunities(user?.id).then(setCommunities).catch(() => {}).finally(() => setLoading(false));
  }, [user?.id]);
  useEffect(() => { reload(); }, [reload]);
  // Let the parent screen trigger a refresh too (e.g. right after creating
  // a new community, or when a detail view is closed after a join/leave).
  useEffect(() => { if (reloadRef) reloadRef.current = reload; }, [reloadRef, reload]);

  const toggleJoin = async (community) => {
    // Optimistic — flip locally first, then fire the real request.
    const wasJoined = !!community.myRole;
    setCommunities((list) => list.map((c) => c.id === community.id
      ? { ...c, myRole: wasJoined ? null : "member", members: c.members + (wasJoined ? -1 : 1) }
      : c));
    if (!hasSupabase) return; // demo mode: no persistence to reload from — keep the optimistic flip
    try {
      if (wasJoined) await leaveCommunity(community.id, user?.id);
      else await joinCommunity(community.id, user?.id);
    } catch {}
    reload();
  };

  // Search by name, description, sport or country (spec: "tags" don't exist
  // as their own concept in this data model, so they're not searched).
  const needle = q.trim().toLowerCase();
  const filtered = !needle ? communities : communities.filter((c) =>
    [c.name, c.description, c.sport, c.country].some((f) => f && f.toLowerCase().includes(needle)));
  const featured = !q && filtered.find((c) => c.slug === "slovenija");
  const rest = filtered.filter((c) => c !== featured);

  return (
    <div style={{ animation: "athlosCommFade 0.3s ease" }}>
      <div style={{ marginBottom: 15 }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search communities…" C={C} />
      </div>

      {featured && (
        <div style={{ marginBottom: 17 }}>
          <CommunityCard community={featured} variant="featured" C={C} onToggleJoin={toggleJoin} onOpen={onOpen} />
        </div>
      )}

      <SectionHeader C={C}>{featured ? "Communities" : "All Communities"}</SectionHeader>
      <div>
        {rest.map((c) => <CommunityCard key={c.id} community={c} variant="trending" C={C} onToggleJoin={toggleJoin} onOpen={onOpen} />)}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", color: C.muted, fontFamily: C.display, fontStyle: "italic", fontSize: 13, padding: "15px 0" }}>
            No communities match “{q}”.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────
// `onConvOpenChange` is forwarded to ScreenChat and up to App.jsx, which
// already had the wiring in place (chatConvOpen) to hide the bottom nav
// while a full-screen conversation/new-chat/new-group subview is open.
export default function ScreenCommunity({ user, profile, onConvOpenChange }) {
  const C = useTheme();
  const [tab, setTab] = useState("private");
  const [openCommunity, setOpenCommunity] = useState(null); // full community row, or null
  const [showCreate, setShowCreate] = useState(false);
  const publicReloadRef = useRef(null);

  const openDetail = async (community) => {
    haptic();
    // Re-fetch the full row (invite_code etc. aren't on the list-view shape).
    const full = await getCommunity(community.id, user?.id).catch(() => null);
    setOpenCommunity(full || community);
    onConvOpenChange?.(true); // same full-screen treatment as an open chat
  };
  const closeDetail = () => {
    setOpenCommunity(null);
    onConvOpenChange?.(false);
    publicReloadRef.current?.();
  };

  return (
    <div style={{ padding: "8px 13px 26px", color: C.text, position: "relative", minHeight: "100%" }}>
      <style>{`
        .ath-press { transition: transform 0.14s cubic-bezier(0.22,1,0.36,1); }
        .ath-press:active { transform: scale(0.975); }
        @keyframes athlosCommFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* Header */}
      <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 22, margin: "5px 0 4px", letterSpacing: "-0.02em" }}>Community</h2>
      <p style={{ fontFamily: C.display, fontSize: 12, color: C.muted, margin: "0 0 13px" }}>Train together. Compete together.</p>

      {/* Segmented control */}
      <div style={{ marginBottom: 15 }}>
        <SegmentedControl
          tabs={[{ key: "private", label: "Private" }, { key: "public", label: "Public" }]}
          value={tab} onChange={setTab} C={C}
        />
      </div>

      {tab === "private"
        ? <PrivateTab user={user} profile={profile} onConvOpenChange={onConvOpenChange} C={C} />
        : <PublicTab C={C} user={user} onOpen={openDetail} reloadRef={publicReloadRef} />}

      {/* Create Community FAB — Public tab only */}
      {tab === "public" && (
        <button onClick={() => { haptic(); setShowCreate(true); }} aria-label="Create Community" style={{
          position: "fixed", bottom: "calc(90px + env(safe-area-inset-bottom, 0px))", right: 20, zIndex: 5,
          width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer",
          background: C.accent, color: C.btnText, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 10px 26px ${C.accent}45`, WebkitTapHighlightColor: "transparent",
        }}>
          <Plus size={24} strokeWidth={2.3} />
        </button>
      )}

      {openCommunity && (
        <CommunityDetail community={openCommunity} user={user} C={C} onClose={closeDetail} onChanged={() => publicReloadRef.current?.()} />
      )}

      {showCreate && (
        <CreateCommunitySheet user={user} C={C} onClose={() => setShowCreate(false)}
          onCreated={(c) => { publicReloadRef.current?.(); if (c) openDetail(c); }} />
      )}
    </div>
  );
}
