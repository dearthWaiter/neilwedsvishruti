// Transitions between scenes (Section 6): unpinned stretches of scroll where
// the palette shifts, sprites or stars appear, and the thread descends.

import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { createThreadSvg, tipAtDepth } from "./thread.js";
import { spriteField, starField } from "./fx.js";
import { TIP_LINE } from "./event.js";

export function buildTransition(el, manifest, { reduced }, seg) {
  el.classList.add("transition", `transition--${seg.id}`);
  el.style.height = `calc(var(--u) * ${seg.vh})`;
  el.style.background = `linear-gradient(180deg, ${seg.stops.join(", ")})`;

  let stars = null;
  if (seg.stars) {
    stars = starField(el, { count: 60, top: 0.02, bottom: 0.98 });
    stars.style.opacity = seg.stars === "out" ? 1 : 0;
  }
  if (seg.sprites) {
    const keys = Object.keys(manifest).filter((k) => k.startsWith(seg.sprites + "_"));
    spriteField(el, keys.map((k) => `/${manifest[k].file}`), { count: 12, reduced });
  }

  // a lazy S between the two joins, leaving and arriving vertically
  scrollThread(el, reduced, (W, H) => {
    const a = seg.xIn * W, b = seg.xOut * W, sw = (seg.xIn < seg.xOut ? -1 : 1) * 0.1 * W;
    return [
      [a, 0], [a, 0.1 * H],
      [a + (b - a) * 0.3 + sw, 0.38 * H],
      [a + (b - a) * 0.7 - sw, 0.64 * H],
      [b, 0.9 * H], [b, H],
    ];
  });

  if (stars) {
    ScrollTrigger.create({
      trigger: el, start: "top bottom", end: "bottom top",
      onUpdate: (s) => {
        const p = s.progress;
        stars.style.opacity = seg.stars === "out" ? 1 - p * 1.4 : seg.stars === "late" ? (p - 0.45) * 2 : p * 1.3;
      },
    });
  }
}

// A thread in an unpinned section, drawn down to wherever TIP_LINE crosses it.
// `route(W, H)` gives its points top to bottom (their y is the depth key); the
// first and last two stay still so the joins with neighbours never sway.
export function scrollThread(el, reduced, route, { z = 2 } = {}) {
  const slot = document.createElement("div");
  slot.className = "thread-slot";
  slot.style.zIndex = z;
  el.appendChild(slot);
  const thread = createThreadSvg(slot);

  let W, H, P, keys;
  function measure() {
    W = el.clientWidth; H = el.clientHeight;
    thread.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    P = route(W, H);
    keys = P.map((p, i) => Math.max(p[1], i ? P[i - 1][1] : 0));
  }
  measure();

  let prog = 0, time = 0;
  const draw = () => {
    const pts = P.map(([x, y], i) => (reduced || i < 2 || i > P.length - 3) ? [x, y]
      : [x + 2 * Math.sin(time * 0.7 + i * 1.3), y + 1.5 * Math.cos(time * 0.55 + i)]);
    thread.draw(pts, tipAtDepth(keys, prog * H));
  };

  ScrollTrigger.create({
    trigger: el,
    start: `top ${TIP_LINE * 100}%`,
    end: `bottom ${TIP_LINE * 100}%`,
    onUpdate: (s) => { prog = s.progress; draw(); },
    onRefresh: () => { measure(); draw(); },
  });
  let visible = false;
  ScrollTrigger.create({ trigger: el, start: "top bottom", end: "bottom top", onToggle: (s) => { visible = s.isActive; } });
  if (!reduced) gsap.ticker.add((t) => { time = t; if (visible) draw(); });
  return { refresh() { measure(); draw(); } };
}
