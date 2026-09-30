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
// rotation, speed and sway). Each sprite is three nested layers run by the
// browser's own animation engine (WAAPI), so the phone's compositor plays
// them without any per-frame JavaScript: a full-height rail that falls
// (translateY in % of the container), a sway, and a spin.
export function spriteField(container, srcs, { count = 12, reduced = false, size = [22, 44] } = {}) {
  const layer = document.createElement("div");
  layer.className = "sprites";
  container.appendChild(layer);
  if (reduced) return { layer, setOpacity() {} }; // 7.3: no falling sprites

  const Hc = Math.max(1, container.clientHeight || window.innerHeight);
  const anims = [];
  for (let i = 0; i < count; i++) {
    const s = rand(size[0], size[1]);
    const rail = document.createElement("div");
    rail.className = "spr";
    rail.style.left = `${rand(0, 100).toFixed(1)}%`;
    const el = document.createElement("img");
    setSrc(el, srcs[i % srcs.length]);
    el.alt = ""; el.decoding = "async";
    el.style.width = `${s}px`;
    rail.appendChild(el); layer.appendChild(rail);

    // screen-heights per second, as before; smaller ones fall a touch faster
    const pxps = rand(0.035, 0.075) * (1 + (44 - s) / 60) * 1.4 * 844;
    const fall = (1.16 * Hc) / pxps * 1000;
    // the sway and the slow spin share one animation: out, back, out again,
    // turning a little further each way (one keyframed loop, eased per step)
    const amp = rand(10, 28), swayMs = rand(3.5, 7.8) * 1000, r0 = rand(0, 360), spin = rand(-40, 40) * (swayMs / 1000);
    const sw = (x, r) => ({ transform: `translateX(${x}px) rotate(${r.toFixed(1)}deg)`, easing: "ease-in-out" });
    anims.push(
      rail.animate([{ transform: "translateY(-8%)" }, { transform: "translateY(108%)" }],
        { duration: fall, iterations: Infinity, easing: "linear", delay: -rand(0, fall) }),
      el.animate([sw(-amp, r0), sw(amp, r0 + spin / 2), sw(-amp, r0 + spin)],
        { duration: swayMs, iterations: Infinity, delay: -rand(0, swayMs) }),
    );
  }
  const run = (v) => anims.forEach((a) => (v ? a.play() : a.pause()));
  run(false);
  whileVisible(container, run);
  return { layer, setOpacity(o) { layer.style.opacity = o; } };
}

// Twinkling stars (CSS opacity animation only, compositor-friendly).
// { manual: true }: the caller switches the twinkle on (class "is-live").
export function starField(container, { count = 70, top = 0, bottom = 1, manual = false } = {}) {
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
  if (!manual) whileVisible(container, (v) => layer.classList.toggle("is-live", v));
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
