import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import {
  Heart, MessageCircle, Trophy, MapPin, Users, UserPlus, UserCheck,
  Lock, Globe, Plus, X, ChevronLeft, Search, Image as ImageIcon, Send, Trash2, Crown, LogOut,
} from "lucide-react";
import { Mono, SkeletonBlock, Card, PrimaryBtn, ToggleChip } from "../../components/UI";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useDatePicker, useTimePicker } from "../../theme";
import { isoOffset, fmtDate } from "../ScreenSeason";
import {
  getCommunityOverview, getCommunityLeaderboard,
  listCommunityPosts, createCommunityPost, deleteCommunityPost, toggleCommunityPostLike,
  listPostComments, addPostComment,
  listCommunityEvents, createCommunityEvent, joinCommunityEvent, leaveCommunityEvent,
  listCommunityMembersDetailed, followUser, unfollowUser,
  joinCommunity, leaveCommunity, joinCommunityByCode, createCommunity, getCommunityInviteCode, uploadCommunityMedia,
} from "../../lib/api";

// ══════════════════════════════════════════════════════════════
// Community Detail — full-screen overlay opened from ScreenCommunity's
// Public tab. Five tabs (Overview / Feed / Leaderboard / Events / Members),
// each backed by real Supabase data (supabase/schema.sql — communities
// module). No distance/calorie/strain telemetry exists anywhere in this
// app, so the leaderboard ranks by the one real number: workouts logged.
// ══════════════════════════════════════════════════════════════

const haptic = () => { try { navigator.vibrate?.(8); } catch {} };
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`);

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({ name, photo, size = 40, C }) {
  if (photo) return <img src={photo} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: C.surface3, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.display, fontWeight: 700, fontSize: size * 0.4, color: C.muted }}>
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

const SectionHeader = ({ children, C, action, onAction }) => (
  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "24px 0 11px" }}>
    <h3 style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13.5, color: C.text, margin: 0, letterSpacing: "-0.01em" }}>{children}</h3>
    {action && <button onClick={onAction} style={{ background: "none", border: "none", color: C.accent, fontFamily: C.display, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0 }}>{action}</button>}
  </div>
);

const EmptyState = ({ text, C }) => (
  <div style={{ textAlign: "center", padding: "36px 16px", color: C.muted, fontFamily: C.display, fontStyle: "italic", fontSize: 13 }}>
    {text}
  </div>
);

function SkeletonRows({ n = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0" }}>
          <SkeletonBlock width={40} height={40} radius={999} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <SkeletonBlock width={`${60 - i * 8}%`} height={13} radius={5} />
            <SkeletonBlock width={`${40 - i * 5}%`} height={11} radius={5} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab strip — horizontally scrollable, sliding underline ──
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "feed", label: "Feed" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "events", label: "Events" },
  { key: "members", label: "Members" },
];

// A single indicator element that slides between tabs (measured via refs),
// instead of a new underline mounting/unmounting under whichever tab is
// active — that never actually animates between positions.
function TabStrip({ value, onChange, C }) {
  const btnRefs = useRef([]);
  const [ind, setInd] = useState(null);

  useLayoutEffect(() => {
    const i = TABS.findIndex((t) => t.key === value);
    const el = btnRefs.current[i];
    if (el) setInd({ left: el.offsetLeft + 12, width: el.offsetWidth - 24 });
  }, [value]);

  return (
    <div className="athlos-scroll" style={{ position: "relative", display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none", borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
      {TABS.map((t, i) => {
        const on = t.key === value;
        return (
          <button key={t.key} ref={(el) => (btnRefs.current[i] = el)} onClick={() => { haptic(); onChange(t.key); }} style={{
            flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "12px 14px 13px",
            fontFamily: C.display, fontWeight: on ? 800 : 600, fontSize: 13.5, color: on ? C.text : C.muted,
            WebkitTapHighlightColor: "transparent", transition: "color 0.25s",
          }}>
            {t.label}
          </button>
        );
      })}
      {ind && (
        <span aria-hidden="true" style={{
          position: "absolute", left: ind.left, width: ind.width, bottom: -1, height: 2, borderRadius: 2,
          background: C.accent,
          transition: "left 0.32s cubic-bezier(0.22,1,0.36,1), width 0.32s cubic-bezier(0.22,1,0.36,1)",
        }} />
      )}
    </div>
  );
}

// ── Overview — stats read as one typographic row (numbers carry the
// weight, a hairline divider relates them instead of three boxed tiles),
// and the two highlights lean on the same "eyebrow + vertical rule" idiom
// as the rest of ATHLOS rather than another bordered card. ──
function OverviewTab({ community, C }) {
  const [stats, setStats] = useState(null);
  useEffect(() => { getCommunityOverview(community.id).then(setStats); }, [community.id]);

  return (
    <div>
      {community.description && (
        <p style={{ fontFamily: C.display, fontSize: 13.5, lineHeight: 1.65, color: C.text2, margin: "0 0 22px" }}>{community.description}</p>
      )}
      {!stats ? <SkeletonRows C={C} n={2} /> : (
        <>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            {[["WORKOUTS", stats.totalWorkouts], ["ACTIVE THIS WEEK", stats.activeMembers], ["MEMBERS", stats.memberCount]].map(([label, value], i) => (
              <div key={label} style={{ flex: 1, paddingLeft: i ? 16 : 0, borderLeft: i ? `1px solid ${C.border}` : "none" }}>
                <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 23, color: C.text, letterSpacing: "-0.02em" }}>{value}</div>
                <Mono style={{ color: C.muted2, fontSize: 8.5, letterSpacing: "0.1em", display: "block", marginTop: 5 }}>{label}</Mono>
              </div>
            ))}
          </div>

          <SectionHeader C={C}>Weekly Challenge</SectionHeader>
          {stats.weeklyChallenge ? (
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Trophy size={17} color={C.accent} strokeWidth={1.7} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13.5, color: C.text }}>{stats.weeklyChallenge}</span>
            </div>
          ) : <EmptyState text="No active challenge this week." C={C} />}

          <SectionHeader C={C}>Upcoming Event</SectionHeader>
          {stats.nextEvent ? (
            <div style={{ position: "relative", paddingLeft: 14 }}>
              <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 2, bottom: 2, width: 2.5, borderRadius: 2, background: C.accent }} />
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14.5, color: C.text }}>{stats.nextEvent.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <Mono style={{ color: C.muted, fontSize: 9 }}>{stats.nextEvent.date} · {stats.nextEvent.time}</Mono>
                {stats.nextEvent.location && (
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <MapPin size={11} color={C.muted} /><Mono style={{ color: C.muted, fontSize: 9 }}>{stats.nextEvent.location}</Mono>
                  </span>
                )}
              </div>
            </div>
          ) : <EmptyState text="No upcoming events." C={C} />}
        </>
      )}
    </div>
  );
}

// ── Feed ──────────────────────────────────────────────────────
function CommentsSheet({ post, user, C, onClose, onCommentAdded }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => { listPostComments(post.id).then(setComments); }, [post.id]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const c = await addPostComment(post.id, user?.id, text.trim());
      setComments((prev) => [...(prev || []), { ...c, name: "You", photo: null }]);
      setText("");
      onCommentAdded?.();
    } catch {}
    setSending(false);
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.55)" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "78%", display: "flex", flexDirection: "column", background: C.bg, borderRadius: "24px 24px 0 0", animation: "athlosRise 0.28s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ width: 34, height: 4, borderRadius: 2, background: C.border2, margin: "10px auto 6px" }} />
        <Mono style={{ color: C.muted, fontSize: 9, letterSpacing: "0.14em", textAlign: "center", display: "block", padding: "4px 0 10px" }}>COMMENTS</Mono>
        <div className="athlos-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 15px" }}>
          {comments == null ? <SkeletonRows C={C} n={3} /> : comments.length === 0 ? (
            <EmptyState text="No comments yet — be the first." C={C} />
          ) : comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 9, padding: "8px 0" }}>
              <Avatar name={c.name} photo={c.photo} size={30} C={C} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 12.5, color: C.text }}>{c.name}</span>
                <span style={{ fontFamily: C.display, fontSize: 9, color: C.muted2, marginLeft: 7 }}>{timeAgo(c.created_at)}</span>
                <div style={{ fontFamily: C.display, fontSize: 13, color: C.text2, marginTop: 2, lineHeight: 1.4 }}>{c.content}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 15px", paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))", borderTop: `1px solid ${C.border}` }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Add a comment…" style={{ flex: 1, minWidth: 0, background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 999, padding: "9px 14px", color: C.text, fontFamily: C.display, fontSize: 13, outline: "none" }} />
          <button onClick={send} disabled={!text.trim() || sending} aria-label="Send" style={{
            width: 38, height: 38, borderRadius: "50%", border: "none", flexShrink: 0, cursor: text.trim() ? "pointer" : "default",
            background: text.trim() ? C.accent : C.surface3, color: text.trim() ? C.btnText : C.muted2,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><Send size={16} strokeWidth={2} /></button>
        </div>
      </div>
    </div>
  );
}

// A plain hairline-divided row rather than a bordered card per post — the
// feed reads as one continuous stream (Threads/Apple News), not a stack of
// identical rounded rectangles. Pinned is a small mono label, not a badge.
function PostCard({ post, user, isAdmin, C, onLikeToggled, onDeleted, onOpenComments }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (busy) return;
    haptic();
    setBusy(true);
    onLikeToggled(post.id, post.likedByMe);
    try { await toggleCommunityPostLike(post.id, user?.id, post.likedByMe); } catch {}
    setBusy(false);
  };
  const canDelete = post.user_id === user?.id || isAdmin;
  return (
    <div style={{ padding: "16px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={post.name} photo={post.photo} size={36} C={C} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13.5, color: C.text }}>{post.name}</span>
            {post.pinned && <Mono style={{ color: C.accent, fontSize: 8, letterSpacing: "0.1em" }}>PINNED</Mono>}
          </div>
          <Mono style={{ color: C.muted2, fontSize: 8.5 }}>{timeAgo(post.created_at)}</Mono>
        </div>
        {canDelete && (
          <button onClick={() => onDeleted(post.id)} aria-label="Delete" style={{ background: "none", border: "none", color: C.muted2, cursor: "pointer", padding: 4 }}>
            <Trash2 size={15} strokeWidth={1.8} />
          </button>
        )}
      </div>
      {post.content && <p style={{ fontFamily: C.display, fontSize: 13.5, color: C.text2, lineHeight: 1.55, margin: "10px 0 0" }}>{post.content}</p>}
      {post.image_url && <img src={post.image_url} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, marginTop: 10, display: "block" }} />}
      <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
        <button onClick={toggle} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: post.likedByMe ? C.red : C.muted, padding: 0 }}>
          <Heart size={16} strokeWidth={1.8} fill={post.likedByMe ? C.red : "none"} />
          <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 12.5 }}>{post.likeCount}</span>
        </button>
        <button onClick={() => onOpenComments(post)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 0 }}>
          <MessageCircle size={16} strokeWidth={1.8} />
          <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 12.5 }}>{post.commentCount}</span>
        </button>
      </div>
    </div>
  );
}

function FeedTab({ community, user, isMember, isAdmin, C }) {
  const [posts, setPosts] = useState(null);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [posting, setPosting] = useState(false);
  const [commentsFor, setCommentsFor] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const fileRef = useRef(null);

  const reload = useCallback(() => { listCommunityPosts(community.id, user?.id).then(setPosts); }, [community.id, user?.id]);
  useEffect(() => { reload(); }, [reload]);

  const onPick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setImageUrl(await uploadCommunityMedia(f, user?.id)); } catch {}
  };

  const submit = async () => {
    if ((!text.trim() && !imageUrl) || posting) return;
    setPosting(true);
    try { await createCommunityPost(community.id, user?.id, { content: text, imageUrl }); setText(""); setImageUrl(null); reload(); } catch {}
    setPosting(false);
  };

  const onLikeToggled = (postId, wasLiked) => {
    setPosts((list) => list.map((p) => p.id === postId ? { ...p, likedByMe: !wasLiked, likeCount: p.likeCount + (wasLiked ? -1 : 1) } : p));
  };
  // The trash button just requests a delete (opens the confirm dialog below);
  // doDeletePost is the real, previously-instant action.
  const doDeletePost = async (postId) => {
    setPosts((list) => list.filter((p) => p.id !== postId));
    try { await deleteCommunityPost(postId); } catch {}
  };

  return (
    <div>
      {isMember && (
        <Card style={{ marginBottom: 16 }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Share a workout or update…" rows={2}
            style={{ width: "100%", background: "none", border: "none", outline: "none", resize: "none", color: C.text, fontFamily: C.display, fontSize: 13.5, boxSizing: "border-box" }} />
          {imageUrl && (
            <div style={{ position: "relative", marginTop: 8, width: 76, height: 76 }}>
              <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
              <button onClick={() => setImageUrl(null)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: C.surface3, border: `1px solid ${C.border2}`, color: C.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4, display: "flex" }}><ImageIcon size={19} strokeWidth={1.8} /></button>
            <button onClick={submit} disabled={(!text.trim() && !imageUrl) || posting} style={{
              padding: "8px 18px", borderRadius: 999, border: "none", cursor: "pointer",
              background: (text.trim() || imageUrl) ? C.accent : C.surface3, color: (text.trim() || imageUrl) ? C.btnText : C.muted2,
              fontFamily: C.display, fontWeight: 800, fontSize: 12.5,
              boxShadow: (text.trim() || imageUrl) ? C.glowSoft : "none",
            }}>Post</button>
          </div>
        </Card>
      )}

      {posts == null ? <SkeletonRows C={C} n={3} /> : posts.length === 0 ? (
        <EmptyState text="No posts yet. Be the first to share something." C={C} />
      ) : posts.map((p) => (
        <PostCard key={p.id} post={p} user={user} isAdmin={isAdmin} C={C} onLikeToggled={onLikeToggled} onDeleted={setConfirmDeleteId} onOpenComments={setCommentsFor} />
      ))}

      {commentsFor && (
        <CommentsSheet post={commentsFor} user={user} C={C} onClose={() => setCommentsFor(null)}
          onCommentAdded={() => setPosts((list) => list.map((p) => p.id === commentsFor.id ? { ...p, commentCount: p.commentCount + 1 } : p))} />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        tone="danger"
        icon={<Trash2 size={30} />}
        title="Delete this post?"
        description="This can't be undone once deleted."
        confirmLabel="Delete"
        onConfirm={() => { doDeletePost(confirmDeleteId); setConfirmDeleteId(null); }}
      />
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────
function LeaderboardTab({ community, user, C }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { getCommunityLeaderboard(community.id).then(setRows); }, [community.id]);

  if (rows == null) return <SkeletonRows C={C} n={5} />;
  if (rows.length === 0) return <EmptyState text="No members yet." C={C} />;

  const medalColor = (i) => i === 0 ? "#FFD24A" : i === 1 ? "#C7CDD6" : i === 2 ? "#D9905A" : null;
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const podiumOrder = [1, 0, 2].filter((i) => top3[i]); // silver · gold · bronze, left to right

  return (
    <div>
      <Mono style={{ color: C.muted2, fontSize: 8.5, letterSpacing: "0.14em", display: "block", marginBottom: 20 }}>WORKOUTS · LAST 7 DAYS</Mono>

      {/* Podium — the one place a background wash is earned (it IS the
          featured content), but no border/glow: rank + size do the talking. */}
      {top3.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 26 }}>
          {podiumOrder.map((i) => {
            const r = top3[i];
            const mine = r.user_id === user?.id;
            const medal = medalColor(i);
            const isFirst = i === 0;
            return (
              <div key={r.user_id} style={{
                flex: isFirst ? 1.2 : 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                textAlign: "center", padding: isFirst ? "20px 6px 14px" : "10px 4px 10px", borderRadius: 20,
                background: isFirst ? `radial-gradient(120% 90% at 50% -10%, ${medal}20, transparent 62%)` : "transparent",
                animation: `athlosFade 0.35s ease ${i * 0.05}s both`,
              }}>
                <div style={{ position: "relative", marginBottom: 5 }}>
                  <Avatar name={r.name} photo={r.photo} size={isFirst ? 58 : 44} C={C} />
                  <span aria-hidden="true" style={{
                    position: "absolute", bottom: -3, right: -3, width: isFirst ? 24 : 20, height: isFirst ? 24 : 20,
                    borderRadius: "50%", background: C.bg, border: `2px solid ${C.bg}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Crown size={isFirst ? 13 : 11} color={medal} fill={medal} />
                  </span>
                </div>
                <span style={{ fontFamily: C.display, fontWeight: mine ? 800 : 700, fontSize: isFirst ? 13.5 : 12, color: mine ? C.accent : C.text, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name}
                </span>
                <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: isFirst ? 20 : 15, color: medal, marginTop: 2 }}>{r.workouts}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of the field — a plain ranked list, hairline-divided, no per-
          row card. "You" reads through weight + accent color, not a badge. */}
      {rest.length > 0 && (
        <div>
          {rest.map((r, idx) => {
            const i = idx + 3;
            const mine = r.user_id === user?.id;
            return (
              <div key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ width: 20, flexShrink: 0, textAlign: "center", fontFamily: C.mono, fontWeight: 700, fontSize: 11.5, color: C.muted2 }}>{i + 1}</span>
                <Avatar name={r.name} photo={r.photo} size={36} C={C} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: C.display, fontWeight: mine ? 800 : 600, fontSize: 13.5, color: mine ? C.accent : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 14.5, color: C.text }}>{r.workouts}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Events ────────────────────────────────────────────────────
function CreateEventSheet({ community, user, C, onClose, onCreated }) {
  const openDP = useDatePicker();
  const openTP = useTimePicker();
  const [title, setTitle] = useState("");
  // Defaults to today — the day you're actually creating the event on —
  // same ATHLOS date/time picker used for season events, not a native
  // browser <input type="date">.
  const [date, setDate] = useState(isoOffset(0));
  const [time, setTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const inp = { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${C.border2}`, background: C.surface2, color: C.text, fontFamily: C.display, fontSize: 14, outline: "none", boxSizing: "border-box", marginTop: 5, marginBottom: 12 };
  const pickerBtn = { width: "100%", marginTop: 5, marginBottom: 12, padding: "10px 12px", minHeight: 42, borderRadius: 12, border: `1px solid ${C.border2}`, background: C.surface2, color: C.text, fontFamily: C.display, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", WebkitTapHighlightColor: "transparent", boxSizing: "border-box" };

  const submit = async () => {
    if (!title.trim() || !date || saving) return;
    setSaving(true);
    try { const e = await createCommunityEvent(community.id, user?.id, { title, date, time, location }); onCreated(e); onClose(); } catch {}
    setSaving(false);
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.55)" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.bg, borderRadius: "24px 24px 0 0", padding: "16px 16px", paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))", animation: "athlosRise 0.28s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ width: 34, height: 4, borderRadius: 2, background: C.border2, margin: "0 auto 16px" }} />
        <h3 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 16, color: C.text, margin: "0 0 12px" }}>New Event</h3>
        <Mono style={{ color: C.muted, fontSize: 9 }}>TITLE</Mono>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Saturday Long Run" style={inp} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Mono style={{ color: C.muted, fontSize: 9 }}>DATE</Mono>
            <button
              onClick={() => openDP && openDP({ value: date, onChange: setDate, wheel: true, yearsAhead: 2, label: "EVENT DATE" })}
              style={pickerBtn}
            >
              <span>{fmtDate(date, "en")}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
              </svg>
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <Mono style={{ color: C.muted, fontSize: 9 }}>TIME</Mono>
            <button
              onClick={() => openTP && openTP({ value: time, onChange: setTime })}
              style={{ ...pickerBtn, justifyContent: "center", gap: 6 }}
            >
              <span>{time}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
              </svg>
            </button>
          </div>
        </div>
        <Mono style={{ color: C.muted, fontSize: 9 }}>LOCATION</Mono>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" style={inp} />
        <button onClick={submit} disabled={!title.trim() || !date || saving} style={{
          width: "100%", height: 46, borderRadius: 14, border: "none", cursor: "pointer",
          background: (title.trim() && date) ? C.accent : C.surface3, color: (title.trim() && date) ? C.btnText : C.muted2,
          fontFamily: C.display, fontWeight: 800, fontSize: 14,
        }}>Create Event</button>
      </div>
    </div>
  );
}

function EventsTab({ community, user, isAdmin, C }) {
  const [events, setEvents] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const reload = useCallback(() => { listCommunityEvents(community.id, user?.id).then(setEvents); }, [community.id, user?.id]);
  useEffect(() => { reload(); }, [reload]);

  const toggleJoin = async (ev) => {
    haptic();
    setEvents((list) => list.map((e) => e.id === ev.id ? { ...e, joinedByMe: !ev.joinedByMe, participants: e.participants + (ev.joinedByMe ? -1 : 1) } : e));
    try { if (ev.joinedByMe) await leaveCommunityEvent(ev.id, user?.id); else await joinCommunityEvent(ev.id, user?.id); } catch {}
  };

  return (
    <div>
      {isAdmin && (
        <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 0 20px", border: "none", background: "none", color: C.accent, fontFamily: C.display, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <Plus size={16} /> Create Event
        </button>
      )}
      {events == null ? <SkeletonRows C={C} n={2} /> : events.length === 0 ? (
        <EmptyState text="No events scheduled yet." C={C} />
      ) : (
        <div>
          {events.map((ev) => (
            <div key={ev.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 14.5, color: C.text }}>{ev.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 7, flexWrap: "wrap" }}>
                  <Mono style={{ color: C.muted, fontSize: 9 }}>{ev.date} · {ev.time}</Mono>
                  {ev.location && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MapPin size={11} color={C.muted} /><Mono style={{ color: C.muted, fontSize: 9 }}>{ev.location}</Mono></span>}
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={11} color={C.muted} /><Mono style={{ color: C.muted, fontSize: 9 }}>{ev.participants}</Mono></span>
                </div>
              </div>
              <ToggleChip active={ev.joinedByMe} onClick={() => toggleJoin(ev)} label="Join" activeLabel="Joined" />
            </div>
          ))}
        </div>
      )}
      {showCreate && <CreateEventSheet community={community} user={user} C={C} onClose={() => setShowCreate(false)} onCreated={reload} />}
    </div>
  );
}

// ── Members ───────────────────────────────────────────────────
function MembersTab({ community, user, C }) {
  const [members, setMembers] = useState(null);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  useEffect(() => { listCommunityMembersDetailed(community.id, user?.id).then(setMembers); }, [community.id, user?.id]);

  const toggleFollow = async (m) => {
    haptic();
    setMembers((list) => list.map((x) => x.user_id === m.user_id ? { ...x, followedByMe: !m.followedByMe } : x));
    try { if (m.followedByMe) await unfollowUser(user?.id, m.user_id); else await followUser(user?.id, m.user_id); } catch {}
  };

  const filtered = (members || []).filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, background: C.surface2, borderRadius: 12, padding: "10px 13px", marginBottom: 18,
        boxShadow: focus ? `0 0 0 3px ${C.accent}1f` : "none", transition: "box-shadow 0.2s",
      }}>
        <Search size={15} color={focus ? C.accent : C.muted2} style={{ transition: "color 0.2s" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          placeholder="Search members…" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontFamily: C.display, fontSize: 13 }} />
      </div>
      {members == null ? <SkeletonRows C={C} n={5} /> : filtered.length === 0 ? (
        <EmptyState text={q ? `No members match "${q}".` : "No members yet."} C={C} />
      ) : (
        <div>
          {filtered.map((m) => {
            const isMe = m.user_id === user?.id;
            return (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                <Avatar name={m.name} photo={m.photo} size={40} C={C} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 13.5, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                    {m.role === "admin" && <Crown size={12} color="#FFD24A" fill="#FFD24A" />}
                  </div>
                  <Mono style={{ color: C.muted2, fontSize: 8.5 }}>{m.weeklyWorkouts} WORKOUTS THIS WEEK</Mono>
                </div>
                {!isMe && (
                  <ToggleChip
                    active={m.followedByMe} onClick={() => toggleFollow(m)}
                    icon={<UserPlus size={13} />} label="Follow"
                    activeIcon={<UserCheck size={13} />} activeLabel="Following"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main detail screen ───────────────────────────────────────
export default function CommunityDetail({ community: initial, user, C, onClose, onChanged }) {
  const [community, setCommunity] = useState(initial);
  const [tab, setTab] = useState("overview");
  const [inviteCode, setInviteCode] = useState(null);
  const [codeEntry, setCodeEntry] = useState(null); // typed code while joining a private community, or null
  const [codeError, setCodeError] = useState("");
  const [joining, setJoining] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isMember = !!community.myRole;
  const isAdmin = community.myRole === "admin";
  const isPrivate = community.privacy === "private";
  const dark = C.name === "dark";

  // Fetched separately (never part of the general community row — see
  // COMMUNITY_COLUMNS / get_community_invite_code in api.js) — the RPC
  // itself refuses to return anything unless the caller is this admin.
  useEffect(() => {
    if (isPrivate && isAdmin) getCommunityInviteCode(community.id).then(setInviteCode);
  }, [community.id, isPrivate, isAdmin]);

  const leave = async () => {
    haptic();
    setCommunity((c) => ({ ...c, myRole: null, members: c.members - 1 }));
    try { await leaveCommunity(community.id, user?.id); } catch {}
    onChanged?.();
  };

  // Public community → join immediately. Private → this only opens the
  // code prompt; submitCode() below does the actual join.
  const startJoin = () => {
    haptic();
    if (isPrivate) { setCodeEntry(""); return; }
    setCommunity((c) => ({ ...c, myRole: "member", members: c.members + 1 }));
    joinCommunity(community.id, user?.id).catch(() => {});
    onChanged?.();
  };

  const submitCode = async () => {
    if (!codeEntry?.trim() || joining) return;
    setJoining(true);
    setCodeError("");
    try {
      await joinCommunityByCode(codeEntry, user?.id);
      setCommunity((c) => ({ ...c, myRole: "member", members: c.members + 1 }));
      setCodeEntry(null);
      onChanged?.();
    } catch {
      setCodeError("Invalid invite code.");
    }
    setJoining(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, background: C.bg, display: "flex", flexDirection: "column", animation: "athlosFade 0.22s ease" }}>
      {/* Cover + header */}
      <div className="athlos-scroll" style={{ flex: 1, overflowY: "auto" }}>
        <div style={{
          position: "relative", height: 178, overflow: "hidden",
          background: community.cover_url
            ? `url(${community.cover_url}) center/cover`
            : `radial-gradient(120% 90% at 85% -10%, ${C.accent}1c, transparent 55%), linear-gradient(165deg, ${C.surface2}, ${C.surface})`,
        }}>
          {/* No cover photo → the same ZEUS statue watermark as the AI chat
              (god-bolt.png, inverted in dark mode), laid across the banner
              instead of a plain color gradient — quiet ATHLOS mythology
              rather than a generic dashboard header block. */}
          {!community.cover_url && (
            <img src="/img/god-bolt.png" alt="" aria-hidden="true" style={{
              position: "absolute", zIndex: 0, bottom: -70, right: -60, height: 340, width: "auto",
              opacity: dark ? 0.16 : 0.09, filter: dark ? "invert(1)" : "none",
              pointerEvents: "none", userSelect: "none",
            }} />
          )}
          {/* Fade only a real cover photo into the page background — the ZEUS
              watermark is already faint, and fading it all the way to C.bg
              was swallowing the avatar's border (also C.bg) right where the
              two meet, so the avatar visually vanished into the banner. */}
          {community.cover_url && (
            <div aria-hidden="true" style={{ position: "absolute", zIndex: 0, inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, ${C.bg} 96%)` }} />
          )}
          <button onClick={onClose} aria-label="Back" style={{
            position: "absolute", zIndex: 1, top: "max(14px, env(safe-area-inset-top, 14px))", left: 15,
            width: 38, height: 38, borderRadius: "50%", border: "none",
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <ChevronLeft size={21} />
          </button>
        </div>

        <div style={{ padding: "0 18px 10px" }}>
          {/* Explicit stacking context + z-index so the avatar always paints
              above the banner artwork behind it, never just relying on DOM
              order — the negative marginTop pulls it up over the ZEUS art. */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", marginTop: -46, marginBottom: 16 }}>
            <span style={{
              width: 92, height: 92, borderRadius: 26, flexShrink: 0, background: C.surface3,
              border: `4px solid ${C.bg}`, boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: community.flag ? 38 : 0, overflow: "hidden",
            }}>
              {community.image_url
                ? <img src={community.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : community.flag || <span style={{ fontFamily: C.display, fontWeight: 800, fontSize: 34, color: C.muted }}>{community.name?.trim().charAt(0).toUpperCase()}</span>}
            </span>
          </div>

          <h2 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 25, color: C.text, margin: "0 0 11px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            {community.name}
          </h2>

          {/* Meta reads as one calm line of text — middot-separated — instead
              of a row of same-weight badge chips. */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "5px 9px", marginBottom: 22, color: C.muted, fontFamily: C.display, fontSize: 12.5, fontWeight: 500 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={12} strokeWidth={1.8} />{fmt(community.members)} members</span>
            <span aria-hidden="true" style={{ color: C.muted2 }}>·</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {community.privacy === "private" ? <Lock size={12} strokeWidth={1.8} /> : <Globe size={12} strokeWidth={1.8} />}
              {community.privacy === "private" ? "Private" : "Public"}
            </span>
            {community.sport && <><span aria-hidden="true" style={{ color: C.muted2 }}>·</span><span>{community.sport}</span></>}
            {community.country && <><span aria-hidden="true" style={{ color: C.muted2 }}>·</span><span>{community.country}</span></>}
          </div>

          <PrimaryBtn onClick={isMember ? () => setConfirmLeave(true) : startJoin} style={isMember ? {
            height: 50, background: "transparent", color: C.muted, outline: `1px solid ${C.border2}`, boxShadow: "none",
          } : { height: 50 }}>
            {isMember ? "Joined" : isPrivate ? "Join with code" : "Join Community"}
          </PrimaryBtn>

          {codeEntry !== null && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 4 }}>
              <input
                value={codeEntry}
                onChange={(e) => { setCodeEntry(e.target.value.toUpperCase()); setCodeError(""); }}
                onKeyDown={(e) => e.key === "Enter" && submitCode()}
                placeholder="6-character code" maxLength={6} autoFocus
                style={{ flex: 1, minWidth: 0, background: C.surface2, border: `1px solid ${codeError ? C.red : C.border2}`, borderRadius: 12, padding: "10px 12px", color: C.text, fontFamily: C.mono, fontWeight: 700, letterSpacing: "0.14em", fontSize: 14, outline: "none" }}
              />
              <button onClick={submitCode} disabled={!codeEntry.trim() || joining} style={{
                padding: "0 18px", borderRadius: 12, border: "none", cursor: "pointer",
                background: codeEntry.trim() ? C.accent : C.surface3, color: codeEntry.trim() ? C.btnText : C.muted2,
                fontFamily: C.display, fontWeight: 800, fontSize: 13,
              }}>Join</button>
            </div>
          )}
          {codeError && <div style={{ color: C.red, fontFamily: C.display, fontSize: 11.5, marginBottom: 4 }}>{codeError}</div>}

          {isPrivate && isAdmin && inviteCode && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 2px 0", marginTop: 14, borderTop: `1px solid ${C.border}` }}>
              <Mono style={{ color: C.muted, fontSize: 9 }}>INVITE CODE</Mono>
              <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 13, color: C.accent, letterSpacing: "0.1em" }}>{inviteCode}</span>
            </div>
          )}

          <div style={{ marginTop: 22 }}>
            <TabStrip value={tab} onChange={setTab} C={C} />
          </div>

          <div key={tab} style={{ animation: "athlosFade 0.28s ease" }}>
            {tab === "overview" && <OverviewTab community={community} C={C} />}
            {tab === "feed" && <FeedTab community={community} user={user} isMember={isMember} isAdmin={isAdmin} C={C} />}
            {tab === "leaderboard" && <LeaderboardTab community={community} user={user} C={C} />}
            {tab === "events" && <EventsTab community={community} user={user} isAdmin={isAdmin} C={C} />}
            {tab === "members" && <MembersTab community={community} user={user} C={C} />}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        tone="danger"
        icon={<LogOut size={30} />}
        title="Leave this community?"
        description="You'll no longer see posts or appear on this community's leaderboard."
        confirmLabel="Leave"
        onConfirm={() => { setConfirmLeave(false); leave(); }}
      />
    </div>
  );
}

// ── Create Community ──────────────────────────────────────────
export function CreateCommunitySheet({ user, C, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState("");
  const [country, setCountry] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [coverUrl, setCoverUrl] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [rules, setRules] = useState("");
  const [saving, setSaving] = useState(false);
  const coverRef = useRef(null), logoRef = useRef(null);

  const inp = { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${C.border2}`, background: C.surface2, color: C.text, fontFamily: C.display, fontSize: 14, outline: "none", boxSizing: "border-box", marginTop: 5, marginBottom: 12 };

  const pick = (setter) => async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setter(await uploadCommunityMedia(f, user?.id)); } catch {}
  };

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const c = await createCommunity(user?.id, { name, description, sport, country, privacy, coverUrl, imageUrl, rules });
      onCreated?.(c);
      onClose();
    } catch {}
    setSaving(false);
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.55)" }}>
      <div className="athlos-scroll" style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "92%", overflowY: "auto", background: C.bg, borderRadius: "24px 24px 0 0", padding: "16px 16px", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))", animation: "athlosRise 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ width: 34, height: 4, borderRadius: 2, background: C.border2, margin: "0 auto 16px" }} />
        <h3 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 18, color: C.text, margin: "0 0 14px" }}>Create Community</h3>

        <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
          <input ref={logoRef} type="file" accept="image/*" onChange={pick(setImageUrl)} style={{ display: "none" }} />
          <button onClick={() => logoRef.current?.click()} style={{ width: 66, height: 66, borderRadius: 18, border: `1.5px dashed ${C.border2}`, background: C.surface2, color: C.muted, cursor: "pointer", overflow: "hidden", flexShrink: 0 }}>
            {imageUrl ? <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={20} style={{ margin: "auto" }} />}
          </button>
          <input ref={coverRef} type="file" accept="image/*" onChange={pick(setCoverUrl)} style={{ display: "none" }} />
          <button onClick={() => coverRef.current?.click()} style={{ flex: 1, height: 66, borderRadius: 18, border: `1.5px dashed ${C.border2}`, background: C.surface2, color: C.muted, cursor: "pointer", overflow: "hidden", fontFamily: C.display, fontSize: 12, fontWeight: 600 }}>
            {coverUrl ? <img src={coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "Cover photo"}
          </button>
        </div>
        <Mono style={{ color: C.muted2, fontSize: 8, marginBottom: 12, display: "block" }}>LOGO · COVER (OPTIONAL)</Mono>

        <Mono style={{ color: C.muted, fontSize: 9 }}>COMMUNITY NAME</Mono>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trail Runners Slovenia" style={inp} />

        <Mono style={{ color: C.muted, fontSize: 9 }}>DESCRIPTION</Mono>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's this community about?" style={{ ...inp, resize: "none" }} />

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Mono style={{ color: C.muted, fontSize: 9 }}>SPORT</Mono>
            <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Running" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <Mono style={{ color: C.muted, fontSize: 9 }}>COUNTRY</Mono>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Slovenia" style={inp} />
          </div>
        </div>

        <Mono style={{ color: C.muted, fontSize: 9 }}>PRIVACY</Mono>
        <div style={{ display: "flex", gap: 8, marginTop: 5, marginBottom: 12 }}>
          {[["public", "Public", Globe], ["private", "Private", Lock]].map(([key, label, Icon]) => {
            const on = privacy === key;
            return (
              <button key={key} onClick={() => setPrivacy(key)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 12, cursor: "pointer",
                border: `1.5px solid ${on ? C.accent : C.border2}`, background: on ? `${C.accent}14` : "transparent", color: on ? C.text : C.muted,
                fontFamily: C.display, fontWeight: 700, fontSize: 13,
              }}><Icon size={15} />{label}</button>
            );
          })}
        </div>

        <Mono style={{ color: C.muted, fontSize: 9 }}>RULES (OPTIONAL)</Mono>
        <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={2} placeholder="Be respectful, log real workouts…" style={{ ...inp, resize: "none" }} />

        <button onClick={submit} disabled={!name.trim() || saving} style={{
          width: "100%", height: 47, borderRadius: 15, border: "none", cursor: "pointer", marginTop: 4,
          background: name.trim() ? C.accent : C.surface3, color: name.trim() ? C.btnText : C.muted2,
          fontFamily: C.display, fontWeight: 800, fontSize: 15,
        }}>{saving ? "Creating…" : "Create Community"}</button>
      </div>
    </div>
  );
}
