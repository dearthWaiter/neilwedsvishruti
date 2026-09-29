// Screens 3 to 6: one pattern, four events (Section 6).
//
// Part A: the plate and couple with gentle parallax, and the event card.
// Part B: the couple fades, the plate dims and softens, and the icons appear
// one by one along the thread, which weaves through them like a progress bar,
// then the details card.
//
// Layout: the backgrounds stay pinned while a tall "track" holding the
// thread, icons and cards slides up through the frame. The thread's drawn tip
// sits a fixed distance down the screen (TIP_LINE), so it is always "where the
// story is", and each icon pops in just as the tip reaches it.

import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { createThreadSvg, coverBox, pathRange, tipAtDepth } from "./thread.js";
import { spriteField, glowPoints, meteors } from "./fx.js";
import LIGHTS from "./lights.json";
import { setSrc } from "./lazy.js";

export const TIP_LINE = 0.72; // the tip travels at 72% of the screen height

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`;

export function buildEvent(stage, manifest, { reduced }, ev, seg) {
  const file = (k) => manifest[k] && `/${manifest[k].file}`;
  const pinVh = seg.vh - 100;
  const n = ev.icons.length;

  stage.classList.add("stage--event", `stage--${seg.id}`, `acc--${ev.accent}`);
  const cardCls = `card card--${ev.variant}`;
  stage.innerHTML = `
    <div class="plane plane--plate"><img alt="" decoding="async"></div>
    <div class="plane plane--couple"><img alt="" decoding="async"></div>
    <div class="plane plane--blur"><img alt="" decoding="async"></div>
    ${ev.topShade ? `<div class="topshade"></div>` : ""}
    <div class="edge edge--top" style="--c:${seg.top}"></div>
    <div class="edge edge--bottom" style="--c:${seg.bottom}"></div>
    <div class="dim"></div>
    <div class="track">
      <div class="thread-back"></div>
      <div class="icons"></div>
      <div class="thread-front"></div>
      <div class="${cardCls} ev-card ev-card--main">
        <h2 class="title">${ev.title}</h2>
        <div class="divider"></div>
        <p class="line"><span class="label">Theme ·</span> ${ev.theme}</p>
        <p class="beat">${ev.story}</p>
        <p class="line"><span class="label">To wear ·</span> ${ev.wear}</p>
      </div>
      <div class="${cardCls} ev-card ev-card--details">
        <p class="date">${ev.date}</p>
        <p>${ev.time}</p>
        <p class="venue">${ev.venue}<br><span class="addr">${ev.address}</span></p>
        <a class="btn btn--outline btn--dir" href="${ev.link}" target="_blank" rel="noopener">${PIN}<span>Get directions</span></a>
      </div>
    </div>
  `;
  const $ = (s) => stage.querySelector(s);
  const plate = $(".plane--plate"), couple = $(".plane--couple"), blur = $(".plane--blur");
  const track = $(".track"), dim = $(".dim");
  const mainCard = $(".ev-card--main"), details = $(".ev-card--details");
  const topShade = $(".topshade"), edgeTop = $(".edge--top"), edgeBottom = $(".edge--bottom");

  // images: plate (srcset), couple cutout at its source box, blurred plate
  {
    const a = manifest[`${ev.plate}@750`], b = manifest[`${ev.plate}@1080`], im = plate.querySelector("img");
    setSrc(im, `/${b.file}`, `/${a.file} 750w, /${b.file} 1080w`, "(min-width: 600px) 640px, 150vw");
    setSrc(blur.querySelector("img"), file(`${ev.plate}_blur`));
    const c = manifest[ev.couple], bx = c.srcBox, ci = couple.querySelector("img");
    setSrc(ci, file(ev.couple));
    Object.assign(ci.style, {
      left: `${(bx.minx / bx.imgW) * 100}%`, top: `${(bx.miny / bx.imgH) * 100}%`,
      width: `${((bx.maxx - bx.minx + 1) / bx.imgW) * 100}%`,
    });
  }
  const bx = manifest[ev.couple].srcBox;
  const focusU = (bx.minx + bx.maxx) / 2 / bx.imgW; // centre the crop on the couple

  if (ev.lights) glowPoints(plate, LIGHTS[ev.lights], { kind: "twinkle", size: 9 });
  if (ev.diyas) glowPoints(plate, LIGHTS[ev.diyas], { kind: "flicker", size: 30 });
  if (ev.meteors) meteors(stage, { reduced });
  let sprites = null;
  if (ev.sprites) {
    const keys = Object.keys(manifest).filter((k) => k.startsWith(ev.sprites + "_"));
    sprites = spriteField(stage, keys.map(file), { count: 12, reduced });
    sprites.layer.classList.add("sprites--stage");
  }

  // icons
  const iconBox = $(".icons");
  const icons = ev.icons.map((k, i) => {
    const el = document.createElement("img");
    el.className = "ev-icon";
    setSrc(el, file(k)); el.alt = ""; el.decoding = "async";
    el.dataset.front = i % 2 === 0 ? "1" : "0"; // weave: in front of some, behind others
    iconBox.appendChild(el);
    return el;
  });

  const back = createThreadSvg($(".thread-back"));
  const front = createThreadSvg($(".thread-front"));

  // ---- layout (all in stage px; recomputed on resize) -----------------------
  let W, H, L; // L = layout
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    const box = coverBox(W, H);
    box.x = Math.min(0, Math.max(W - box.w, W / 2 - focusU * box.w));
    for (const el of [plate, couple, blur]) {
      Object.assign(el.style, { width: `${box.w}px`, height: `${box.h}px`, left: `${box.x}px`, top: `${box.y}px` });
    }

    const size = Math.min(W * 0.4, 170);
    const gap = 0.22 * H;
    const y0 = 1.06 * H;
    const iconPos = icons.map((el, i) => {
      const x = (i % 2 === 0 ? 0.3 : 0.7) * W, y = y0 + i * gap;
      Object.assign(el.style, { width: `${size}px`, height: `${size}px`, left: `${x - size / 2}px`, top: `${y - size / 2}px` });
      return [x, y];
    });
    mainCard.style.top = `${0.13 * H}px`;
    const dTop = iconPos[n - 1][1] + size / 2 + 0.1 * H;
    details.style.top = `${dTop}px`;
    const dH = details.offsetHeight;
    const trackH = Math.max(dTop + dH + 0.3 * H, 2 * H);
    track.style.height = `${trackH}px`;
    for (const t of [back, front]) t.svg.setAttribute("viewBox", `0 0 ${W} ${trackH}`);

    // the thread's route: [x, y, flags]; y doubles as the tip's depth key
    const xIn = seg.xIn * W, xOut = seg.xOut * W;
    const side = seg.xIn < 0.5 ? 0.09 : 0.91;
    const R = [
      [xIn, 0, "end"],
      [xIn + (side < 0.5 ? -12 : 12), 0.2 * H],
      [side * W, 0.48 * H],
      [side * W, 0.76 * H],
      [lerpX(side * W, iconPos[0][0], 0.6), 0.93 * H],
    ];
    const iconIdx = [];
    iconPos.forEach(([x, y], i) => {
      iconIdx.push(R.length);
      R.push([x, y, "icon"]);
      if (i === ev.kalava) {
        // a kalava: a couple of snug wraps, wrist-width, just past the icon
        const cx = x + (i % 2 === 0 ? 1 : -1) * size * 0.42, cy = y + size * 0.42;
        const rx = 17, ry = 5.5, turns = 2, N = 9 * turns;
        for (let k = 0; k <= N; k++) {
          const a = (k / 9) * Math.PI * 2 + Math.PI;
          R.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry + k * 0.45, "loop"]);
        }
      }
      if (i < n - 1) {
        // a gentle bow between icons, so the run never looks ruled
        const [nx, ny] = iconPos[i + 1];
        R.push([(x + nx) / 2 + (i % 2 ? 1 : -1) * 0.06 * W, (y + ny) / 2]);
      }
    });
    const [lx, ly] = iconPos[n - 1];
    R.push([lerpX(lx, W / 2, 0.5), ly + size * 0.5 + 0.05 * H]);
    R.push([W * (seg.xOut < 0.5 ? 0.3 : 0.7), dTop + dH * 0.5]); // behind the details card
    R.push([xOut, trackH - 0.12 * H]);
    R.push([xOut, trackH, "end"]);

    // depth keys: loop points share the key of the point before them
    const keys = [];
    R.forEach((p, i) => keys.push(p[2] === "loop" ? keys[i - 1] ?? p[1] : Math.max(p[1], keys[i - 1] ?? 0)));

    L = { R, keys, iconPos, iconIdx, size, dTop, trackH, tyEnd: trackH - H,
          loopY: ev.kalava != null ? keys[iconIdx[ev.kalava] + 1] : null };
  }
  const lerpX = (a, b, t) => a + (b - a) * t;

  // ---- state + render ---------------------------------------------------------
  const st = { entry: 0, tipA: 0, ty: 0, drift: 0, couple: 1, soft: 0, kalava: 1 };
  let time = 0;

  function tipY() {
    const byTrack = st.ty + TIP_LINE * H + Math.max(0, st.ty - (L.tyEnd - (1 - TIP_LINE) * H));
    return Math.max(st.entry * TIP_LINE * H, st.tipA * H, st.ty > 0 ? byTrack : 0);
  }

  function points() {
    return L.R.map(([x, y, fl], i) => {
      if (reduced || fl === "end" || fl === "loop") return [x, y];
      return [x + 2 * Math.sin(time * 0.7 + i * 1.3), y + 1.5 * Math.cos(time * 0.55 + i)];
    });
  }

  function drawThread() {
    const P = points();
    let y = tipY();
    // hold the tip at the kalava while it wraps
    if (L.loopY != null && st.kalava < 1) y = Math.min(y, L.loopY);
    const tip = tipAtDepth(L.keys, y, st.kalava);
    back.draw(P, tip);
    // weave: redraw the stretch across every "front" icon above the icons
    let d = "";
    L.iconIdx.forEach((idx, i) => {
      if (icons[i].dataset.front === "1" && tip > idx - 0.55) d += pathRange(P, idx - 0.55, Math.min(tip, idx + 0.55));
    });
    front.setD(d);
    return y;
  }

  const M = reduced ? 0 : 1; // reduced motion (7.3): no parallax, pops or drifts
  function render() {
    // Part A parallax: the couple moves a little more than the plate
    plate.style.transform = `translate3d(0, ${(-0.015 * H * st.drift * M).toFixed(1)}px, 0)`;
    couple.style.transform = `translate3d(0, ${(-0.045 * H * st.drift * M).toFixed(1)}px, 0) scale(${(1 + 0.02 * st.drift * M).toFixed(4)})`;
    couple.style.opacity = st.couple.toFixed(3);
    blur.style.opacity = st.soft.toFixed(3);
    if (sprites) sprites.setOpacity((1 - st.soft).toFixed(3)); // gone in Part B: faint sprites read as smudges
    track.style.transform = `translate3d(0, ${(-st.ty).toFixed(1)}px, 0)`;

    const y = drawThread();
    // icons pop in (0.85 -> 1, with a fade) just as the tip reaches them
    icons.forEach((el, i) => {
      const p = clamp01((y - (L.iconPos[i][1] - L.size * 0.35)) / (0.07 * H));
      const e = gsap.parseEase("back.out(2)")(p);
      el.style.opacity = p.toFixed(3);
      el.style.transform = `scale(${(1 - M * 0.15 * (1 - e)).toFixed(4)})`;
      el.style.visibility = p > 0 ? "inherit" : "hidden";
    });
    const pd = clamp01((y - (L.dTop - 0.04 * H)) / (0.1 * H));
    details.style.opacity = pd.toFixed(3);
    details.style.visibility = pd > 0 ? "inherit" : "hidden";
    details.style.transform = `translate3d(0, ${(12 * M * (1 - pd)).toFixed(1)}px, 0)`;
  }

  // ---- timeline (vh of scroll across the pin) ----------------------------------
  measure();
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: render });
  // Part A
  tl.to(edgeTop, { opacity: 0, duration: 30 }, 0);
  tl.to(st, { drift: 1, duration: 100 }, 0);
  tl.to(st, { tipA: 0.98, duration: 70, ease: "power1.inOut" }, 22);
  tl.fromTo(mainCard, { autoAlpha: 0, y: 12 * M }, { autoAlpha: 1, y: 0, duration: 18, ease: "power1.out" }, 10);
  tl.to(dim, { opacity: 0.25, duration: 18 }, 10);
  if (topShade) tl.fromTo(topShade, { opacity: 0 }, { opacity: 1, duration: 18 }, 10);
  tl.to(mainCard, { autoAlpha: 0, y: -12 * M, duration: 18, ease: "power1.in" }, 80);
  if (topShade) tl.to(topShade, { opacity: 0, duration: 18 }, 80);
  // into Part B: the couple fades, the plate dims and softens
  tl.to(st, { couple: 0, duration: 26, ease: "power1.inOut" }, 90);
  tl.to(st, { soft: 1, duration: 30, ease: "power1.inOut" }, 92);
  tl.to(dim, { opacity: 0.3, duration: 30 }, 92);
  // Part B: the track rises; for the Wedding it pauses while the kalava wraps
  const bStart = 104, bEnd = pinVh - 6;
  const tyTo = (v) => () => (v === "end" ? L.tyEnd : v());
  if (ev.kalava != null) {
    const hold = 24;
    const tyHold = () => L.loopY - TIP_LINE * H;
    const span = bEnd - bStart - hold;
    const f = tyHold() / L.tyEnd; // share of the rise before the hold (proportions hold across screen sizes)
    tl.set(st, { kalava: 0 }, bStart);
    tl.to(st, { ty: tyTo(tyHold), duration: span * f }, bStart);
    tl.to(st, { kalava: 1, duration: hold, ease: "power1.inOut" }, bStart + span * f);
    tl.to(st, { ty: tyTo("end"), duration: span * (1 - f) }, bStart + span * f + hold);
  } else {
    tl.to(st, { ty: tyTo("end"), duration: bEnd - bStart }, bStart);
  }
  tl.to(edgeBottom, { opacity: 1, duration: 36 }, pinVh - 36);
  tl.to({}, { duration: 1 }, pinVh - 1); // pad to exactly the pin length

  // the stretch before the pin: the tip follows TIP_LINE as the stage rises
  ScrollTrigger.create({
    trigger: stage.parentElement,
    start: `top ${TIP_LINE * 100}%`,
    end: "top top",
    onUpdate: (s) => { st.entry = s.progress; render(); },
  });

  let visible = false;
  ScrollTrigger.create({
    trigger: stage.parentElement, start: "top bottom", end: "bottom top",
    onToggle: (s) => { visible = s.isActive; },
  });
  if (!reduced) gsap.ticker.add((t) => { time = t; if (visible) drawThread(); });
  render();

  return {
    tl,
    refresh() { measure(); tl.invalidate(); render(); },
  };
}
