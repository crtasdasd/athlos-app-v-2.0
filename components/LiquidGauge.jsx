import React, { useEffect, useRef, useState } from "react";

// ── LiquidGauge ──────────────────────────────────────────────────────────
// Shared circular liquid-fill readiness gauge — the SAME material used on
// the athlete Today screen (was a local component there, `LiquidMetric` in
// ScreenToday.jsx). Extracted here so the coach app can show the exact same
// design instead of a plain ring (Battery.tsx), per "same design, different
// features" — no re-theming, just reuse.
//
// Portable: takes primitive props (dark boolean, plain color strings)
// instead of the athlete app's theme object, so both apps can render it
// with their own tokens.

// Scroll-driven "slosh": returns a ref for the water group. Scrolling injects
// velocity; a spring tilts + bounces the liquid and settles it back to level.
function useSlosh() {
  const gRef = useRef(null);
  useEffect(() => {
    const g = gRef.current;
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!g || reduceMotion) return;
    let el = g.ownerSVGElement?.parentElement;
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 4) break;
      el = el.parentElement;
    }
    const target = el && el !== document.body ? el : window;
    const getY = () => (target === window ? window.scrollY || 0 : target.scrollTop);
    let lastY = getY(), vel = 0, off = 0, raf = 0, running = false;
    const tick = () => {
      vel += -0.045 * off;
      vel *= 0.905;
      off += vel;
      const tilt = Math.max(-7, Math.min(7, off * 0.26));
      const by = Math.max(-4, Math.min(4, off * 0.09));
      g.setAttribute("transform", `rotate(${tilt.toFixed(2)} 60 60) translate(0 ${by.toFixed(2)})`);
      if (Math.abs(off) < 0.03 && Math.abs(vel) < 0.03) {
        g.setAttribute("transform", "rotate(0 60 60)"); running = false; return;
      }
      raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const y = getY();
      vel = Math.max(-15, Math.min(15, vel + (y - lastY) * 0.22));
      lastY = y;
      if (!running) { running = true; raf = requestAnimationFrame(tick); }
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => { target.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return gRef;
}

export default function LiquidGauge({
  value, max = 100, label, color, decimals = 0, fillAlpha = 0.62, dark = true, size = 122,
  headingFont = "'Poppins',system-ui,sans-serif", monoFont = "'JetBrains Mono',monospace",
  mutedColor = "rgba(16,24,40,0.45)",
}) {
  const pct = Math.max(0, Math.min(1, (value || 0) / max));
  const uid = useRef("lg" + Math.random().toString(36).slice(2, 8)).current;
  const slosh = useSlosh();
  const waterRef = useRef(null);
  const numRef = useRef(0), lvlRef = useRef(0);
  const [num, setNum] = useState(0);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const fromN = numRef.current, fromL = lvlRef.current;
    const dur = 1350, start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const easeBack = (t) => { const c = 1.70158 * 0.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const n = fromN + (value - fromN) * easeOut(t);
      setNum(n); numRef.current = n;
      const l = fromL + (pct - fromL) * easeBack(t);
      lvlRef.current = l;
      if (waterRef.current) waterRef.current.style.transform = `translateY(${(120 - Math.max(-0.02, Math.min(1.03, l)) * 120).toFixed(2)}px)`;
      if (t < 1) { raf = requestAnimationFrame(tick); return; }
      setNum(value); numRef.current = value; lvlRef.current = pct;
      if (waterRef.current) waterRef.current.style.transform = `translateY(${(120 - pct * 120).toFixed(2)}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, pct]);

  const well = dark ? "#141414" : "#EDF0F3";
  const border = hover
    ? (dark ? "rgba(255,255,255,0.10)" : "rgba(16,24,40,0.12)")
    : (dark ? "rgba(255,255,255,0.05)" : "rgba(16,24,40,0.07)");
  const numColor = dark ? "#FFFFFF" : "#0B0D10";
  const frontOp = fillAlpha, backOp = fillAlpha * 0.38;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
      <div
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          width: size, height: size, position: "relative", flexShrink: 0, borderRadius: "50%",
          border: `1px solid ${border}`,
          boxShadow: hover
            ? "0 8px 22px rgba(0,0,0,0.34)"
            : "0 4px 14px rgba(0,0,0,0.22)",
          transform: hover ? "scale(1.02)" : "scale(1)",
          transition: "transform 250ms cubic-bezier(.22,1,.36,1), box-shadow 250ms cubic-bezier(.22,1,.36,1), border-color 250ms",
        }}>
        <svg viewBox="0 0 120 120" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}>
          <defs>
            <clipPath id={uid}><circle cx="60" cy="60" r="59" /></clipPath>
            <radialGradient id={`${uid}sheen`} cx="32%" cy="15%" r="64%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.09" />
              <stop offset="58%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${uid}depth`} cx="50%" cy="102%" r="72%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.18" />
              <stop offset="62%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${uid}inner`} cx="50%" cy="50%" r="50%">
              <stop offset="84%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.24" />
            </radialGradient>
          </defs>
          <g clipPath={`url(#${uid})`}>
            <circle cx="60" cy="60" r="59" fill={well} />
            <g ref={slosh}>
              <g ref={waterRef} style={{ transform: "translateY(120px)" }}>
                <g>
                  <animateTransform attributeName="transform" type="translate" from="0 0" to="-120 0" dur="6s" repeatCount="indefinite" />
                  <path d="M-180,0 q30,-8 60,0 t60,0 t60,0 t60,0 t60,0 t60,0 t60,0 t60,0 V240 H-180 Z" fill={color} opacity={backOp} />
                </g>
                <g>
                  <animateTransform attributeName="transform" type="translate" from="-120 0" to="0 0" dur="4.3s" repeatCount="indefinite" />
                  <path d="M-180,3 q30,8 60,0 t60,0 t60,0 t60,0 t60,0 t60,0 t60,0 t60,0 V240 H-180 Z" fill={color} opacity={frontOp} />
                </g>
              </g>
            </g>
            <circle cx="60" cy="60" r="59" fill={`url(#${uid}depth)`} />
            <circle cx="60" cy="60" r="59" fill={`url(#${uid}sheen)`} />
            <circle cx="60" cy="60" r="59" fill={`url(#${uid}inner)`} />
          </g>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <span style={{ fontFamily: headingFont, fontWeight: 800, fontSize: size * 0.29, color: numColor, letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {num.toFixed(decimals)}
          </span>
        </div>
      </div>
      {label && (
        <span style={{ fontFamily: monoFont, fontSize: 9, fontWeight: 600, letterSpacing: "0.22em", color: dark ? "rgba(255,255,255,0.55)" : mutedColor, textTransform: "uppercase" }}>{label}</span>
      )}
    </div>
  );
}
