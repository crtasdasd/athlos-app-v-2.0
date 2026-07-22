import React, { useEffect } from "react";
import { useTheme } from "../theme";
import { Pressable } from "./UI";

// Shared confirmation bottom sheet — icon medallion, title, description,
// stacked primary/cancel actions. Every confirmation dialog in the app goes
// through this so they share one visual language, one destructive-action
// color (theme's C.red, not three slightly-different hardcoded hex values),
// and one dismissal behavior instead of each screen reimplementing its own.
//
// `icon` should be passed WITHOUT an explicit color/stroke — the wrapping
// medallion sets CSS `color`, and both lucide-react icons and this app's own
// inline <svg icons (via stroke="currentColor") pick that up automatically.
export default function ConfirmDialog({
  open, onClose, icon, tone = "neutral",
  title, description,
  confirmLabel, onConfirm, confirmBusy = false,
  cancelLabel = "Prekliči",
}) {
  const C = useTheme();
  const tint = tone === "danger" ? C.red : C.accent;

  // Escape (desktop) + Android/browser back (mobile) both dismiss the sheet
  // instead of leaving the screen underneath it — one transient history
  // entry while open, popped again on close (previously only the Logout
  // dialog bothered with this; now every consumer gets it for free).
  useEffect(() => {
    if (!open) return;
    const close = () => onClose?.();
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    window.history.pushState({ athlosDialog: true }, "");
    window.addEventListener("popstate", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", close);
      if (window.history.state && window.history.state.athlosDialog) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 95, background: "rgba(12,14,20,0.5)",
        animation: "athlosFade 0.2s ease", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: C.surface, borderRadius: "32px 32px 0 0",
        padding: "14px 24px max(28px, env(safe-area-inset-bottom, 28px))",
        boxShadow: C.name === "dark" ? "0 -18px 50px rgba(0,0,0,0.55)" : "0 -18px 50px rgba(16,24,40,0.18)",
        animation: "athlosRise 0.36s cubic-bezier(0.22,1,0.36,1)",
      }}>
        <div aria-hidden="true" style={{ width: 34, height: 4, borderRadius: 2, background: C.border2, margin: "0 auto 22px" }} />

        {icon && (
          <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto 22px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div aria-hidden="true" style={{
              position: "absolute", width: 130, height: 130, borderRadius: "50%", pointerEvents: "none",
              background: `radial-gradient(circle, ${tint}22, transparent 70%)`,
            }} />
            <div style={{
              position: "relative", width: 80, height: 80, borderRadius: "50%",
              background: `${tint}14`, border: `1px solid ${tint}38`, boxShadow: C.glowSoft,
              display: "flex", alignItems: "center", justifyContent: "center", color: tint,
            }}>
              {icon}
            </div>
          </div>
        )}

        <h3 style={{ fontFamily: C.display, fontWeight: 800, fontSize: 19.5, lineHeight: 1.25, textAlign: "center", color: C.text, margin: "0 auto 12px", maxWidth: 270, letterSpacing: "-0.015em" }}>{title}</h3>
        {description && <p style={{ fontFamily: C.display, fontSize: 13, fontWeight: 500, lineHeight: 1.6, textAlign: "center", color: C.muted, margin: "0 auto 28px", maxWidth: 300 }}>{description}</p>}

        <Pressable onClick={onConfirm} disabled={confirmBusy} scale={0.97} style={{
          width: "100%", padding: "17px", borderRadius: 999, border: "none",
          background: tint, color: tone === "danger" ? "#FFFFFF" : C.btnText,
          fontFamily: C.display, fontWeight: 700, fontSize: 14.5, marginBottom: 9,
          boxShadow: `0 12px 26px ${tint}45`,
        }}>{confirmLabel}</Pressable>

        <Pressable onClick={onClose} scale={0.97} style={{
          width: "100%", padding: "17px", borderRadius: 999, border: `1px solid ${C.border2}`,
          background: C.name === "dark" ? C.surface2 : "#FFFFFF", color: C.text,
          fontFamily: C.display, fontWeight: 700, fontSize: 14.5,
          boxShadow: C.name === "dark" ? "none" : "0 6px 18px rgba(16,24,40,0.08)",
        }}>{cancelLabel}</Pressable>
      </div>
    </div>
  );
}
