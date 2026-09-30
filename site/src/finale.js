// Screens 7 and 8 (Section 6): Prayagraj, and the closing knot.

import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import {
  createThreadSvg, coverBox, planeToScreen, anchorTransform, PINKY_ANCHOR,
  tipAtDepth, lerp, lerpPt, pathRange, indexAtLength, findCrossing, pxPerIndex,
} from "./thread.js";
import { glowPoints } from "./fx.js";
import { TIP_LINE } from "./event.js";
import LIGHTS from "./lights.json";
import { setSrc } from "./lazy.js";
import { seam, swayAll, swayDue, reveal, EASE_OUT, smoothStep } from "./motion.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));

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

// Interval arithmetic for drawing a thread in pieces: which stretches of
// [0, tip] are drawn in front, which go round the back (masked or faint), and
// which are left as tiny gaps (a knot's under-crossing).
function cut(ranges, minus) {
  let out = ranges;
  for (const [c, d] of minus) {
    out = out.flatMap(([x, y]) => (d <= x || c >= y) ? [[x, y]]
      : [[x, Math.max(x, c)], [Math.min(y, d), y]].filter(([p, q]) => q - p > 1e-4));
  }
  return out;
}
function compose(tip, backs, gaps = []) {
  const clip = (r) => r.map(([a, b]) => [a, Math.min(b, tip)]).filter(([a, b]) => b > a);
  const b = clip(backs), g = clip(gaps);
  return { front: cut([[0, tip]], [...b, ...g]), back: cut(b, g) };
}
const dOf = (P, ranges) => ranges.map(([a, b]) => pathRange(P, a, b)).join("");

// ===========================================================================
// Screen 7 · Prayagraj: three beats over the Sangam, the river shimmering
// ===========================================================================
export function buildPrayagraj(stage, manifest, { reduced }, seg) {
  const pinVh = seg.vh - 100;
  const M = reduced ? 0 : 1;
  stage.classList.add("stage--event", "stage--s7");
  stage.innerHTML = `
    <div class="plane plane--plate"><img alt="" decoding="async"></div>
    <div class="plane plane--couple plane--master"><img alt="" decoding="async"></div>
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
  // the full painting (couple included), not a cut-out over the plate
  srcsetImg(couple.querySelector("img"), manifest, "s7_master");

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
  const beatRv = beats.map((el) => reveal(el));
  const thread = createThreadSvg($(".thread-slot"));

  let W, H, R, keys;
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    const box = focusBox(W, H);
    for (const el of [plate, couple, blur]) place(el, box);
    thread.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    // in from the top, behind the beats, then down over the river on the
    // right (clear of the couple), toward the water, and on to the RSVP
    const top = seam.top(seg.xIn, W, H), bot = seam.bottom(seg.xOut, W, H);
    R = [
      [seg.xIn * W, 0], top.next, [0.62 * W, 0.3 * H],
      [0.88 * W, 0.47 * H], [0.92 * W, 0.64 * H], [0.87 * W, 0.8 * H],
      bot.prev, [seg.xOut * W, H],
    ];
    R.head = top.head; R.tail = bot.tail;
    keys = R.map((p) => p[1]);
  }

  const st = { entry: 0, tipA: 0, drift: 0, soft: 0, arrive: 1, leave: 0 };
  const dimObj = { card: 0 };
  let time = 0;
  const tipY = () => Math.max(st.entry * TIP_LINE * H, st.tipA * H);
  function drawThread() {
    const P = reduced ? R : swayAll(R, stage.getBoundingClientRect().top + window.scrollY, time);
    thread.draw(P, tipAtDepth(keys, tipY()));
  }
  const paintDim = () => { dim.style.opacity = Math.max(dimObj.card, 0.3 * st.soft).toFixed(3); };
  function render() {
    const d = reduced ? 0 : st.drift; // reduced motion: no parallax
    // arriving and leaving, the scene drifts at 0.65x the page: the camera passing
    const pass = M * H * (0.35 * st.leave - 0.35 * (1 - st.arrive));
    plate.style.transform = `translate3d(0, ${(-0.015 * H * d + pass).toFixed(1)}px, 0)`;
    couple.style.transform = plate.style.transform; // the painting moves with the plate
    blur.style.transform = `translate3d(0, ${pass.toFixed(1)}px, 0)`;
    blur.style.opacity = st.soft.toFixed(3);
    paintDim();
    drawThread();
  }

  measure();
  let lastT = 0;
  const WINDOWS = [[21, 61], [75, 119], [133, 173]]; // each beat's visible stretch (vh)
  function onScroll() {
    const t = tl.time(), fwd = t >= lastT;
    lastT = t;
    let anyOn = false;
    WINDOWS.forEach(([a, b], i) => { const on = t >= a && t < b; beatRv[i].set(on, fwd); anyOn = anyOn || on; });
    gsap.to(dimObj, { card: anyOn ? 0.25 : 0, duration: 0.5, ease: EASE_OUT, overwrite: true, onUpdate: paintDim });
    render();
  }
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: onScroll });
  tl.to($(".edge--top"), { opacity: 0, duration: 30 }, 0);
  tl.to(st, { drift: 1, duration: pinVh }, 0);
  tl.to(st, { tipA: 1, duration: 150, ease: "power1.inOut" }, 20);
  // soften toward the RSVP, whose backdrop is this same scene, blurred
  tl.to(st, { soft: 1, duration: 30, ease: "power1.inOut" }, pinVh - 40);
  tl.to($(".edge--bottom"), { opacity: 1, duration: 30 }, pinVh - 30);
  tl.to({}, { duration: 1 }, pinVh - 1);

  ScrollTrigger.create({
    trigger: stage.parentElement, start: `top ${TIP_LINE * 100}%`, end: "top top",
    onUpdate: (s) => { st.entry = s.progress; render(); },
  });
  ScrollTrigger.create({
    trigger: stage.parentElement, start: "top bottom", end: "top top",
    onUpdate: (s) => { st.arrive = s.progress; render(); },
  });
  ScrollTrigger.create({
    trigger: stage.parentElement, start: "bottom bottom", end: "bottom top",
    onUpdate: (s) => { st.leave = s.progress; render(); },
  });
  let visible = false;
  ScrollTrigger.create({ trigger: stage.parentElement, start: "top bottom", end: "bottom top", onToggle: (s) => { visible = s.isActive; } });
  if (!reduced) gsap.ticker.add((t) => { time = t; if (visible && swayDue()) drawThread(); });
  render();
  return { tl, refresh() { measure(); render(); } };
}

// ===========================================================================
// Screen 8 · Closing: the push into the couple, and the knot
// ===========================================================================

// s8_hands, measured on the 1080x1620 export. Left hand (sherwani cuff) is his.
const HX = (x) => x / 1080, HY = (y) => y / 1620;
// `half` is a little over half the finger's width, so the loop sits round it
const HIS  = { c: [HX(478), HY(858)], dir: [0.63, 0.78], half: 19 / 1080 };   // middle of his little finger
const HERS = { c: [HX(588), HY(871)], dir: [-0.79, 0.61], half: 21 / 1080 };  // middle of hers
const KNOT = [HX(531), HY(884)];  // in the gap between the two fingers, above the tips
const HANDS_SCALE = 1.45;
// where their hands meet in s7_master (hidden between them): the zoom target
const S7_HANDS = [0.415, 0.71];
const LOOP_N = 8;
const BRIDGE_N = 8;

export function buildClosing(stage, manifest, { reduced }, seg, { onWatchAgain }) {
  const pinVh = seg.vh - 100;
  const M = reduced ? 0 : 1;
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
      <p class="sign"><span class="sig-names">Neil <span class="amp">&amp;</span> Vishruti</span> · 21.11.2026</p>
      <button class="btn btn--outline btn--again" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg><span>Watch again</span></button>
    </div>
  `;
  const $ = (s) => stage.querySelector(s);
  const master = $(".plane--plate"), hands = $(".plane--hands"), dim = $(".dim"), glow = $(".knot-glow");
  srcsetImg(master.querySelector("img"), manifest, "s7_master");
  srcsetImg(hands.querySelector("img"), manifest, "s8_hands");
  const [beat1, closing] = stage.querySelectorAll(".beat-card");
  const beatRv = reveal(beat1), closingRv = reveal(closing);
  $(".btn--again").addEventListener("click", onWatchAgain);
  // the back layer is masked by both little fingers: the loops go round them
  const thread = createThreadSvg($(".thread-slot"), { back: "mask" });

  let W, H, box, mbox;
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    box = coverBox(W, H);
    mbox = focusBox(W, H);
    place(master, mbox);
    place(hands, box);
    thread.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  }

  // `st`: scroll targets; `sm`: the same, smoothed (~0.12s) for the camera and
  // the pen. `cinch`: the final pull, played in time once the knot has formed.
  const st = {
    entry: 0, tipA: 0, zoom: 0, hands: 0, arrive: 1,
    push: 0,     // the camera easing in on the knot as it forms (0..1)
    pHis: 0,     // the pen round his little finger (tied there since Screen 1)
    pX: 0,       // across to hers
    pH: 0,       // round hers
    loose: 1.35, // loop slack (1 = snug)
    knot: 0,     // 0 = slack between the fingers, 1 = drawn into a knot
  };
  const SMOOTH = ["entry", "tipA", "zoom", "hands", "arrive", "push", "pHis", "pX", "pH", "loose", "knot"];
  const sm = { ...st };
  const cinch = { his: 0, her: 0, knot: 0 };
  let time = 0;

  // master: pushes into the couple's hands, drifting them onto the anchor
  const masterT = () => {
    const hx = mbox.x + S7_HANDS[0] * mbox.w, hy = mbox.y + S7_HANDS[1] * mbox.h;
    const z = reduced ? 0 : sm.zoom; // reduced motion: no push-in, just the crossfade
    return { tx: (PINKY_ANCHOR[0] * W - hx) * z, ty: (PINKY_ANCHOR[1] * H - hy) * z - M * 0.35 * H * (1 - sm.arrive),
             s: 1 + 0.6 * z, ou: S7_HANDS[0], ov: S7_HANDS[1] };
  };
  // After the close-up arrives (his pinky on the shared anchor, rhyming with
  // Screen 1), the camera eases in on the knot as it forms, so the two wraps
  // are big enough to read on a phone. The knot stays where it is on screen
  // while everything grows around it.
  const PUSH = 0.7; // up to 1.7x the arrival framing
  const handsT = () => {
    const t = anchorTransform(box, W, H, HIS.c[0], HIS.c[1], HANDS_SCALE, PINKY_ANCHOR[0] * W, PINKY_ANCHOR[1] * H);
    if (!reduced) t.s *= 1 + 0.06 * (1 - sm.hands); // the push carries on as it crossfades in
    if (reduced || sm.push <= 0) return t;
    const k = planeToScreen(box, KNOT[0], KNOT[1], t);
    const t2 = anchorTransform(box, W, H, KNOT[0], KNOT[1], t.s * (1 + PUSH * sm.push), k[0], k[1]);
    return t2;
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
  function points() {
    const h = sm.hands;
    const mT = masterT(), hT = handsT();
    const onM = (u, v) => planeToScreen(mbox, u, v, mT);
    const onH = (u, v) => planeToScreen(box, u, v, hT);
    const hm = onM(...S7_HANDS);
    const both = (p) => lerpPt(hm, onH(...p), h);

    const top = seam.top(seg.xIn, W, H);
    const P = [[seg.xIn * W, 0], top.next];
    P.head = top.head;
    const his = both(HIS.c);
    P.push([lerp(seg.xIn * W, his[0], 0.35), 0.3 * H]);
    P.push([lerp(seg.xIn * W, his[0], 0.8) - 10, lerp(0.3 * H, his[1], 0.72)]);
    const iHis = P.length;
    // his loop closes on itself (like hers), so its far half ends exactly
    // where the loop does and the stretch toward the knot is all in front
    const hisLoop = loop(HIS, sm.loose * (1 - 0.06 * cinch.his), sm.knot);
    for (const p of hisLoop) P.push(both(p));
    P.push(both(hisLoop[0]));

    // the bridge: slack sagging below the fingertips, which gathers up into a
    // small overhand knot in the gap between the fingers as `knot` goes to 1
    const iBridge = P.length;
    const k = gsap.parseEase("power2.inOut")(sm.knot);
    const kr = (lerp(16, 8.5, clamp01((sm.knot - 0.35) / 0.65)) * (1 - 0.14 * cinch.knot)) / 1080;
    for (let i = 0; i < BRIDGE_N; i++) {
      const t = (i + 1) / (BRIDGE_N + 1);
      const sag = [lerp(HX(500), HX(566), t), HY(900) + Math.sin(t * Math.PI) * HY(62)];
      const a = Math.PI * (0.9 - 2.35 * t); // ~1.2 turns: the overhand's crossing
      const kp = [KNOT[0] + Math.cos(a) * kr * (1 + 0.25 * (t - 0.5)), KNOT[1] + Math.sin(a) * kr * (2 / 3) + (t - 0.5) * HY(4)];
      P.push(both(lerpPt(sag, kp, k)));
    }
    const iHer = P.length;
    // her loop: the thread arrives over the top of her finger, goes round
    // behind it (points 4..7,0: hidden by the finger), and comes back across
    // the front (0..4), closing where it came in
    const hers = loop(HERS, sm.loose * (1 - 0.06 * cinch.her), sm.knot);
    for (const i of [4, 5, 6, 7, 0, 1, 2, 3, 4]) P.push(both(hers[i]));
    return { P, iHis, iBridge, iHer, onH };
  }

  // both little fingers, as thick lines along their axes (the back-layer mask)
  function fingerOccluders(onH) {
    if (sm.hands < 0.5) return [];
    const s = handsT().s;
    return [HIS, HERS].map((f) => {
      const L = 7 * 17, w = 2 * f.half * 1080 * 1.1;
      const a = onH(f.c[0] - (f.dir[0] * L / 2) / 1080, f.c[1] - (f.dir[1] * L / 2) / 1620);
      const b = onH(f.c[0] + (f.dir[0] * L / 2) / 1080, f.c[1] + (f.dir[1] * L / 2) / 1620);
      return [a[0], a[1], b[0], b[1], (w / 1080) * box.w * s];
    });
  }

  function render() {
    const mT = masterT();
    master.style.transformOrigin = `${mT.ou * 100}% ${mT.ov * 100}%`;
    master.style.transform = `translate3d(${mT.tx.toFixed(1)}px, ${mT.ty.toFixed(1)}px, 0) scale(${mT.s.toFixed(4)})`;
    // a whisper of blur at the height of the dissolve hides the double exposure
    const bell = M * Math.sin(Math.PI * clamp01(sm.hands));
    master.style.filter = bell > 0.02 ? `blur(${(2 * bell).toFixed(2)}px)` : "";
    const hT = handsT();
    hands.style.transformOrigin = `${hT.ou * 100}% ${hT.ov * 100}%`;
    hands.style.transform = `translate3d(${hT.tx.toFixed(1)}px, ${hT.ty.toFixed(1)}px, 0) scale(${hT.s.toFixed(4)})`;
    hands.style.opacity = sm.hands.toFixed(3);
    hands.style.visibility = sm.hands > 0.001 ? "inherit" : "hidden";
    // the knot's soft glow sits on the knot itself
    const kp = planeToScreen(box, KNOT[0], KNOT[1], hT);
    glow.style.left = "0"; glow.style.top = "0";
    glow.style.translate = `${kp[0].toFixed(1)}px ${kp[1].toFixed(1)}px`;
    drawThread();
  }

  function drawThread() {
    const { P, iHis, iBridge, iHer, onH } = points();
    const keep = (i) => i >= iHis - 1; // everything on the fingers stays exactly put
    const Ps = reduced ? P : swayAll(P, stage.getBoundingClientRect().top + window.scrollY, time, keep);
    // until it reaches his finger, the tip follows TIP_LINE down the screen;
    // then the pen goes stroke by stroke, at an even speed along the thread
    const keys = [];
    Ps.slice(0, iHis + 1).forEach((p, i) => keys.push(i ? Math.max(p[1], keys[i - 1] + 0.01) : p[1]));
    let tip = tipAtDepth(keys, Math.max(sm.entry * TIP_LINE * H, sm.tipA * H));
    const last = Ps.length - 1;
    if (sm.pH > 0) tip = indexAtLength(Ps, iHer, last, sm.pH);
    else if (sm.pX > 0) tip = indexAtLength(Ps, iHis + LOOP_N, iHer, sm.pX);
    else if (sm.pHis > 0) tip = Math.max(tip, indexAtLength(Ps, iHis, iHis + LOOP_N, sm.pHis));

    // round the backs of the fingers: his loop's far half, and hers (which
    // runs the other way round, so it's her first three points and the close)
    const backs = [[iHis + LOOP_N / 2, iHis + LOOP_N], [iHer, iHer + LOOP_N / 2]];
    // the knot's crossing: a small gap in the under strand, as knots are drawn
    const gaps = [];
    if (sm.knot > 0.4) {
      const c = findCrossing(Ps, iBridge - 1, iHer);
      if (c) {
        const e = 2.6 / Math.max(1, pxPerIndex(Ps, c.u));
        gaps.push([c.u - e, c.u + e]);
      }
    }
    const parts = compose(tip, backs, gaps);
    thread.setD(dOf(Ps, parts.front));
    thread.setBack(dOf(Ps, parts.back));
    thread.setOccluders(fingerOccluders(onH));
  }

  measure();
  // Scroll only moves targets and triggers; the ticker smooths and draws.
  let lastT = 0, knotted = false, awake = true;
  function onScroll() {
    const t = tl.time(), fwd = t >= lastT;
    lastT = t;
    beatRv.set(t >= 19 && t < 67, fwd);
    closingRv.set(t >= 322, fwd);
    gsap.to(dim, { opacity: (t >= 19 && t < 67) || t >= 322 ? 0.25 : 0, duration: 0.5, ease: EASE_OUT, overwrite: true });
    // the cinch: when the knot has formed, the loops and knot pull snug in
    // time (his first, hers a beat later) and the knot's glow blooms
    const formed = st.knot >= 0.999;
    if (!reduced && formed !== knotted) {
      knotted = formed;
      if (formed) {
        gsap.to(cinch, { his: 1, duration: 0.6, ease: "back.out(1.4)", overwrite: "auto" });
        gsap.to(cinch, { her: 1, duration: 0.6, delay: 0.12, ease: "back.out(1.4)", overwrite: "auto" });
        gsap.to(cinch, { knot: 1, duration: 0.7, delay: 0.05, ease: "back.out(1.4)", overwrite: "auto" });
        gsap.fromTo(glow, { opacity: 0, scale: 0.6 }, {
          keyframes: [{ opacity: 0.9, scale: 1, duration: 0.45, ease: EASE_OUT }, { opacity: 0.5, duration: 0.45, ease: "sine.inOut" }],
          delay: 0.1, overwrite: true,
        });
      } else {
        gsap.to(cinch, { his: 0, her: 0, knot: 0, duration: 0.3, ease: EASE_OUT, overwrite: true });
        gsap.to(glow, { opacity: 0, duration: 0.3, overwrite: true });
      }
    }
    if (reduced) gsap.set(glow, { opacity: formed ? 0.5 : 0, scale: 1 });
    awake = true;
  }
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: onScroll });
  tl.to($(".edge--top"), { opacity: 0, duration: 30 }, 0);
  // the camera pushes slowly into the couple, and keeps going through the
  // (short, softened) dissolve into the hands
  tl.to(st, { zoom: 1, duration: 90, ease: "power1.inOut" }, 40);
  tl.to(st, { tipA: 0.9, duration: 70, ease: "power1.inOut" }, 30);
  tl.to(st, { pHis: 1, duration: 20, ease: "power1.inOut" }, 100); // already looped on his finger
  tl.to(st, { hands: 1, duration: 16, ease: "power1.inOut" }, 112);
  // the payoff, slow: across to her finger, around it, then the knot
  tl.to(st, { pX: 1, duration: 60, ease: "power2.inOut" }, 140);
  tl.to(st, { push: 1, duration: 160, ease: "power1.inOut" }, 150);
  tl.to(st, { pH: 1, duration: 50, ease: "sine.inOut" }, 200);
  tl.to(st, { loose: 1, duration: 50, ease: "power2.inOut" }, 250);
  tl.to(st, { knot: 1, duration: 60, ease: "power2.inOut" }, 252);
  tl.to({}, { duration: 1 }, pinVh - 1);

  ScrollTrigger.create({
    trigger: stage.parentElement, start: `top ${TIP_LINE * 100}%`, end: "top top",
    onUpdate: (s) => { st.entry = s.progress; awake = true; },
  });
  ScrollTrigger.create({
    trigger: stage.parentElement, start: "top bottom", end: "top top",
    onUpdate: (s) => { st.arrive = s.progress; awake = true; },
  });
  let visible = false, lastTick = 0;
  ScrollTrigger.create({
    trigger: stage.parentElement, start: "top bottom", end: "bottom top",
    onToggle: (s) => { visible = s.isActive; if (visible) { Object.assign(sm, st); render(); } },
  });
  gsap.ticker.add((t) => {
    const dt = lastTick ? t - lastTick : 0;
    lastTick = t; time = t;
    if (!visible) return;
    let moving = false;
    if (awake) {
      for (const k of SMOOTH) {
        const v = smoothStep(sm[k], st[k], dt);
        if (v !== sm[k]) { sm[k] = v; moving = true; }
      }
      if (!moving) awake = false;
    }
    if (moving || gsap.isTweening(cinch)) render();
    else if (swayDue()) drawThread();
  });
  render();
  return { tl, refresh() { measure(); render(); }, _debug: { st, sm, render } };
}
