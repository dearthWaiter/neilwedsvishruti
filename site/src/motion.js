// Shared motion: easing, the idle-sway signal, and time-based reveals.

import gsap from "gsap";
import CustomEase from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);

// A strong ease-out for anything entering or leaving: fast start, soft landing.
export const EASE_OUT = CustomEase.create("uiOut", "0.23,1,0.32,1");

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------------
// Idle sway (5.1: "a subtle idle sway when not scrolling"). While the guest
// scrolls, the thread holds still (and costs nothing); once they stop, the
// sway eases back in over ~0.4s and redraws at 30fps, not 60.
// ---------------------------------------------------------------------------
export const motion = { amp: REDUCED ? 0 : 1, frame: 0 };
let lastScroll = -1e9;
window.addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true });
gsap.ticker.add(() => {
  motion.frame++;
  if (REDUCED) return;
  const idle = performance.now() - lastScroll > 160;
  motion.amp += ((idle ? 1 : 0) - motion.amp) * (idle ? 0.07 : 0.3);
  if (motion.amp < 0.002) motion.amp = 0;
});

// true on the frames the sway should redraw (idle, every other frame)
export const swayDue = () => motion.amp > 0 && motion.frame % 2 === 0;

// The sway offset for a point, phased by its position on the *page*, so the
// two sides of a seam (in different sections) always move together.
export function swayPoint([x, y], pageY, time) {
  const a = motion.amp;
  if (!a) return [x, y];
  return [x + 2 * a * Math.sin(time * 0.7 + pageY * 0.004), y + 1.5 * a * Math.cos(time * 0.55 + pageY * 0.0033)];
}

// sway a whole point list, keeping its phantom ends (P.head / P.tail) in step
// The two end points (on section edges) sway sideways only, never vertically,
// so the seam can't open or overlap.
export function swayAll(P, pageTop, time, keep = () => false) {
  const last = P.length - 1;
  const out = P.map((p, i) => {
    if (keep(i)) return p;
    const q = swayPoint(p, pageTop + p[1], time);
    return i === 0 || i === last ? [q[0], p[1]] : q;
  });
  if (P.head) out.head = keep(-1) ? P.head : swayPoint(P.head, pageTop + P.head[1], time);
  if (P.tail) out.tail = keep(P.length) ? P.tail : swayPoint(P.tail, pageTop + P.tail[1], time);
  return out;
}

// ---------------------------------------------------------------------------
// Seam direction. Every seam between two sections has one shared direction,
// derived from its x alone, so both sections leave/arrive along it: no elbow.
// Returns a unit vector pointing down the page (about 12 degrees off vertical).
// ---------------------------------------------------------------------------
export function seamDir(x) {
  const a = ((x < 0.5 ? 1 : -1) * 12 * Math.PI) / 180;
  return [Math.sin(a), Math.cos(a)];
}

// Phantom points and inner points either side of a seam at (x px, y px).
export const seam = {
  // the point just inside a section's top edge, and its phantom above
  top(xFrac, W, H) {
    const [dx, dy] = seamDir(xFrac), x = xFrac * W;
    return { head: [x - dx * 0.1 * H, -dy * 0.1 * H], next: [x + dx * 0.07 * H, dy * 0.07 * H] };
  },
  // the point just inside a section's bottom edge, and its phantom below
  bottom(xFrac, W, H, y = H) {
    const [dx, dy] = seamDir(xFrac), x = xFrac * W;
    return { prev: [x - dx * 0.07 * H, y - dy * 0.07 * H], tail: [x + dx * 0.1 * H, y + dy * 0.1 * H] };
  },
};

// ---------------------------------------------------------------------------
// Reveal: cards and icons are *triggered* by scroll position, then animate in
// time (not scrubbed), so a card is never left half-faded when the guest's
// thumb stops. Direction-aware: scrolling back up, a card leaves downward.
// ---------------------------------------------------------------------------
export function reveal(el, { drift = 12, kind = "card", delay = 0 } = {}) {
  const d = REDUCED ? 0 : drift;
  let on = false;
  gsap.set(el, kind === "icon" ? { autoAlpha: 0, scale: REDUCED ? 1 : 0.85 } : { autoAlpha: 0, y: d });
  return {
    get on() { return on; },
    set(v, forward = true) {
      if (v === on) return;
      on = v;
      gsap.killTweensOf(el);
      if (kind === "icon") {
        if (v) gsap.fromTo(el, { autoAlpha: 0, scale: REDUCED ? 1 : 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: REDUCED ? "none" : "back.out(1.4)", delay });
        else gsap.to(el, { autoAlpha: 0, scale: REDUCED ? 1 : 0.92, duration: 0.2, ease: EASE_OUT });
        return;
      }
      const s = forward ? 1 : -1;
      if (v) gsap.fromTo(el, { autoAlpha: 0, y: d * s }, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE_OUT, delay });
      else gsap.to(el, { autoAlpha: 0, y: -d * s, duration: 0.3, ease: EASE_OUT });
    },
  };
}

// A value that eases toward a target in time (for the image dim behind cards).
export function follower(el, prop = "opacity") {
  let target = null;
  return (v, duration = 0.5) => {
    if (v === target) return;
    target = v;
    gsap.to(el, { [prop]: v, duration, ease: EASE_OUT, overwrite: true });
  };
}

// Frame-rate-independent smoothing toward a target (touch-jitter filter for
// the camera moves and the thread's tip): time constant ~0.12s.
export function smoothStep(cur, target, dt, tau = 0.12) {
  if (REDUCED) return target;
  const a = 1 - Math.exp(-Math.max(0, dt) / tau);
  const v = cur + (target - cur) * a;
  return Math.abs(target - v) < 1e-4 ? target : v;
}
