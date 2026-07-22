import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, useId } from "react";

// ─────────────────────────────────────────────────────────────
// LIQUID GLASS
//
// An approximation of the material Apple introduced in iOS 26, built from
// what a browser can actually do. Four things separate it from ordinary
// CSS glassmorphism, and all four are implemented here:
//
//  1. REFRACTION. Real glass has thickness, so content behind the rim is
//     bent inward. This is the single biggest tell. We do it properly: a
//     signed-distance field of the pill's own rounded-rect shape is
//     rasterised to a displacement map (R = x offset, G = y offset), and
//     `backdrop-filter: url(#…)` runs an feDisplacementMap against it. The
//     map is regenerated whenever the element resizes, so the lensing
//     always follows the real geometry.
//  2. LAYERED LIGHT. Not one translucent fill but four stacked layers:
//     refracting backdrop → tint → interior sheen → specular rim.
//  3. A SPECULAR RIM, not a border. A 1px ring whose brightness varies
//     around the shape (hot at the top edge, a weaker bounce along the
//     bottom, nearly nothing at the sides) — how a lit convex edge reads.
//  4. REAL SPRING PHYSICS. The selection capsule is integrated by an
//     actual damped-spring solver, not a cubic-bezier impression of one,
//     and its horizontal stretch is derived from live velocity — that is
//     the "liquid" in Liquid Glass.
//
// HONEST LIMITS, so nobody is surprised:
//  · `backdrop-filter: url()` is Chromium-only today. Safari and Firefox
//    silently drop the whole filter chain, so we feature-test and fall
//    back to blur + saturate, which still looks good but is flat glass —
//    no lensing. On iOS (Safari engine) you get the fallback.
//  · Apple's material also responds to ambient light and device tilt via
//    sensors we can't reach from a PWA without a permission prompt.
//  · Apple samples the backdrop at higher fidelity than `backdrop-filter`
//    exposes; our refraction acts on the already-blurred copy, so the rim
//    distortion is softer than the real thing.
// ─────────────────────────────────────────────────────────────

// Does this engine actually honour an SVG filter inside backdrop-filter?
// Chromium: yes. WebKit/Gecko: no — and they report it correctly, so a
// plain CSS.supports test is enough and we don't need to sniff the UA.
const supportsRefraction = (() => {
  if (typeof window === "undefined" || !window.CSS?.supports) return false;
  return CSS.supports("backdrop-filter", "url(#a)") ||
         CSS.supports("-webkit-backdrop-filter", "url(#a)");
})();

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ── Displacement map ──────────────────────────────────────────
// Signed distance to a rounded rectangle. Negative inside, 0 on the edge.
function sdRoundRect(px, py, w, h, r) {
  const qx = Math.abs(px - w / 2) - (w / 2 - r);
  const qy = Math.abs(py - h / 2) - (h / 2 - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

// Rasterise the lens. For every pixel we take the SDF gradient (the outward
// surface normal) and fade it in over `band` pixels from the edge, so the
// middle of the pill stays optically flat and only the rim bends light —
// exactly how a thick pane behaves. Encoded as R = x, G = y, with 128 as
// "no displacement" because feDisplacementMap reads channel/255 - 0.5.
function buildRefractionMap(w, h, band, radius) {
  const W = Math.max(2, Math.round(w));
  const H = Math.max(2, Math.round(h));
  const r = Math.max(0, Math.min(radius ?? Math.min(W, H) / 2, Math.min(W, H) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const px = x + 0.5, py = y + 0.5;
      const dist = sdRoundRect(px, py, W, H, r);

      // How strongly this pixel refracts: 0 deep inside, 1 at the rim.
      // Smoothstep keeps the transition from banding.
      let amt = 0;
      if (dist > -band) {
        const tRaw = (dist + band) / band;          // 0 at band edge → 1 at surface
        const tt = Math.max(0, Math.min(1, tRaw));
        amt = tt * tt * (3 - 2 * tt);               // smoothstep
      }

      let nx = 0, ny = 0;
      if (amt > 0) {
        // Numerical gradient of the SDF == outward normal.
        const e = 1;
        nx = sdRoundRect(px + e, py, W, H, r) - sdRoundRect(px - e, py, W, H, r);
        ny = sdRoundRect(px, py + e, W, H, r) - sdRoundRect(px, py - e, W, H, r);
        const len = Math.hypot(nx, ny) || 1;
        nx /= len; ny /= len;
      }

      // Negated: we want the rim to sample from FURTHER INSIDE the element,
      // which is what makes the edge read as thick glass rather than a smear.
      d[i]     = Math.max(0, Math.min(255, Math.round(128 - nx * amt * 127)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(128 - ny * amt * 127)));
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

// ── The material ──────────────────────────────────────────────
// One surface, four layers.
//
// Each surface measures ITSELF and rasterises its own lens, so the pill and
// the round AI button get displacement maps matching their own geometry.
// (Sharing one map across both shapes was wrong: a pill's normals applied to
// a circle bend light in directions that surface doesn't have.)
export function GlassSurface({
  children, dark, radius = 999, blur = 20, saturate = 180,
  refract = true, refractScale = 16, elevation = "float", style, className, ...rest
}) {
  // useId is unique per instance but contains ':' / '«»', which are not legal
  // in a url(#…) fragment — strip to word chars.
  const filterId = `athlos-lg-${useId().replace(/\W/g, "")}`;
  const hostRef = useRef(null);
  const [box, setBox] = useState(null);

  // ResizeObserver fires once on observe, so it doubles as the initial
  // measurement — no layout-effect setState needed.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setBox((p) => (p && p.w === el.offsetWidth && p.h === el.offsetHeight
        ? p
        : { w: el.offsetWidth, h: el.offsetHeight }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const boxW = box?.w, boxH = box?.h;
  const lens = useMemo(() => {
    if (!refract || !supportsRefraction || !boxW || !boxH) return "";
    const r = typeof radius === "number"
      ? Math.min(radius, Math.min(boxW, boxH) / 2)
      : Math.min(boxW, boxH) / 2;              // "50%" / 999 → fully round
    return buildRefractionMap(boxW, boxH, Math.min(18, boxH * 0.42), r);
  }, [refract, boxW, boxH, radius]);

  const backdrop = `blur(${blur}px) saturate(${saturate}%)` + (lens ? ` url(#${filterId})` : "");

  const shadow = elevation === "none"
    ? "none"
    : dark
      // Two shadows: a tight contact shadow that anchors the pill, and a
      // wide ambient one that gives it height off the page.
      ? "0 2px 6px rgba(0,0,0,0.34), 0 16px 40px rgba(0,0,0,0.44)"
      : "0 2px 6px rgba(16,24,40,0.07), 0 16px 38px rgba(16,24,40,0.14)";

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        position: "relative", borderRadius: radius,
        // `isolation` keeps the layer stack from blending with the page.
        isolation: "isolate", boxShadow: shadow,
        ...style,
      }}
      {...rest}
    >
      {lens && (
        <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
          <defs>
            {/* Oversized region so samples displaced at the rim aren't clipped. */}
            <filter id={filterId} x="-25%" y="-40%" width="150%" height="180%" colorInterpolationFilters="sRGB">
              <feImage href={lens} result="lens" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" />
              <feDisplacementMap in="SourceGraphic" in2="lens" scale={refractScale} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
      )}
      {/* 1 · refracting backdrop */}
      <span aria-hidden="true" style={{
        position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
        backdropFilter: backdrop, WebkitBackdropFilter: backdrop,
      }} />
      {/* 2 · body tint — the glass's own colour, thin enough to stay see-through */}
      <span aria-hidden="true" style={{
        position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
        background: dark ? "rgba(28,28,30,0.42)" : "rgba(255,255,255,0.44)",
      }} />
      {/* 3 · interior sheen — light entering the top face and diffusing down.
             Stops well before the bottom so it reads as depth, not a gradient. */}
      <span aria-hidden="true" style={{
        position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
        background: dark
          ? "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.028) 26%, rgba(255,255,255,0) 55%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.18) 28%, rgba(255,255,255,0) 58%)",
      }} />
      {/* 4 · specular rim — a 1px ring, not a border. Hot along the top edge,
             a weaker bounce along the bottom, almost nothing at the sides:
             the signature of a lit convex edge. */}
      <span aria-hidden="true" style={{
        position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
        padding: 1,
        background: dark
          ? "linear-gradient(180deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.03) 64%, rgba(255,255,255,0.24) 100%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.42) 30%, rgba(16,24,40,0.04) 66%, rgba(255,255,255,0.62) 100%)",
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        maskComposite: "exclude",
      }} />
      <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

// ── Spring ────────────────────────────────────────────────────
// A damped harmonic oscillator integrated with semi-implicit Euler at a
// fixed 120Hz substep, so the motion is frame-rate independent and does not
// change character on a 120Hz display. Slightly underdamped (critical for
// k=260 would be ~32) so the capsule settles with one soft overshoot, the
// way Apple's does.
const STIFFNESS = 260;
const DAMPING = 27;
const SUBSTEP = 1 / 120;

function useCapsuleSpring(target) {
  const [frame, setFrame] = useState(null);
  const cur = useRef(null);
  const vel = useRef({ left: 0, width: 0 });
  const goal = useRef(null);
  const raf = useRef(0);
  const acc = useRef(0);
  const last = useRef(0);
  // Read once per render rather than inside the effect, so it can be a real
  // dependency and the effect never has to setState just to opt out.
  const reduce = prefersReducedMotion();

  useEffect(() => {
    if (!target) return;
    goal.current = target; // written here, never during render
    if (reduce) {
      cur.current = { left: target.left, width: target.width };
      vel.current = { left: 0, width: 0 };
      return;
    }
    // First measurement, or a remount: adopt the target with no animation.
    // No setState needed — the fallback below already renders at `target`.
    if (!cur.current) {
      cur.current = { left: target.left, width: target.width };
      return;
    }

    const tick = (now) => {
      if (!last.current) last.current = now;
      let dt = (now - last.current) / 1000;
      last.current = now;
      dt = Math.min(dt, 0.064); // a backgrounded tab must not explode the integrator
      acc.current += dt;

      const g = goal.current;
      while (acc.current >= SUBSTEP) {
        for (const k of ["left", "width"]) {
          const f = -STIFFNESS * (cur.current[k] - g[k]) - DAMPING * vel.current[k];
          vel.current[k] += f * SUBSTEP;
          cur.current[k] += vel.current[k] * SUBSTEP;
        }
        acc.current -= SUBSTEP;
      }

      const settled =
        Math.abs(cur.current.left - g.left) < 0.08 && Math.abs(vel.current.left) < 0.08 &&
        Math.abs(cur.current.width - g.width) < 0.08 && Math.abs(vel.current.width) < 0.08;

      if (settled) {
        cur.current = { left: g.left, width: g.width };
        vel.current = { left: 0, width: 0 };
        setFrame({ ...cur.current, vx: 0 });
        raf.current = 0;
        last.current = 0;
        return;
      }
      setFrame({ ...cur.current, vx: vel.current.left });
      raf.current = requestAnimationFrame(tick);
    };

    if (!raf.current) {
      last.current = 0;
      acc.current = 0;
      raf.current = requestAnimationFrame(tick);
    }
    return () => {
      if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; }
      last.current = 0;
    };
  }, [target, reduce]);

  // Before the solver has produced a frame — first paint, or reduced motion —
  // render exactly at the target.
  if (reduce || !frame) return target ? { left: target.left, width: target.width, vx: 0 } : null;
  return frame;
}

// ── Nav ───────────────────────────────────────────────────────
// `refract={false}` drops the SDF lens and leaves plain blur + saturate.
// Useful as a one-word bisect if the glass ever misbehaves on a given engine,
// and it is what Safari/Firefox get anyway.
export default function LiquidGlassNav({ tabs, active, badges = {}, dark, onSelect, renderIcon, label, style, refract = true }) {
  const btnRefs = useRef([]);
  const navRef = useRef(null);
  const [target, setTarget] = useState(null); // where the capsule wants to be
  const [pressed, setPressed] = useState(null);

  // Only the capsule geometry is measured here — the lens belongs to
  // GlassSurface, which measures itself.
  const measure = useCallback(() => {
    const i = tabs.findIndex((n) => n.id === active);
    const el = btnRefs.current[i];
    setTarget(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [tabs, active]);

  useLayoutEffect(() => { measure(); }, [measure]);

  // Re-measure on resize / rotation so the capsule tracks the real geometry
  // rather than a stale first paint.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(nav);
    return () => ro.disconnect();
  }, [measure]);

  const frame = useCapsuleSpring(target);

  // Liquid stretch: the capsule elongates toward wherever it is travelling,
  // proportional to live velocity, and relaxes as the spring settles. This is
  // the whole illusion — a rigid box sliding on a spring still reads as a box.
  let capLeft = 0, capWidth = 0;
  if (frame) {
    const v = frame.vx || 0;
    const stretch = Math.min(30, Math.abs(v) * 0.020);
    capLeft = frame.left - (v < 0 ? stretch : 0);
    capWidth = frame.width + stretch;
  }

  return (
    <GlassSurface
      dark={dark}
      radius={999}
      blur={20}
      saturate={180}
      refract={refract}
      style={{ flex: 1, minWidth: 0, padding: 6, ...style }}
    >
        <nav ref={navRef} style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", minWidth: 0 }}>
          {/* Selection capsule — glass inside glass. It carries its own rim and
              sheen so it reads as a lens that has risen out of the bar, not as
              a coloured rectangle painted onto it. */}
          {frame && (
            <span aria-hidden="true" style={{
              position: "absolute", top: 0, bottom: 0,
              left: capLeft, width: capWidth, borderRadius: 999,
              background: dark
                ? "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.07) 48%, rgba(255,255,255,0.045) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.72) 48%, rgba(255,255,255,0.62) 100%)",
              boxShadow: dark
                ? "inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.30), 0 6px 16px rgba(0,0,0,0.24)"
                : "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(16,24,40,0.10), 0 6px 16px rgba(16,24,40,0.10)",
              // No CSS transition — every frame comes from the spring solver.
              willChange: "left, width",
            }} />
          )}

          {tabs.map((n, i) => {
            const on = n.id === active;
            const isPressed = pressed === n.id;
            return (
              <button
                key={n.id}
                // block body: a ref callback must not return a value in
                // React 19 (a returned value is treated as a cleanup fn)
                ref={(el) => { btnRefs.current[i] = el; }}
                onClick={() => onSelect(n.id)}
                onPointerDown={() => setPressed(n.id)}
                onPointerUp={() => setPressed(null)}
                onPointerLeave={() => setPressed(null)}
                onPointerCancel={() => setPressed(null)}
                aria-current={on ? "page" : undefined}
                style={{
                  position: "relative", zIndex: 1, flex: 1, minWidth: 0,
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 3, padding: "8px 0",
                  // Apple presses the CONTENT, not the capsule — the glass
                  // stays put and the glyph recedes into it.
                  transform: isPressed ? "scale(0.92)" : "scale(1)",
                  transition: "transform 0.34s cubic-bezier(0.22,1,0.36,1)",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span aria-hidden="true" style={{
                  display: "flex",
                  transform: on ? "translateY(-0.5px)" : "none",
                  transition: "transform 0.4s cubic-bezier(0.22,1,0.36,1)",
                }}>
                  {renderIcon(n, on, dark)}
                </span>
                {label && (
                  <span style={{
                    fontSize: 9.5, letterSpacing: "-0.005em",
                    fontWeight: on ? 600 : 500,
                    color: on
                      ? (dark ? "#FFFFFF" : "#0F1729")
                      : (dark ? "rgba(255,255,255,0.46)" : "rgba(16,24,40,0.45)"),
                    transition: "color 0.3s ease, font-weight 0.3s ease",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
                  }}>{label(n)}</span>
                )}
                {badges[n.id] > 0 && (
                  <span aria-hidden="true" style={{
                    position: "absolute", top: 4, right: "24%",
                    width: 6, height: 6, borderRadius: "50%", background: "#F87066",
                    boxShadow: dark ? "0 0 0 1.5px rgba(28,28,30,0.9)" : "0 0 0 1.5px rgba(255,255,255,0.95)",
                  }} />
                )}
              </button>
            );
          })}
      </nav>
    </GlassSurface>
  );
}
