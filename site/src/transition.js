// Transitions between scenes (Section 6): unpinned stretches of scroll where
// the palette shifts, sprites or stars appear, and the thread descends.

import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { createThreadSvg, tipAtDepth } from "./thread.js";
import { spriteField, starField } from "./fx.js";
import { TIP_LINE } from "./event.js";
import { seam, swayAll, swayDue } from "./motion.js";

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

  // a lazy S between the two joins, leaving and arriving along each seam's
  // shared direction (seam.*), so it meets its neighbours without an elbow
  scrollThread(el, reduced, (W, H) => {
    const a = seg.xIn * W, b = seg.xOut * W, sw = (seg.xIn < seg.xOut ? -1 : 1) * 0.08 * W;
    const top = seam.top(seg.xIn, W, H), bot = seam.bottom(seg.xOut, W, H);
    const P = [
      [a, 0], top.next,
      [a + (b - a) * 0.35 + sw, 0.4 * H],
      [a + (b - a) * 0.68 - sw, 0.66 * H],
      bot.prev, [b, H],
    ];
    P.head = top.head; P.tail = bot.tail;
    return P;
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
    for (let i = 1; i < keys.length; i++) if (keys[i] <= keys[i - 1]) keys[i] = keys[i - 1] + 0.01;
  }
  measure();

  let prog = 0, time = 0;
  const draw = () => {
    const top = el.getBoundingClientRect().top + window.scrollY; // page position: sway phase
    thread.draw(swayAll(P, top, time), tipAtDepth(keys, prog * H));
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
  if (!reduced) gsap.ticker.add((t) => { time = t; if (visible && swayDue()) draw(); });
  return { refresh() { measure(); draw(); } };
}
