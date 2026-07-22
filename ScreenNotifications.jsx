import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import gsap from "gsap";
import { useTheme } from "../theme";
import { useT, useLang } from "../lib/i18n";
import {
  NotificationHeader, NotificationFilter, NotificationRow,
  NotificationsEmpty, formatRelative,
} from "../components/Notifications";
import {
  activeNotifications, unreadChatSummary,
  loadNotifState, markNotifsRead, dismissNotif, pruneNotifState,
} from "../lib/notifications";
import { setIntent } from "../lib/intent";
import { listCheckins } from "../lib/api";
import { adoptLocalWellness, syncWellnessFromCheckins } from "./widgets/CheckinCard";

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS — a real screen, not a bottom sheet.
//
// It was a 70%-height DragSheet with three identical bordered rows and no
// state at all: nothing could be read, dismissed or filtered, and every row
// looked the same because nothing distinguished them. A sheet is the right
// container for a glance; an inbox with filters, per-item actions and an
// empty state is a destination.
//
// The notifications themselves stay DERIVED — there is no server inbox, and
// inventing one would be fiction. They are computed from signals the app
// already keeps (today's check-in, unread conversations, today's session),
// and only "read"/"dismissed" is persisted (lib/notifications.js).
// ─────────────────────────────────────────────────────────────

const reduceMotion = typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function ScreenNotifications({ go, user, chatUnread = 0 }) {
  const C = useTheme();
  const t = useT();
  const lang = useLang();
  const listRef = useRef(null);

  const [filter, setFilter] = useState("all");
  const [leaving, setLeaving] = useState({});      // uid → true while animating out
  const [chatAt, setChatAt] = useState(null);      // real time of the newest unread message

  // Read/dismissed marks are held as REAL state, refreshed explicitly by the
  // handlers below. Reading localStorage straight into a useMemo would be an
  // impure read that only recomputes when some unrelated dependency happens to
  // change — the exact bug that made the Today check-in card claim it was
  // still pending after being answered.
  const [marks, setMarks] = useState(() => loadNotifState(user?.id));
  const refreshMarks = useCallback(() => setMarks(loadNotifState(user?.id)), [user?.id]);

  useEffect(() => {
    pruneNotifState(user?.id);
    setMarks(loadNotifState(user?.id));
  }, [user?.id]);

  // Reconcile the check-in "done" signal with the account, the same fix
  // applied on Today (see ScreenToday's matching effect for the full why):
  // the checkin reminder's on/off state is derived from a local-only store
  // that a fresh device or a cleared browser never received. Someone who
  // opens Notifications directly — without visiting Today first in this
  // session — would otherwise be told to check in again for a day they
  // already answered somewhere else. `refreshMarks()` re-derives `items`
  // below once the fold-in actually changes anything.
  useEffect(() => {
    if (!user?.id) return;
    adoptLocalWellness(user.id);
    let live = true;
    listCheckins(user.id, 60).then((rows) => {
      if (live && syncWellnessFromCheckins(user.id, rows)) refreshMarks();
    }).catch(() => {});
    return () => { live = false; };
  }, [user?.id, refreshMarks]);

  // The chat timestamp is the one genuinely async signal here.
  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    unreadChatSummary(user.id)
      .then((s) => { if (live) setChatAt(s.latestAt); })
      .catch(() => {});
    return () => { live = false; };
  }, [user?.id, chatUnread]);

  const now = useMemo(() => new Date(), []);

  // ── The inbox ──────────────────────────────────────────────
  // Structure comes from lib/notifications (shared with the bell on Today so
  // the two can never disagree); this screen only supplies the language.
  // `marks` is in the dependency list because the descriptors carry read state.
  const items = useMemo(() => {
    const chatLine = lang === "en"
      ? `${chatUnread} unread conversation${chatUnread === 1 ? "" : "s"}.`
      : chatUnread === 1 ? "1 neprebran pogovor."
      : chatUnread === 2 ? "2 neprebrana pogovora."
      : chatUnread <= 4 ? `${chatUnread} neprebrani pogovori.`
      : `${chatUnread} neprebranih pogovorov.`;
    const COPY = {
      checkin: {
        title: t("Jutranji check-in"),
        body: t("Odgovori na 4 vprašanja in posodobi svojo pripravljenost."),
      },
      chat: { title: t("Nova sporočila"), body: chatLine },
      train: { title: t("Današnji trening"), body: t("Moč · spodnji del ob 17:00.") },
    };
    return activeNotifications(user?.id, { chatUnread, chatAt, now, marks })
      .map((n) => ({ ...n, ...COPY[n.id] }));
  }, [user?.id, chatUnread, chatAt, marks, now, t, lang]);

  const unreadCount = items.filter((n) => n.unread).length;

  const shown = items.filter((n) =>
    filter === "unread" ? n.unread : filter === "important" ? n.important : true
  );

  // ── Entrance + filter transition: the visible rows re-stagger whenever the
  // list identity changes, so switching a filter reads as content arriving
  // rather than swapping. Same GSAP idiom as ScreenToday's [data-rise].
  useEffect(() => {
    if (reduceMotion) return;
    const el = listRef.current;
    if (!el || !el.children.length) return;
    const tween = gsap.fromTo(Array.from(el.children),
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.05, clearProps: "opacity,transform" });
    return () => tween.kill();
  }, [filter, shown.length]);

  const markRead = useCallback((uid) => {
    markNotifsRead(user?.id, uid);
    refreshMarks();
  }, [user?.id, refreshMarks]);

  const markAll = useCallback(() => {
    markNotifsRead(user?.id, items.filter((n) => n.unread).map((n) => n.uid));
    refreshMarks();
  }, [user?.id, items, refreshMarks]);

  // Animate out first, then commit — otherwise the row vanishes and the list
  // jumps before the eye can follow it.
  const dismiss = useCallback((uid) => {
    setLeaving((p) => ({ ...p, [uid]: true }));
    setTimeout(() => {
      dismissNotif(user?.id, uid);
      setLeaving((p) => { const n = { ...p }; delete n[uid]; return n; });
      refreshMarks();
    }, reduceMotion ? 0 : 330);
  }, [user?.id, refreshMarks]);

  // Tap = the notification's whole job: mark it read, then actually perform
  // it. `intent` carries the part that navigation alone can't express — the
  // check-in reminder has to OPEN the check-in, not just land on Today.
  const open = useCallback((n) => {
    markNotifsRead(user?.id, n.uid);
    if (n.intent) setIntent(n.intent);
    go(n.go);
  }, [user?.id, go]);

  // No per-chip counts: the header already states the unread number, and the
  // same fact drawn twice is the kind of thing that makes a screen busy.
  const FILTERS = [
    { id: "all", label: t("Vse") },
    { id: "unread", label: t("Neprebrano") },
    { id: "important", label: t("Pomembno") },
  ];

  return (
    <div style={{ padding: "8px 16px 24px", color: C.text, minHeight: "100%" }}>
      <NotificationHeader
        title={t("Obvestila")}
        unread={unreadCount}
        onBack={() => go("today")}
        backLabel={t("Nazaj")}
        onMarkAll={markAll}
        markAllLabel={t("Označi vse kot prebrano")}
      />

      <NotificationFilter options={FILTERS} value={filter} onChange={setFilter} />

      {shown.length > 0 && (
        <div ref={listRef} style={{ marginTop: 18 }}>
          {shown.map((n) => (
              <NotificationRow
                key={n.uid}
                title={n.title}
                body={n.body}
                time={formatRelative(n.at, lang, now)}
                unread={n.unread}
                leaving={!!leaving[n.uid]}
                onOpen={() => open(n)}
                onMarkRead={() => markRead(n.uid)}
                onDismiss={() => dismiss(n.uid)}
                markLabel={t("Prebrano")}
                dismissLabel={t("Skrij")}
              />
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <NotificationsEmpty
          title={filter === "all" ? t("Nič novega") : t("Nič tukaj")}
          body={filter === "all"
            ? t("Ko bo kaj potrebovalo tvojo pozornost, se bo pojavilo tukaj.")
            : t("Poskusi drug filter — morda je kaj v drugi kategoriji.")}
          ctaLabel={filter === "all" ? t("Nazaj na Danes") : t("Pokaži vse")}
          onCta={filter === "all" ? () => go("today") : () => setFilter("all")}
        />
      )}
    </div>
  );
}
