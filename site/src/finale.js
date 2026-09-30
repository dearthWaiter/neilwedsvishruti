// Screens 7 and 8 (Section 6): Prayagraj, and the closing knot.

import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import {
  createThreadSvg, coverBox, planeToScreen, anchorTransform, PINKY_ANCHOR,
  tipAtDepth, lerp, lerpPt,
} from "./thread.js";
import { glowPoints } from "./fx.js";
import { TIP_LINE } from "./event.js";
import LIGHTS from "./lights.json";
import { setSrc } from "./lazy.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const sway = (P, time, reduced, keep) => (reduced ? P : P.map(([x, y], i) =>
  keep(i) ? [x, y] : [x + 2 * Math.sin(time * 0.7 + i * 1.3), y + 1.5 * Math.cos(time * 0.55 + i)]));

function srcsetImg(im, manifest, key) {
  const a = manifest[`${key}@750`], b = manifest[`${key}@1080`];
  setSrc(im, `/${b.file}`, `/${a.file} 750w, /${b.file} 1080w`, "(min-width: 600px) 640px, 150vw");
}

// the couple in s7, centred in the crop
const S7_FOCUS_U = 0.51;
function focusBox(W, H, u = S7_FOCUS_U) {
  const box = coverBox(W, H);
  box.x = Math.min(0, Math.max(W - box.w, W / 2 - u * box.w));
  return box;
}
const place = (el, box) => Object.assign(el.style, { width: `${box.w}px`, height: `${box.h}px`, left: `${box.x}px`, top: `${box.y}px` });

// Keep a card's beats in a timeline: fade in with a 12px rise, out the same way.
// (reduced motion: a plain crossfade, no drift)
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function beat(tl, el, dim, inAt, outAt) {
  const D = REDUCED ? 0 : 12;
  tl.fromTo(el, { autoAlpha: 0, y: D }, { autoAlpha: 1, y: 0, duration: 18, ease: "power1.out" }, inAt);
  tl.to(dim, { opacity: 0.25, duration: 18 }, inAt);
  if (outAt != null) {
    tl.to(el, { autoAlpha: 0, y: -D, duration: 18, ease: "power1.in" }, outAt);
    tl.to(dim, { opacity: 0, duration: 18 }, outAt);
  }
}

// ===========================================================================
// Screen 7 · Prayagraj: three beats over the Sangam, the river shimmering
// ===========================================================================
export function buildPrayagraj(stage, manifest, { reduced }, seg) {
  const pinVh = seg.vh - 100;
  stage.classList.add("stage--event", "stage--s7");
  stage.innerHTML = `
    <div class="plane plane--plate"><img alt="" decoding="async"></div>
    <div class="plane plane--couple"><img alt="" decoding="async"></div>
    <div class="plane plane--blur"><img alt="" decoding="async"></div>
    <div class="edge edge--top" style="--c:${seg.top}"></div>
    <div class="edge edge--bottom" style="--c:${seg.bottom}"></div>
    <div class="dim"></div>
    <div class="thread-slot"></div>
    <div class="card card--light beat-card"><p class="beat">In Prayagraj, three rivers meet at the Sangam.</p></div>
    <div class="card card--light beat-card"><p class="beat">The third, Saraswati, flows unseen. A little like a certain red thread.</p></div>
    <div class="card card--light beat-card"><p class="beat">Where rivers become one, so will two families.</p></div>
  `;
  const $ = (s) => stage.querySelector(s);
  const plate = $(".plane--plate"), couple = $(".plane--couple"), blur = $(".plane--blur"), dim = $(".dim");
  srcsetImg(plate.querySelector("img"), manifest, "s7_plate");
  setSrc(blur.querySelector("img"), `/${manifest.s7_master_blur.file}`);
  const c = manifest.s7_couple, bx = c.srcBox, ci = couple.querySelector("img");
  setSrc(ci, `/${c.file}`);
  Object.assign(ci.style, {
    left: `${(bx.minx / bx.imgW) * 100}%`, top: `${(bx.miny / bx.imgH) * 100}%`,
    width: `${((bx.maxx - bx.minx + 1) / bx.imgW) * 100}%`,
  });

  // the water shimmer: sun glints measured on the plate, plus softer sparkles
  // scattered over the river (and nowhere else)
  const river = [[0.30, 0.445], [1, 0.435], [1, 0.72], [0.08, 0.7], [0, 0.69], [0, 0.535], [0.38, 0.49]];
  const inRiver = (u, v) => {
    let inside = false;
    for (let i = 0, j = river.length - 1; i < river.length; j = i++) {
      const [xi, yi] = river[i], [xj, yj] = river[j];
      if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const scatter = [];
  while (scatter.length < 34) {
    const u = Math.random(), v = 0.44 + Math.random() * 0.28;
    if (inRiver(u, v)) scatter.push([u, v, 0.5]);
  }
  glowPoints(plate, [...LIGHTS.s7.map(([u, v]) => [u, v, 1]), ...scatter], { kind: "sparkle", size: 10 });

  const beats = [...stage.querySelectorAll(".beat-card")];
  const thread = createThreadSvg($(".thread-slot"));

  let W, H, R, keys;
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    const box = focusBox(W, H);
    for (const el of [plate, couple, blur]) place(el, box);
    thread.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    // in from the top, behind the beats, then down over the river on the
    // right (clear of the couple), toward the water, and on to the RSVP
    R = [
      [seg.xIn * W, 0], [seg.xIn * W, 0.1 * H], [0.62 * W, 0.3 * H],
      [0.88 * W, 0.47 * H], [0.92 * W, 0.64 * H], [0.87 * W, 0.84 * H],
      [seg.xOut * W, 0.93 * H], [seg.xOut * W, H],
    ];
    keys = R.map((p) => p[1]);
  }

  const st = { entry: 0, tipA: 0, drift: 0, soft: 0 };
  let time = 0;
  const tipY = () => Math.max(st.entry * TIP_LINE * H, st.tipA * H);
  function drawThread() {
    thread.draw(sway(R, time, reduced, (i) => i < 2 || i > R.length - 3), tipAtDepth(keys, tipY()));
  }
  function render() {
    const d = reduced ? 0 : st.drift; // reduced motion: no parallax
    plate.style.transform = `translate3d(0, ${(-0.015 * H * d).toFixed(1)}px, 0)`;
    couple.style.transform = `translate3d(0, ${(-0.04 * H * d).toFixed(1)}px, 0) scale(${(1 + 0.02 * d).toFixed(4)})`;
    blur.style.opacity = st.soft.toFixed(3);
    drawThread();
  }

  measure();
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: render });
  tl.to($(".edge--top"), { opacity: 0, duration: 30 }, 0);
  tl.to(st, { drift: 1, duration: pinVh }, 0);
  tl.to(st, { tipA: 1, duration: 150, ease: "power1.inOut" }, 20);
  beat(tl, beats[0], dim, 12, 52);
  beat(tl, beats[1], dim, 66, 110);
  beat(tl, beats[2], dim, 124, 164);
  // soften toward the RSVP, whose backdrop is this same scene, blurred
  tl.to(st, { soft: 1, duration: 30, ease: "power1.inOut" }, pinVh - 40);
  tl.to(dim, { opacity: 0.3, duration: 30 }, pinVh - 40);
  tl.to($(".edge--bottom"), { opacity: 1, duration: 30 }, pinVh - 30);
  tl.to({}, { duration: 1 }, pinVh - 1);

  ScrollTrigger.create({
    trigger: stage.parentElement, start: `top ${TIP_LINE * 100}%`, end: "top top",
    onUpdate: (s) => { st.entry = s.progress; render(); },
  });
  let visible = false;
  ScrollTrigger.create({ trigger: stage.parentElement, start: "top bottom", end: "bottom top", onToggle: (s) => { visible = s.isActive; } });
  if (!reduced) gsap.ticker.add((t) => { time = t; if (visible) drawThread(); });
  render();
  return { tl, refresh() { measure(); render(); } };
}

// ===========================================================================
// Screen 8 · Closing: the push into the couple, and the knot
// ===========================================================================

// s8_hands, measured on the 1080x1620 export. Left hand (sherwani cuff) is his.
const HX = (x) => x / 1080, HY = (y) => y / 1620;
const HIS  = { c: [HX(478), HY(858)], dir: [0.63, 0.78], half: 17 / 1080 };   // middle of his little finger
const HERS = { c: [HX(590), HY(868)], dir: [-0.78, 0.62], half: 16 / 1080 };  // middle of hers
const KNOT = [HX(531), HY(884)];  // in the gap between the two fingers, above the tips
const HANDS_SCALE = 1.45;
// where their hands meet in s7_master (hidden between them): the zoom target
const S7_HANDS = [0.415, 0.71];
const LOOP_N = 8;
const BRIDGE_N = 8;

export function buildClosing(stage, manifest, { reduced }, seg, { onWatchAgain }) {
  const pinVh = seg.vh - 100;
  stage.classList.add("stage--event", "stage--s8");
  stage.innerHTML = `
    <div class="plane plane--plate"><img alt="" decoding="async"></div>
    <div class="plane plane--hands"><img alt="" decoding="async"></div>
    <div class="edge edge--top" style="--c:${seg.top}"></div>
    <div class="dim"></div>
    <div class="knot-glow"></div>
    <div class="thread-slot"></div>
    <div class="card card--light beat-card"><p class="beat">We hope to see you there.</p></div>
    <div class="card card--light beat-card closing-card acc--rsvp">
      <p class="beat">With love,</p>
      <p class="families">The Sarkar &amp; Srivastava families</p>
      <p class="small">With best compliments from little Rumi &amp; Samriddhi</p>
      <div class="divider"></div>
      <p class="small">For any queries</p>
      <p class="contact">Atul Srivastava · <a href="tel:+919415270027">+91 94152 70027</a></p>
      <p class="contact">Natasha Sarkar · <a href="tel:+918744850939">+91 87448 50939</a></p>
      <p class="sign"><span class="sig-names">Neil &amp; Vishruti</span> · 21.11.2026</p>
      <button class="btn btn--outline btn--again" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg><span>Watch again</span></button>
    </div>
  `;
  const $ = (s) => stage.querySelector(s);
  const master = $(".plane--plate"), hands = $(".plane--hands"), dim = $(".dim"), glow = $(".knot-glow");
  srcsetImg(master.querySelector("img"), manifest, "s7_master");
  srcsetImg(hands.querySelector("img"), manifest, "s8_hands");
  const [beat1, closing] = stage.querySelectorAll(".beat-card");
  $(".btn--again").addEventListener("click", onWatchAgain);
  const thread = createThreadSvg($(".thread-slot"));

  let W, H, box, mbox;
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    box = coverBox(W, H);
    mbox = focusBox(W, H);
    place(master, mbox);
    place(hands, box);
    thread.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  }

  const st = {
    entry: 0, tipA: 0, zoom: 0, hands: 0,
    tip: 0,      // point-index tip, once the thread is among the hands
    loose: 1.35, // loop slack (1 = snug)
    knot: 0,     // 0 = slack between the fingers, 1 = drawn into a knot
  };
  let time = 0;

  // master: pushes into the couple's hands, drifting them onto the anchor
  const masterT = () => {
    const hx = mbox.x + S7_HANDS[0] * mbox.w, hy = mbox.y + S7_HANDS[1] * mbox.h;
    const z = reduced ? 0 : st.zoom; // reduced motion: no push-in, just the crossfade
    return { tx: (PINKY_ANCHOR[0] * W - hx) * z, ty: (PINKY_ANCHOR[1] * H - hy) * z,
             s: 1 + 0.6 * z, ou: S7_HANDS[0], ov: S7_HANDS[1] };
  };
  const handsT = () => {
    const t = anchorTransform(box, W, H, HIS.c[0], HIS.c[1], HANDS_SCALE, PINKY_ANCHOR[0] * W, PINKY_ANCHOR[1] * H);
    if (!reduced) t.s *= 1 + 0.06 * (1 - st.hands); // a last touch of push as it crossfades in
    return t;
  };

  // loop points around a finger, as image offsets
  const loop = (f, looseK, pull) => {
    const [dx, dy] = f.dir, px = dy, py = -dx;
    const r = f.half * looseK, m = r * 0.32;
    // `pull` slides the loop a little toward the knot as it draws tight
    const cx = f.c[0] + (KNOT[0] - f.c[0]) * 0.12 * pull, cy = f.c[1] + (KNOT[1] - f.c[1]) * 0.12 * pull;
    const pts = [];
    for (let i = 0; i < LOOP_N; i++) {
      const a = (i / LOOP_N) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r * px + Math.sin(a) * m * dx, cy + (Math.cos(a) * r * py + Math.sin(a) * m * dy) * (2 / 3)]);
    }
    return pts;
  };

  // The thread, from the top of the frame, down to his little finger (tied
  // there since Screen 1), across to hers, looped, and drawn into a knot.
  // Returns [points, index of his loop start, bridge start, her loop start, end].
  function points() {
    const h = st.hands;
    const mT = masterT(), hT = handsT();
    const onM = (u, v) => planeToScreen(mbox, u, v, mT);
    const onH = (u, v) => planeToScreen(box, u, v, hT);
    const hm = onM(...S7_HANDS);
    const both = (p) => lerpPt(hm, onH(...p), h);

    const P = [[seg.xIn * W, 0], [seg.xIn * W, 0.1 * H]];
    const his = both(HIS.c);
    P.push([lerp(seg.xIn * W, his[0], 0.35), 0.3 * H]);
    P.push([lerp(seg.xIn * W, his[0], 0.8) - 10, lerp(0.3 * H, his[1], 0.72)]);
    const iHis = P.length;
    for (const p of loop(HIS, st.loose, st.knot)) P.push(both(p));

    // the bridge: slack sagging below the fingertips, which gathers up into a
    // small overhand knot in the gap between the fingers as `knot` goes to 1
    const iBridge = P.length;
    const k = gsap.parseEase("power2.inOut")(st.knot);
    const kr = lerp(16, 8.5, clamp01((st.knot - 0.35) / 0.65)) / 1080; // knot radius, tightening
    for (let i = 0; i < BRIDGE_N; i++) {
      const t = (i + 1) / (BRIDGE_N + 1);
      const sag = [lerp(HX(500), HX(566), t), HY(900) + Math.sin(t * Math.PI) * HY(62)];
      const a = Math.PI * (0.9 - 2.35 * t); // ~1.2 turns: the overhand's crossing
      const kp = [KNOT[0] + Math.cos(a) * kr * (1 + 0.25 * (t - 0.5)), KNOT[1] + Math.sin(a) * kr * (2 / 3) + (t - 0.5) * HY(4)];
      P.push(both(lerpPt(sag, kp, k)));
    }
    const iHer = P.length;
    // her loop runs the other way round, as a mirror of his, and closes on itself
    const hers = loop(HERS, st.loose, st.knot).reverse();
    for (const p of hers) P.push(both(p));
    P.push(both(hers[0]));
    return { P, iHis, iBridge, iHer };
  }

  function render() {
    const mT = masterT();
    master.style.transformOrigin = `${mT.ou * 100}% ${mT.ov * 100}%`;
    master.style.transform = `translate3d(${mT.tx.toFixed(1)}px, ${mT.ty.toFixed(1)}px, 0) scale(${mT.s.toFixed(4)})`;
    const hT = handsT();
    hands.style.transformOrigin = `${hT.ou * 100}% ${hT.ov * 100}%`;
    hands.style.transform = `translate3d(${hT.tx.toFixed(1)}px, ${hT.ty.toFixed(1)}px, 0) scale(${hT.s.toFixed(4)})`;
    hands.style.opacity = st.hands.toFixed(3);
    hands.style.visibility = st.hands > 0.001 ? "inherit" : "hidden";
    // the knot's soft glow sits on the knot itself
    const kp = planeToScreen(box, KNOT[0], KNOT[1], hT);
    glow.style.transform = `translate3d(${kp[0].toFixed(1)}px, ${kp[1].toFixed(1)}px, 0) translate(-50%, -50%)`;
    drawThread();
  }

  function drawThread() {
    const { P, iHis } = points();
    const keep = (i) => i < 2 || i >= iHis - 1; // everything on the fingers stays exactly put
    const Ps = sway(P, time, reduced, keep);
    // until it reaches his finger, the tip follows TIP_LINE down the screen
    const depthTip = tipAtDepth(Ps.slice(0, iHis + 1).map((p, i) => (i < 2 ? i * 0.1 * H : p[1])), Math.max(st.entry * TIP_LINE * H, st.tipA * H));
    thread.draw(Ps, Math.max(depthTip, st.tip));
  }

  measure();
  const idx = points();
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: render });
  tl.to($(".edge--top"), { opacity: 0, duration: 30 }, 0);
  beat(tl, beat1, dim, 10, 58);
  // the camera pushes slowly into the couple, then crossfades into the hands
  tl.to(st, { zoom: 1, duration: 80, ease: "power1.inOut" }, 40);
  tl.to(st, { tipA: 0.9, duration: 70, ease: "power1.inOut" }, 30);
  tl.to(st, { tip: idx.iHis + LOOP_N - 0.01, duration: 20, ease: "power1.inOut" }, 98); // already looped on his finger
  tl.to(st, { hands: 1, duration: 26, ease: "power1.inOut" }, 104);
  // the payoff, slow: across to her finger, around it, then the knot
  tl.to(st, { tip: idx.iHer, duration: 34, ease: "power1.inOut" }, 136);
  tl.to(st, { tip: idx.P.length - 1, duration: 26, ease: "power1.inOut" }, 170);
  tl.to(st, { loose: 1, duration: 30, ease: "power2.inOut" }, 196);
  tl.to(st, { knot: 1, duration: 40, ease: "none" }, 198);
  tl.fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 14, ease: "power1.out" }, 234);
  tl.to(glow, { opacity: 0.55, duration: 10 }, 248);
  beat(tl, closing, dim, 244, null);
  tl.to({}, { duration: 1 }, pinVh - 1);

  ScrollTrigger.create({
    trigger: stage.parentElement, start: `top ${TIP_LINE * 100}%`, end: "top top",
    onUpdate: (s) => { st.entry = s.progress; render(); },
  });
  let visible = false;
  ScrollTrigger.create({ trigger: stage.parentElement, start: "top bottom", end: "bottom top", onToggle: (s) => { visible = s.isActive; } });
  if (!reduced) gsap.ticker.add((t) => { time = t; if (visible) drawThread(); });
  render();
  return { tl, refresh() { measure(); render(); }, _debug: { st, render } };
}
