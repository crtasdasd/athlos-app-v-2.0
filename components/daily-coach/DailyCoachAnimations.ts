// ATHLOS — Daily Coach animations.
//
// GSAP only (already a dependency, used for every other entrance animation
// in this app — see ScreenToday.jsx's own stagger effect) — no new library.
// Every helper here respects prefers-reduced-motion, same convention as the
// rest of ATHLOS: reduced motion means content appears instantly, not that
// it's skipped.

import gsap from "gsap";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Card fade + lift in, then paragraphs stagger in one after another —
// mirrors the [data-rise] stagger pattern used across ScreenToday.jsx.
export function animateDailyCoachIn(cardEl: HTMLElement | null, paragraphEls: HTMLElement[]) {
  if (!cardEl) return () => {};
  if (prefersReducedMotion()) {
    gsap.set(cardEl, { opacity: 1, y: 0 });
    gsap.set(paragraphEls, { opacity: 1, y: 0 });
    return () => {};
  }
  const tl = gsap.timeline();
  tl.fromTo(cardEl, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" });
  if (paragraphEls.length) {
    tl.fromTo(
      paragraphEls,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power3.out", stagger: 0.12 },
      "-=0.2"
    );
  }
  return () => tl.kill();
}

// Optional lightweight typewriter for the title only (per spec: optional).
// Skips outright under reduced motion — the title just appears with the rest.
export function typewriterTitle(el: HTMLElement | null, text: string, speed = 18) {
  if (!el) return () => {};
  if (prefersReducedMotion()) {
    el.textContent = text;
    return () => {};
  }
  el.textContent = "";
  let i = 0;
  const id = window.setInterval(() => {
    i += 1;
    el.textContent = text.slice(0, i);
    if (i >= text.length) window.clearInterval(id);
  }, speed);
  return () => window.clearInterval(id);
}
