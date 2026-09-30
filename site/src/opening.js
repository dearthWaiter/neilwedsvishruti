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
import { createThreadSvg, coverBox, planeToScreen, lerp, lerpPt, pathRange, anchorTransform, PINKY_ANCHOR } from "./thread.js";
import { setSrc } from "./lazy.js";

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
const PINKY     = [HX(262), HY(1036)];    // middle of his little finger
const PINKY_DIR = [0.43, 0.90];           // finger's direction (down-right)
const PINKY_HALF_W = 17 / 1080;           // half the finger's width
const LOOP_N = 8;
const HANDS_SCALE = 1.3; // the close-up is held a little zoomed, so his pinky can sit on PINKY_ANCHOR

// the thread's route through the sky, in stage fractions of the sky plane
// (at the end of the tilt). It frames the invitation: up the left edge, over
// the top, and down the right edge towards Haldi, clear of the text column.
const SKY_ROUTE = [
  [0.24, 0.95], [0.10, 0.66], [0.10, 0.34], [0.20, 0.13], [0.50, 0.06],
  [0.80, 0.13], [0.90, 0.34], [0.90, 0.62], [0.82, 0.86], [0.78, 1.0],
];
// (the last point sits exactly on the bottom edge: the next segment's thread
// starts there, at the same x, so the two meet without a visible join)
// The sky plane is drawn taller than the stage so it reaches well under the
// plate's faded top edge: the seam blends into sky, never into a gap.
const SKY_SCALE = 1.2;
const SEAM = 0.18; // overlap of sky under the plate, in stage heights

// ---------------------------------------------------------------------------
// timeline (vh of scroll from the start of the pin)
// ---------------------------------------------------------------------------
export const PIN_VH = 440; // + 100vh of the stage scrolling away = 540vh total

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
  stage.innerHTML = `
    <div class="plane plane--sky"><img alt="" decoding="async"></div>
    <div class="plane plane--plate">
      <img alt="" decoding="async">
      <img class="kid" alt="" decoding="async" data-kid="boy">
      <img class="kid" alt="" decoding="async" data-kid="girl">
    </div>
    <div class="plane plane--hands"><img alt="" decoding="async"></div>
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
  `;

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

  const thread = createThreadSvg($(".thread-slot"), { fade: true });
  const onward = createThreadSvg($(".thread-slot"));
  const beats = [1, 2, 3].map((n) => $(`[data-beat="${n}"]`));
  const skyLines = [...stage.querySelectorAll(".sky-text > div")];
  const dim = $(".dim");

  // ---- state -------------------------------------------------------------
  const st = {
    kids: 0,      // 0 = spread apart, 1 = close together
    drift: 0,     // slow background parallax
    zoom: 1,      // camera push into the hands
    hands: 0,     // s1_hands opacity
    tip: 0,       // how far the thread is drawn (point-index units)
    loose: 1.8,   // loop size before it tightens (1 = snug)
    tilt: 0,      // 0 = playground, 1 = sky
    clouds: 0,
  };

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
  if (reduced) st.kids = 1;

  // kids' current left edges (plane fractions)
  const kidU = () => ({
    boy:  BOY.u  - KID_SPREAD + (KID_SPREAD + KID_CLOSE) * st.kids,
    girl: GIRL.u + KID_SPREAD - (KID_SPREAD + KID_CLOSE) * st.kids,
  });

  // plate plane transform: parallax drift + zoom toward the kids + tilt slide
  const KIDS_MID = [0.49, 0.74];
  const plateT = () => ({
    tx: 0,
    ty: M * (-0.02 * H * st.drift + st.tilt * H),
    s: reduced ? 1 : st.zoom * (1 + 0.03 * st.drift),
    ou: KIDS_MID[0], ov: KIDS_MID[1],
  });
  // the close-up: his pinky pinned to the shared anchor (rhymes with Screen 8)
  const handsT = () => {
    const t = anchorTransform(box, W, H, PINKY[0], PINKY[1], HANDS_SCALE, PINKY_ANCHOR[0] * W, PINKY_ANCHOR[1] * H);
    t.ty += M * st.tilt * H;
    return t;
  };

  // the sky rides directly above the plate (one tall continuous image),
  // its bottom tucked SEAM under the plate's faded top edge
  const plateTop = () => { const t = plateT(); return box.y + t.ov * box.h * (1 - t.s) + t.ty; };
  // (reduced motion: the sky simply waits in its final place, under the plate)
  const skyTy = () => plateTop() + (reduced ? H : 0) - box.h * SKY_SCALE + SEAM * H;
  // where the sky will sit once the tilt is done (the plate is then one H lower)
  const skyTyEnd = () => skyTy() + M * (1 - st.tilt) * H;

  // ---- the thread's points, recomputed from current state ------------------
  let time = 0;
  function points() {
    const pT = plateT();
    const hT = handsT();
    const onPlate = (u, v) => planeToScreen(box, u, v, pT);
    const onHands = (u, v) => planeToScreen(box, u, v, hT);
    const h = st.hands; // 1: tied to the close-up hands, 0: to the kids on the plate

    const k = kidU();
    const boyHand  = [k.boy  + BOY_HAND[0]  * BOY.w,  BOY.v  + BOY_HAND[1]  * BOY.h];
    const girlHand = [k.girl + GIRL_HAND[0] * GIRL.w, GIRL.v + GIRL_HAND[1] * GIRL.h];
    const both = (hp, pp) => lerpPt(onPlate(...pp), onHands(...hp), h);

    const P = [];
    // her fingertips -> a sagging run -> into the loop
    P.push(both(HER_TIPS, girlHand));
    P.push(both([HX(410), HY(1092)], [lerp(boyHand[0], girlHand[0], 0.5), boyHand[1] + 0.012]));
    P.push(both([HX(305), HY(1066)], [boyHand[0] + 0.004, boyHand[1] + 0.004]));

    // the loop around his little finger: an ellipse across the finger,
    // flattened along it so it reads as wrapping round rather than lying on top
    const [dx, dy] = PINKY_DIR, px = dy, py = -dx; // perpendicular
    const r = PINKY_HALF_W * st.loose, m = r * 0.3;
    for (let i = 0; i < LOOP_N; i++) {
      const a = (i / LOOP_N) * Math.PI * 2;
      const ou = Math.cos(a) * r * px + Math.sin(a) * m * dx;
      const ov = (Math.cos(a) * r * py + Math.sin(a) * m * dy) * (2 / 3); // v is 1.5x longer
      P.push(both([PINKY[0] + ou, PINKY[1] + ov], [boyHand[0] + ou * 0.12, boyHand[1] + ov * 0.12]));
    }

    // the free end trails upward: out of the loop, up the frame
    P.push(both([HX(282), HY(990)], [boyHand[0], boyHand[1] - 0.01]));
    P.push(both([HX(330), HY(820)], [boyHand[0] - 0.005, boyHand[1] - 0.12]));
    P.push(both([HX(360), HY(520)], [boyHand[0] - 0.03, 0.34 - 0.02 * st.drift]));

    // and on up into the sky, which sits above the frame until the tilt
    const sOff = skyTy() - skyTyEnd(); // 0 once the tilt is done
    // (reduced motion: the sky's strand starts on its own, so it rises from
    // just below the frame rather than showing a loose end)
    SKY_ROUTE.forEach(([x, y], i) => P.push([x * W, (reduced && i === 0 ? 1.08 : y) * H + sOff]));

    // idle sway (±2px, slow) on the free-flowing part only; the tie stays put
    if (!reduced) {
      for (let i = I_EXIT + 1; i < P.length - 1; i++) {
        P[i] = [P[i][0] + 2 * Math.sin(time * 0.7 + i * 1.3), P[i][1] + 1.5 * Math.cos(time * 0.55 + i)];
      }
    }
    return P;
  }

  // ---- render ----------------------------------------------------------------
  function render() {
    const pT = plateT();
    plate.style.transformOrigin = `${pT.ou * 100}% ${pT.ov * 100}%`;
    plate.style.transform = `translate3d(0, ${pT.ty.toFixed(1)}px, 0) scale(${pT.s.toFixed(4)})`;
    // blend the seam: fade the plate's own sky into s2_sky while tilting
    plate.classList.toggle("is-tilting", !reduced && st.tilt > 0.001);
    if (reduced) plate.style.opacity = (1 - st.tilt).toFixed(3);
    sky.style.visibility = st.tilt > 0.001 ? "inherit" : "hidden";
    sky.style.transform = `translate3d(0, ${skyTy().toFixed(1)}px, 0)`;

    hands.style.opacity = st.hands.toFixed(3);
    hands.style.visibility = st.hands > 0.001 ? "inherit" : "hidden";
    const hT = handsT();
    hands.style.transformOrigin = `${hT.ou * 100}% ${hT.ov * 100}%`;
    hands.style.transform = `translate3d(${hT.tx.toFixed(1)}px, ${hT.ty.toFixed(1)}px, 0) scale(${hT.s})`;

    const k = kidU();
    boy.style.left = `${k.boy * 100}%`;
    girl.style.left = `${k.girl * 100}%`;

    if (!reduced) for (const c of clouds) {
      const y = lerp(c.from, c.to, st.clouds);
      c.el.style.transform = `translate3d(0, ${(y * H).toFixed(1)}px, 0)`;
      c.el.style.visibility = st.clouds > 0 && st.clouds < 1 ? "inherit" : "hidden";
    }

    drawThread();
  }

  function drawThread() {
    const P = points();
    // reduced motion: the tie's strand fades out with the playground, and the
    // sky's strand starts on its own at the bottom of the sky
    const split = reduced ? I_SKY : I_APEX;
    thread.setD(pathRange(P, 0, Math.min(st.tip, split)));
    onward.setD(st.tip > split ? pathRange(P, split, st.tip) : "");
    if (reduced) {
      thread.svg.style.opacity = (1 - st.tilt).toFixed(3);
      thread.setFade(9e4, 9e4 + 1);
    } else {
      // below-frame fade for the rising strand, easing in over the tilt
      const y0 = H * (1.7 - 0.95 * st.tilt);
      thread.setFade(y0, y0 + 0.26 * H);
    }
  }

  // ---- the scrubbed timeline -------------------------------------------------
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: render });
  const at = (vh) => vh;

  // cards: fade in with a 12px rise, hold, and leave the same way; the image dims
  const D = 12 * M; // the cards' drift (none for reduced motion: a plain crossfade)
  const card = (el, inAt, outAt) => {
    tl.fromTo(el, { autoAlpha: 0, y: D }, { autoAlpha: 1, y: 0, duration: 18, ease: "power1.out" }, at(inAt));
    tl.to(el, { autoAlpha: 0, y: -D, duration: 18, ease: "power1.in" }, at(outAt));
    tl.to(dim, { opacity: 0.25, duration: 18 }, at(inAt));
    tl.to(dim, { opacity: 0, duration: 18 }, at(outAt));
  };

  // Screen 1: the kids drift together under the slow parallax
  if (!reduced) tl.to(st, { kids: 1, duration: 130, ease: "power1.inOut" }, at(0));
  tl.to(st, { drift: 1, duration: 330 }, at(0));
  card(beats[0], 14, 74);
  card(beats[1], 94, 150);

  // crossfade and zoom into the hands
  if (!reduced) tl.to(st, { zoom: 1.15, duration: 60, ease: "power1.in" }, at(165));
  tl.to(st, { hands: 1, duration: 36, ease: "power1.inOut" }, at(190));
  tl.set(st, { zoom: 1 }, at(300)); // reset while hidden behind the hands

  // the tie: from her fingertips, round his little finger, tighten, trail up
  tl.to(st, { tip: I_LOOP, duration: 16, ease: "power1.inOut" }, at(228));
  tl.to(st, { tip: I_EXIT, duration: 20, ease: "power1.inOut" }, at(244));
  tl.to(st, { loose: 1, duration: 22, ease: "back.out(2)" }, at(262));
  tl.to(st, { tip: reduced ? I_SKY - 1 : I_SKY, duration: 22, ease: "power1.in" }, at(262));
  card(beats[2], 286, 330);

  // Screen 2: back to the playground, then the camera tilts up into the sky
  tl.to(st, { hands: 0, duration: 22, ease: "power1.inOut" }, at(334));
  tl.to(st, { tilt: 1, duration: 60, ease: "power2.inOut" }, at(352));
  tl.to(st, { clouds: 1, duration: 80 }, at(340));
  tl.to(st, { tip: I_SKY + 3, duration: 55, ease: "power1.inOut" }, at(352));

  // the invitation, then the thread turns and travels down
  skyLines.forEach((el, i) => {
    tl.fromTo(el, { autoAlpha: 0, y: D }, { autoAlpha: 1, y: 0, duration: 16, ease: "power1.out" }, at(386 + i * 11));
  });
  tl.to(st, { tip: I_END, duration: 34, ease: "power1.inOut" }, at(406));
  tl.to($(".edge--bottom"), { opacity: 1, duration: 34 }, at(PIN_VH - 34)); // blend into the transition below
  tl.to({}, { duration: 1 }, at(PIN_VH - 1)); // pad the timeline to exactly the pin length

  // ---- lifecycle ---------------------------------------------------------------
  measure();
  render();

  let visible = true;
  ScrollTrigger.create({
    trigger: stage.parentElement,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => { visible = self.isActive; },
  });
  if (!reduced) {
    gsap.ticker.add((t) => { time = t; if (visible && st.tip > 0) drawThread(); });
  }

  return {
    tl,
    refresh() { measure(); render(); },
    _debug: { st, render },
  };
}
