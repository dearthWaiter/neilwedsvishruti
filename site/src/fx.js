// Small ambient effects: falling sprites, twinkling stars, glowing light
// points and meteors. Each runs only while its section is on screen.

import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { setSrc } from "./lazy.js";

const rand = (a, b) => a + Math.random() * (b - a);

// Toggle `on` while `trigger` overlaps the viewport.
export function whileVisible(trigger, on) {
  ScrollTrigger.create({ trigger, start: "top bottom", end: "bottom top", onToggle: (s) => on(s.isActive) });
}

// Falling petals / marigolds (Section 6: 10 to 14 on screen, varied size,
// rotation, speed and sway). Time-driven, positioned in the container's box.
export function spriteField(container, srcs, { count = 12, reduced = false, size = [22, 44] } = {}) {
  const layer = document.createElement("div");
  layer.className = "sprites";
  container.appendChild(layer);
  if (reduced) return { layer, setOpacity() {} }; // 7.3: no falling sprites

  const items = Array.from({ length: count }, (_, i) => {
    const el = document.createElement("img");
    setSrc(el, srcs[i % srcs.length]);
    el.alt = ""; el.decoding = "async";
    const s = rand(size[0], size[1]);
    el.style.width = `${s}px`;
    layer.appendChild(el);
    return {
      el, s,
      x: Math.random(), y: rand(-0.1, 1.05),
      vy: rand(0.035, 0.075) * (1 + (44 - s) / 60), // smaller ones fall a touch faster
      rot: rand(0, 360), vr: rand(-40, 40),
      amp: rand(10, 28), f: rand(0.4, 0.9), ph: rand(0, 6.28),
    };
  });

  let active = false, last = 0;
  const tick = (t) => {
    if (!active) return;
    const dt = Math.min(0.05, t - last); last = t;
    const W = container.clientWidth, H = container.clientHeight;
    for (const p of items) {
      p.y += p.vy * dt * (844 / Math.max(H, 1)) * 1.4; // screen-heights per second, independent of section height
      p.rot += p.vr * dt;
      if (p.y > 1.08) { p.y = -0.06; p.x = Math.random(); }
      const x = p.x * W + Math.sin(t * p.f + p.ph) * p.amp;
      p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${(p.y * H).toFixed(1)}px, 0) rotate(${p.rot.toFixed(1)}deg)`;
    }
  };
  gsap.ticker.add(tick);
  whileVisible(container, (v) => { active = v; last = gsap.ticker.time; });
  return { layer, setOpacity(o) { layer.style.opacity = o; } };
}

// Twinkling stars (CSS opacity animation only, compositor-friendly).
export function starField(container, { count = 70, top = 0, bottom = 1 } = {}) {
  const layer = document.createElement("div");
  layer.className = "stars";
  for (let i = 0; i < count; i++) {
    const d = document.createElement("i");
    const s = Math.random() < 0.15 ? 2.4 : rand(1, 1.8);
    Object.assign(d.style, {
      left: `${rand(0, 100)}%`, top: `${rand(top, bottom) * 100}%`,
      width: `${s}px`, height: `${s}px`,
      animationDuration: `${rand(2.4, 5.5).toFixed(2)}s`,
      animationDelay: `${rand(-5, 0).toFixed(2)}s`,
    });
    layer.appendChild(d);
  }
  container.appendChild(layer);
  whileVisible(container, (v) => layer.classList.toggle("is-live", v));
  return layer;
}

// Soft glowing points on an image plane (fairy lights, diya flames), placed
// in the plane's own u/v fractions so they stay on the lights they mark.
export function glowPoints(plane, pts, { kind = "twinkle", size = 10 } = {}) {
  const layer = document.createElement("div");
  layer.className = `glows glows--${kind}`;
  for (const [u, v, k = 1] of pts) {
    const d = document.createElement("i");
    const s = size * k;
    Object.assign(d.style, {
      left: `${u * 100}%`, top: `${v * 100}%`, width: `${s}px`, height: `${s}px`,
      animationDuration: `${(kind === "flicker" ? rand(0.9, 1.6) : rand(2.2, 4.5)).toFixed(2)}s`,
      animationDelay: `${rand(-4, 0).toFixed(2)}s`,
    });
    layer.appendChild(d);
  }
  plane.appendChild(layer);
  whileVisible(plane.closest(".screen") || plane, (v) => layer.classList.toggle("is-live", v));
  return layer;
}

// An occasional meteor streak across the upper sky: not constant.
export function meteors(container, { reduced = false } = {}) {
  const layer = document.createElement("div");
  layer.className = "meteors";
  container.appendChild(layer);
  if (reduced) return layer;
  let live = false, timer = 0;
  const fire = () => {
    if (!live) return;
    // a rotated rail, with the streak sliding along it
    const rail = document.createElement("div");
    const streak = document.createElement("i");
    rail.appendChild(streak);
    const W = container.clientWidth, H = container.clientHeight;
    const x = rand(0.3, 1.0) * W, y = rand(0.02, 0.28) * H, len = rand(90, 150), ang = rand(145, 162);
    Object.assign(rail.style, { left: `${x}px`, top: `${y}px`, transform: `rotate(${ang}deg)` });
    streak.style.width = `${len}px`;
    layer.appendChild(rail);
    gsap.set(streak, { opacity: 0, x: 0 });
    gsap.to(streak, { x: len * 1.6, duration: 0.8, ease: "power1.in" });
    gsap.to(streak, {
      keyframes: [{ opacity: 1, duration: 0.15 }, { opacity: 1, duration: 0.35 }, { opacity: 0, duration: 0.3 }],
      onComplete: () => rail.remove(),
    });
    timer = setTimeout(fire, rand(3500, 8000));
  };
  whileVisible(container.closest(".screen") || container, (v) => {
    live = v; clearTimeout(timer);
    if (v) timer = setTimeout(fire, rand(1200, 3000));
  });
  return layer;
}
