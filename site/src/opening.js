// Screens 1 and 2 (Section 6): the school, the tie, and the tilt into the sky.
// Built as one pinned sequence, because the camera tilt carries the playground
// and the sky as one continuous image.
//
// Everything visual is driven from one plain state object `st`, tweened by a
// scrubbed timeline measured in vh of scroll. render() turns `st` into
// transforms, opacities and the thread path, so the thread is always computed
// from exactly the same numbers as the images it is tied to.

import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { createThreadSvg, coverBox, planeToScreen, lerp, lerpPt, pathRange, anchorTransform, PINKY_ANCHOR, indexAtLength } from "./thread.js";
import { setSrc } from "./lazy.js";
import { seam, swayAll, swayDue, reveal, EASE_OUT, smoothStep } from "./motion.js";

// ---------------------------------------------------------------------------
// measured coordinates (fractions of the 2:3 source images)
// ---------------------------------------------------------------------------

// Kids, from the pipeline's srcBox on the 4096x6144 master.
const BOY  = { u: 0.326, v: 0.600, w: 0.1187, h: 0.2670 };
const GIRL = { u: 0.536, v: 0.624, w: 0.1270, h: 0.2495 };
const KID_SPREAD = 0.12;  // start offset outward, per the brief
const KID_CLOSE  = 0.025; // end: nudged in past the master, still not touching
// hands hanging at their sides, as fractions of each cutout's own box
const BOY_HAND  = [0.92, 0.47];
const GIRL_HAND = [0.05, 0.53];

// s1_hands, measured on the 1080x1620 export (left hand is his, right is hers)
const HX = (x) => x / 1080, HY = (y) => y / 1620;
const HER_TIPS  = [HX(540), HY(962)];     // her index/thumb pinch
// His little finger is the one extended to the right, toward her fingers
// (the digit curled at the bottom left is his thumb).
const PINKY     = [HX(475), HY(961)];     // middle of his little finger
const PINKY_DIR = [0.84, 0.55];           // finger's direction (down-right, toward the tip)
const PINKY_HALF_W = 21 / 1080;           // a little over half the finger's width
const LOOP_N = 8;
const HANDS_SCALE = 1.3; // the close-up is held a little zoomed, so his pinky can sit on PINKY_ANCHOR

// the thread's route through the sky, in stage fractions of the sky plane
// (at the end of the tilt). It frames the invitation: up the left edge, over
// the top, and down the right edge towards Haldi, clear of the text column.
const SKY_ROUTE = [
  [0.24, 0.95], [0.10, 0.66], [0.10, 0.34], [0.20, 0.13], [0.50, 0.06],
  [0.80, 0.13], [0.90, 0.34], [0.90, 0.62], null, [0.78, 1.0],
];
// (the last point sits exactly on the bottom edge and the one before it, the
// `null`, is placed along the seam's shared direction: the next section's
// thread starts there, at the same x and angle, so they meet without a join)
// The sky plane is drawn taller than the stage so it reaches well under the
// plate's faded top edge: the seam blends into sky, never into a gap.
const SKY_SCALE = 1.2;
const SEAM = 0.18; // overlap of sky under the plate, in stage heights

// ---------------------------------------------------------------------------
// timeline (vh of scroll from the start of the pin)
// ---------------------------------------------------------------------------
export const PIN_VH = 520; // + 100vh of the stage scrolling away = 620vh total

// point indices in the thread (see points())
const I_LOOP = 3, I_EXIT = I_LOOP + LOOP_N, I_SKY = I_EXIT + 3;
const I_END = I_SKY + SKY_ROUTE.length - 1;
// The thread is drawn in two pieces, split at the top of its arc. The strand
// rising from the kids fades into the bottom of the frame as the tilt ends
// (the playground is then below, so it must not end in a visible cut); the
// onward strand carries on down into Haldi.
const I_APEX = I_SKY + 4;

export function buildOpening(stage, manifest, { reduced }, seg) {
  const img = (key) => manifest[key] && `/${manifest[key].file}`;
  const plateSrcset = (key) => {
    const a = manifest[`${key}@750`], b = manifest[`${key}@1080`];
    return { src: `/${b.file}`, srcset: `/${a.file} 750w, /${b.file} 1080w` };
  };

  stage.classList.add("stage--opening");
  stage.innerHTML = `<div class="settle">
    <div class="plane plane--sky"><img alt="" decoding="async"></div>
    <div class="plane plane--plate">
      <img alt="" decoding="async">
      <img class="kid" alt="" decoding="async" data-kid="boy">
      <img class="kid" alt="" decoding="async" data-kid="girl">
    </div>
    <div class="plane plane--hands"><img alt="" decoding="async"></div>
    ${seg.grade ? `<div class="grade" style="--g1:${seg.grade[0]};--g2:${seg.grade[1]}"></div>` : ""}
    <div class="edge edge--bottom" style="--c:${seg.bottom}"></div>
    <div class="thread-slot"></div>
    <div class="clouds"></div>
    <div class="dim"></div>
    <div class="card card--light beat-card" data-beat="1"><p class="beat">They say an invisible red thread connects two people who are meant to meet.</p></div>
    <div class="card card--light beat-card" data-beat="2"><p class="beat">It may stretch. It may tangle. It never breaks.</p></div>
    <div class="card card--light beat-card" data-beat="3"><p class="beat">Ours was tied in a school playground.</p></div>
    <div class="sky-text">
      <div class="sky-names">Neil <span class="amp">&amp;</span> Vishruti</div>
      <div class="sky-invite">invite you to celebrate their wedding</div>
      <div class="sky-date">20 &amp; 21 November 2026 · Prayagraj</div>
      <div class="sky-follow">Follow the thread ↓</div>
    </div>
  </div>`;

  const $ = (s) => stage.querySelector(s);
  const sky = $(".plane--sky"), plate = $(".plane--plate"), hands = $(".plane--hands");
  const sizes = "(min-width: 600px) 640px, 150vw";
  for (const [el, key] of [[sky, "s2_sky"], [plate, "s1_plate"], [hands, "s1_hands"]]) {
    const im = el.querySelector("img"), s = plateSrcset(key);
    setSrc(im, s.src, s.srcset, sizes);
  }
  const boy = $('[data-kid="boy"]'), girl = $('[data-kid="girl"]');
  setSrc(boy, img("s1_boy")); setSrc(girl, img("s1_girl"));
  for (const [el, k] of [[boy, BOY], [girl, GIRL]]) {
    el.style.width = `${k.w * 100}%`;
    el.style.top = `${k.v * 100}%`;
  }

  // four clouds, drifting past faster than the sky (x, width in stage fractions)
  // They hug the edges so they never sit behind the invitation text, and
  // have all passed by the time it has faded in.
  const cloudDefs = [
    { key: "cloud_0", x: -0.24, w: 0.46, from: -0.75, to: 1.30 },
    { key: "cloud_1", x: 0.76,  w: 0.44, from: -1.05, to: 1.20 },
    { key: "cloud_2", x: -0.20, w: 0.42, from: -1.55, to: 1.10 },
    { key: "cloud_3", x: 0.80,  w: 0.40, from: -1.90, to: 1.05 },
  ];
  const cloudBox = $(".clouds");
  const clouds = cloudDefs.map((c) => {
    const el = document.createElement("img");
    setSrc(el, img(c.key)); el.alt = ""; el.decoding = "async";
    el.style.left = `${c.x * 100}%`; el.style.width = `${c.w * 100}%`;
    cloudBox.appendChild(el);
    return { ...c, el };
  });

  // the rising strand (fades below frame at the end of the tilt), with a back
  // layer masked by his finger so the loop visibly goes round behind it
  const thread = createThreadSvg($(".thread-slot"), { fade: true, back: "mask" });
  const onward = createThreadSvg($(".thread-slot"));
  const beats = [1, 2, 3].map((n) => $(`[data-beat="${n}"]`));
  const skyLines = [...stage.querySelectorAll(".sky-text > div")];
  const dim = $(".dim"), grade = $(".grade"), settle = $(".settle");
  const beatRv = beats.map((el) => reveal(el));
  const skyRv = skyLines.map((el, i) => reveal(el, { delay: i * 0.09 }));

  // ---- state -------------------------------------------------------------
  // `st` holds scroll targets (set by the scrubbed timeline); `sm` follows them
  // with a ~0.12s smoothing, so the camera moves and the pen don't pick up the
  // finger's jitter. Cards/text are never smoothed (they're time-triggered).
  const st = {
    kids: 0,      // 0 = spread apart, 1 = close together
    drift: 0,     // slow background parallax
    zoom: 1,      // camera push into the hands
    hands: 0,     // s1_hands opacity
    tilt: 0,      // 0 = playground, 1 = sky
    clouds: 0,
    // the pen, stroke by stroke (0..1 along each stroke's length)
    pA: 0,        // her fingertips -> his little finger
    pL: 0,        // round his little finger
    pT: 0,        // the free end trailing up the frame
    pR: 0,        // rising into the sky
    pD: 0,        // turning and travelling down, toward Haldi
    leave: 0,     // the stage scrolling away (after the pin)
  };
  const SMOOTH = ["kids", "drift", "zoom", "hands", "tilt", "clouds", "pA", "pL", "pT", "pR", "pD", "leave"];
  const sm = { ...st };
  const knot = { loose: 1.8 }; // loop slack; cinched in time once the loop closes

  let W = 0, H = 0, box = null;
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    box = coverBox(W, H);
    for (const el of [plate, hands]) {
      Object.assign(el.style, { width: `${box.w}px`, height: `${box.h}px`, left: `${box.x}px`, top: `${box.y}px` });
    }
    Object.assign(sky.style, {
      width: `${box.w * SKY_SCALE}px`, height: `${box.h * SKY_SCALE}px`,
      left: `${(W - box.w * SKY_SCALE) / 2}px`, top: "0px",
    });
    for (const t of [thread, onward]) t.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  }

  // Reduced motion (7.3): no parallax, zooms or slides; the playground and sky
  // crossfade instead, and the clouds stay away. M scales every movement.
  const M = reduced ? 0 : 1;
  if (reduced) { st.kids = sm.kids = 1; knot.loose = 1; }

  // kids' current left edges (plane fractions)
  const kidU = () => ({
    boy:  BOY.u  - KID_SPREAD + (KID_SPREAD + KID_CLOSE) * sm.kids,
    girl: GIRL.u + KID_SPREAD - (KID_SPREAD + KID_CLOSE) * sm.kids,
  });

  // plate plane transform: parallax drift + zoom toward the kids + tilt slide
  const KIDS_MID = [0.49, 0.74];
  const plateT = () => ({
    tx: 0,
    ty: M * (-0.02 * H * sm.drift + sm.tilt * H + 0.35 * sm.leave * H),
    s: reduced ? 1 : sm.zoom * (1 + 0.03 * sm.drift),
    ou: KIDS_MID[0], ov: KIDS_MID[1],
  });
  // the close-up: his pinky pinned to the shared anchor (rhymes with Screen 8)
  // (it settles from 1.06x as it dissolves in, so the camera never stops)
  const handsT = () => {
    const t = anchorTransform(box, W, H, PINKY[0], PINKY[1], HANDS_SCALE, PINKY_ANCHOR[0] * W, PINKY_ANCHOR[1] * H);
    t.s *= 1 + 0.06 * M * (1 - sm.hands);
    t.ty += M * (sm.tilt * H + 0.35 * sm.leave * H);
    return t;
  };

  // the sky rides directly above the plate (one tall continuous image),
  // its bottom tucked SEAM under the plate's faded top edge
  const plateTop = () => { const t = plateT(); return box.y + t.ov * box.h * (1 - t.s) + t.ty; };
  // (reduced motion: the sky simply waits in its final place, under the plate)
  const skyTy = () => plateTop() + (reduced ? H : 0) - box.h * SKY_SCALE + SEAM * H;
  // where the sky will sit once the tilt is done (the plate is then one H lower)
  const skyTyEnd = () => skyTy() + M * (1 - sm.tilt) * H;

  // ---- the thread's points, recomputed from current state ------------------
  let time = 0;
  function points() {
    const pT = plateT();
    const hT = handsT();
    const onPlate = (u, v) => planeToScreen(box, u, v, pT);
    const onHands = (u, v) => planeToScreen(box, u, v, hT);
    const h = sm.hands; // 1: tied to the close-up hands, 0: to the kids on the plate

    const k = kidU();
    const boyHand  = [k.boy  + BOY_HAND[0]  * BOY.w,  BOY.v  + BOY_HAND[1]  * BOY.h];
    const girlHand = [k.girl + GIRL_HAND[0] * GIRL.w, GIRL.v + GIRL_HAND[1] * GIRL.h];
    const both = (hp, pp) => lerpPt(onPlate(...pp), onHands(...hp), h);

    const P = [];
    // her fingertips -> a sagging run -> into the loop
    P.push(both(HER_TIPS, girlHand));
    // (a short, soft sag just above his fingertip, then onto the finger)
    P.push(both([HX(522), HY(958)], [lerp(boyHand[0], girlHand[0], 0.5), boyHand[1] + 0.012]));
    P.push(both([HX(496), HY(949)], [boyHand[0] + 0.004, boyHand[1] + 0.004]));

    // the loop around his little finger: an ellipse across the finger,
    // flattened along it so it reads as wrapping round rather than lying on top
    const [dx, dy] = PINKY_DIR, px = dy, py = -dx; // perpendicular
    const r = PINKY_HALF_W * knot.loose, m = r * 0.3;
    for (let i = 0; i < LOOP_N; i++) {
      const a = (i / LOOP_N) * Math.PI * 2;
      const ou = Math.cos(a) * r * px + Math.sin(a) * m * dx;
      const ov = (Math.cos(a) * r * py + Math.sin(a) * m * dy) * (2 / 3); // v is 1.5x longer
      P.push(both([PINKY[0] + ou, PINKY[1] + ov], [boyHand[0] + ou * 0.12, boyHand[1] + ov * 0.12]));
    }

    // the free end trails upward: out of the loop, up the frame
    P.push(both([HX(452), HY(928)], [boyHand[0], boyHand[1] - 0.01]));
    P.push(both([HX(425), HY(835)], [boyHand[0] - 0.005, boyHand[1] - 0.12]));
    P.push(both([HX(395), HY(560)], [boyHand[0] - 0.03, 0.34 - 0.02 * sm.drift]));

    // and on up into the sky, which sits above the frame until the tilt
    // (the thread is foreground: it does not take the scene's leaving
    // parallax, so its end stays on the seam the next section picks up from)
    const sOff = skyTy() - skyTyEnd(); // 0 once the tilt is done
    // (reduced motion: the sky's strand starts on its own, so it rises from
    // just below the frame rather than showing a loose end)
    const bot = seam.bottom(SKY_ROUTE[SKY_ROUTE.length - 1][0], W, H);
    SKY_ROUTE.forEach((pt, i) => {
      if (!pt) return P.push([bot.prev[0], bot.prev[1] + sOff]);
      P.push([pt[0] * W, (reduced && i === 0 ? 1.08 : pt[1]) * H + sOff]);
    });
    P.tail = [bot.tail[0], bot.tail[1] + sOff];

    // idle sway, phased by page position; the tie itself stays exactly put
    if (reduced) return P;
    const pageTop = stage.getBoundingClientRect().top + window.scrollY;
    return swayAll(P, pageTop, time, (i) => i >= 0 && i <= I_EXIT);
  }

  // his finger, as a thick line along its axis: the mask that hides the far
  // side of the loop (only once we're on the close-up)
  function fingerOccluder() {
    if (sm.hands < 0.5) return [];
    const hT = handsT();
    const L = 130, w = 2 * PINKY_HALF_W * 1080 * 0.95; // along / across, in 1080-px image units
    const a = planeToScreen(box, PINKY[0] - (PINKY_DIR[0] * L / 2) / 1080, PINKY[1] - (PINKY_DIR[1] * L / 2) / 1620, hT);
    const b = planeToScreen(box, PINKY[0] + (PINKY_DIR[0] * L / 2) / 1080, PINKY[1] + (PINKY_DIR[1] * L / 2) / 1620, hT);
    return [[a[0], a[1], b[0], b[1], (w / 1080) * box.w * hT.s]];
  }

  // the pen: which point index it has reached, by *length* along each stroke
  const TRAIL_END = reduced ? I_SKY - 1 : I_SKY;
  function penTip(P) {
    if (sm.pD > 0) return indexAtLength(P, I_SKY + 3, I_END, sm.pD);
    if (sm.pR > 0) return indexAtLength(P, TRAIL_END, I_SKY + 3, sm.pR);
    if (sm.pT > 0) return indexAtLength(P, I_EXIT, TRAIL_END, sm.pT);
    if (sm.pL > 0) return indexAtLength(P, I_LOOP, I_EXIT, sm.pL);
    return indexAtLength(P, 0, I_LOOP, sm.pA);
  }

  // ---- render ----------------------------------------------------------------
  function render() {
    const pT = plateT();
    plate.style.transformOrigin = `${pT.ou * 100}% ${pT.ov * 100}%`;
    plate.style.transform = `translate3d(0, ${pT.ty.toFixed(1)}px, 0) scale(${pT.s.toFixed(4)})`;
    // a whisper of blur at the height of each dissolve hides the double exposure
    const bell = M * Math.sin(Math.PI * Math.min(1, Math.max(0, sm.hands)));
    plate.style.filter = bell > 0.02 ? `blur(${(2 * bell).toFixed(2)}px)` : "";
    if (grade) grade.style.opacity = sm.leave.toFixed(3);
    // blend the seam: fade the plate's own sky into s2_sky while tilting
    plate.classList.toggle("is-tilting", !reduced && sm.tilt > 0.001);
    if (reduced) plate.style.opacity = (1 - sm.tilt).toFixed(3);
    sky.style.visibility = sm.tilt > 0.001 ? "inherit" : "hidden";
    sky.style.transform = `translate3d(0, ${skyTy().toFixed(1)}px, 0)`;

    hands.style.opacity = sm.hands.toFixed(3);
    hands.style.visibility = sm.hands > 0.001 ? "inherit" : "hidden";
    const hT = handsT();
    hands.style.transformOrigin = `${hT.ou * 100}% ${hT.ov * 100}%`;
    hands.style.transform = `translate3d(${hT.tx.toFixed(1)}px, ${hT.ty.toFixed(1)}px, 0) scale(${hT.s})`;

    const k = kidU();
    boy.style.left = `${k.boy * 100}%`;
    girl.style.left = `${k.girl * 100}%`;

    if (!reduced) for (const c of clouds) {
      const y = lerp(c.from, c.to, sm.clouds);
      c.el.style.transform = `translate3d(0, ${(y * H).toFixed(1)}px, 0)`;
      c.el.style.visibility = sm.clouds > 0 && sm.clouds < 1 ? "inherit" : "hidden";
    }

    drawThread();
  }

  // the loop's far half (round the back of his finger)
  const LB0 = I_LOOP + LOOP_N / 2, LB1 = I_EXIT;
  function drawThread() {
    const P = points();
    const tip = penTip(P);
    // reduced motion: the tie's strand fades out with the playground, and the
    // sky's strand starts on its own at the bottom of the sky
    const split = reduced ? I_SKY : I_APEX;
    const to = Math.min(tip, split);
    thread.setD(pathRange(P, 0, Math.min(to, LB0)) + (to > LB1 ? pathRange(P, LB1, to) : ""));
    thread.setBack(to > LB0 ? pathRange(P, LB0, Math.min(to, LB1)) : "");
    thread.setOccluders(fingerOccluder());
    onward.setD(tip > split ? pathRange(P, split, tip) : "");
    if (reduced) {
      thread.svg.style.opacity = (1 - sm.tilt).toFixed(3);
      thread.setFade(9e4, 9e4 + 1);
    } else {
      // below-frame fade for the rising strand, easing in over the tilt
      const y0 = H * (1.7 - 0.95 * sm.tilt);
      thread.setFade(y0, y0 + 0.26 * H);
    }
  }

  // ---- the scrubbed timeline -------------------------------------------------
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: onScroll });
  const at = (vh) => vh;

  // Screen 1: the kids drift together under the slow parallax
  if (!reduced) tl.to(st, { kids: 1, duration: 130, ease: "power1.inOut" }, at(0));
  tl.to(st, { drift: 1, duration: 400 }, at(0));

  // the camera keeps pushing through the dissolve into the hands
  if (!reduced) tl.to(st, { zoom: 1.18, duration: 59, ease: "power1.inOut" }, at(165));
  tl.to(st, { hands: 1, duration: 16, ease: "power1.inOut" }, at(206));
  tl.set(st, { zoom: 1 }, at(380)); // reset while hidden behind the hands

  // the tie, stroke by stroke, the pen at an even speed along the thread
  tl.to(st, { pA: 1, duration: 40, ease: "power2.inOut" }, at(228));
  tl.to(st, { pL: 1, duration: 48, ease: "sine.inOut" }, at(270));
  tl.to(st, { pT: 1, duration: 36, ease: "power1.in" }, at(320));

  // Screen 2: back to the playground, then the camera tilts up into the sky
  tl.to(st, { hands: 0, duration: 22, ease: "power1.inOut" }, at(414));
  tl.to(st, { tilt: 1, duration: 60, ease: "power2.inOut" }, at(432));
  tl.to(st, { clouds: 1, duration: 80 }, at(420));
  tl.to(st, { pR: 1, duration: 55, ease: "power1.inOut" }, at(432));
  // the invitation (time-triggered at 466), then the thread turns down
  tl.to(st, { pD: 1, duration: 32, ease: "power1.inOut" }, at(486));
  tl.to($(".edge--bottom"), { opacity: 1, duration: 34 }, at(PIN_VH - 34)); // blend into the transition below
  tl.to({}, { duration: 1 }, at(PIN_VH - 1)); // pad the timeline to exactly the pin length

  // Scroll moves only targets and triggers; drawing happens on the ticker
  // (after smoothing). Cards and the invitation are triggered, then timed.
  const BEATS = [[23, 83], [103, 159], [364, 408]]; // visible windows (vh)
  let lastT = 0, cinched = false;
  function onScroll() {
    const t = tl.time(), fwd = t >= lastT;
    lastT = t;
    let anyOn = false;
    BEATS.forEach(([a, b], i) => { const on = t >= a && t < b; beatRv[i].set(on, fwd); anyOn = anyOn || on; });
    setDim(anyOn ? 0.25 : 0);
    const skyOn = t >= 466;
    skyRv.forEach((r) => r.set(skyOn, fwd));
    // the cinch: once the loop has closed, it pulls snug in time (and loosens
    // again if the guest scrolls back before it)
    const closed = st.pL >= 0.999;
    if (!reduced && closed !== cinched) {
      cinched = closed;
      gsap.to(knot, closed
        ? { loose: 1, duration: 0.6, ease: "back.out(1.4)", overwrite: true }
        : { loose: 1.8, duration: 0.3, ease: EASE_OUT, overwrite: true });
    }
    awake = true;
  }
  let dimTarget = -1;
  function setDim(v) {
    if (v === dimTarget) return;
    dimTarget = v;
    gsap.to(dim, { opacity: v, duration: 0.5, ease: EASE_OUT, overwrite: true });
  }

  // ---- lifecycle ---------------------------------------------------------------
  let visible = true, awake = true, lastTick = 0;
  measure();
  render();

  // the stage scrolling away after the pin: the camera passes the scene
  ScrollTrigger.create({
    trigger: stage.parentElement, start: "bottom bottom", end: "bottom top",
    onUpdate: (s) => { st.leave = s.progress; awake = true; },
  });
  ScrollTrigger.create({
    trigger: stage.parentElement,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => {
      visible = self.isActive;
      if (visible) { Object.assign(sm, st); render(); }
    },
  });
  // each frame: ease the smoothed values toward their targets and redraw while
  // anything moves (or the loop is cinching); otherwise only the idle sway
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
    const cinching = gsap.isTweening(knot);
    if (moving || cinching) render();
    else if (swayDue() && sm.pA > 0) drawThread();
  });

  // After the tap: a slow camera settle as the gate lifts, the kids fading up.
  function intro() {
    if (!reduced) gsap.fromTo(settle, { scale: 1.06 }, { scale: 1, duration: 2.4, ease: EASE_OUT });
    gsap.fromTo([boy, girl], { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 0.3, ease: EASE_OUT });
  }

  return {
    tl,
    intro,
    refresh() { measure(); render(); },
    _debug: { st, sm, render },
  };
}
