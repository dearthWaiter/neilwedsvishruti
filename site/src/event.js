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
import { spriteField, glowPoints, meteors, starField } from "./fx.js";
import { seam, swayAll, swayDue, reveal, follower } from "./motion.js";
import LIGHTS from "./lights.json";
import { setSrc } from "./lazy.js";

export const TIP_LINE = 0.72; // the tip travels at 72% of the screen height

const PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`;

export function buildEvent(stage, manifest, { reduced }, ev, seg) {
  const file = (k) => manifest[k] && `/${manifest[k].file}`;
  const pinVh = seg.vh - 100;
  const n = ev.icons.length;

  stage.classList.add("stage--event", `stage--${seg.id}`, `acc--${ev.accent}`);
  const cardCls = `card card--${ev.variant}`;
  stage.innerHTML = `
    <div class="plane plane--plate"><img alt="" decoding="async"></div>
    <div class="plane plane--couple plane--master"><img alt="" decoding="async"></div>
    <div class="plane plane--blur"><img alt="" decoding="async"></div>
    ${ev.topShade ? `<div class="topshade"></div>` : ""}
    ${seg.grade ? `<div class="grade" style="--g1:${seg.grade[0]};--g2:${seg.grade[1]}"></div>` : ""}
    <div class="edge edge--top" style="--c:${seg.top}"></div>
    <div class="edge edge--bottom" style="--c:${seg.bottom}"></div>
    <div class="dim"></div>
    <div class="track">
      <div class="thread-under"></div>
      <div class="icons"></div>
      <div class="thread-over"></div>
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
    // Part A shows the full painting (couple included) rather than a cut-out
    // over the plate: translucent dupattas and skirt folds don't cut out
    // cleanly, and the plate showed through the holes. It crossfades to the
    // empty plate for Part B.
    const mk = ev.couple.replace("_couple", "_master");
    const ma = manifest[`${mk}@750`], mb = manifest[`${mk}@1080`];
    setSrc(couple.querySelector("img"), `/${mb.file}`, `/${ma.file} 750w, /${mb.file} 1080w`, "(min-width: 600px) 640px, 150vw");
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

  // the thread runs "under" the icons, and is redrawn "over" the ones it
  // weaves in front of; the kalava's far side is drawn fainter (back: "dim")
  const under = createThreadSvg($(".thread-under"), { back: ev.kalava != null ? "dim" : null });
  const over = createThreadSvg($(".thread-over"));

  // leaving the scene: a time-of-day grade (and, into night, stars) settles
  // over it as it drifts away, so the next palette begins inside this scene
  const grade = $(".grade");
  // (its stars only twinkle once the scene is actually leaving)
  const gradeStars = grade && seg.gradeStars ? starField(grade, { count: 40, top: 0.02, bottom: 0.6, manual: true }) : null;

  // cards and icons are triggered by scroll, then animate in time
  const mainRv = reveal(mainCard), detailsRv = reveal(details);
  const iconRv = icons.map((el) => reveal(el, { kind: "icon" }));
  const dimObj = { card: 0 };
  const dimTo = (v) => gsap.to(dimObj, { card: v, duration: 0.5, overwrite: true, onUpdate: paintDim });
  const shadeTo = topShade ? follower(topShade) : () => {};

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
    for (const t of [under, over]) t.svg.setAttribute("viewBox", `0 0 ${W} ${trackH}`);

    // the thread's route: [x, y, flags]; y doubles as the tip's depth key
    const xIn = seg.xIn * W, xOut = seg.xOut * W;
    const side = seg.xIn < 0.5 ? 0.09 : 0.91;
    const top = seam.top(seg.xIn, W, H), bot = seam.bottom(seg.xOut, W, H, trackH);
    const R = [
      [xIn, 0, "end"],
      top.next,
      [xIn + (side < 0.5 ? -12 : 12), 0.22 * H],
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
    R.push(bot.prev);
    R.push([xOut, trackH, "end"]);
    R.head = top.head; R.tail = bot.tail;

    // depth keys: loop points share the key of the point before them
    const keys = [];
    R.forEach((p, i) => keys.push(p[2] === "loop" ? keys[i - 1] ?? p[1] : Math.max(p[1], keys[i - 1] ?? 0)));

    // the kalava's far half (drawn fainter): two turns of 9 points each,
    // the upper half of each turn is the side that goes round the back
    const kal = ev.kalava != null ? iconIdx[ev.kalava] + 1 : null;
    L = { R, keys, iconPos, iconIdx, size, dTop, trackH, tyEnd: trackH - H,
          loopY: kal != null ? keys[kal] : null,
          kalBack: kal != null ? [[kal, kal + 4.5], [kal + 9, kal + 13.5]] : [] };
  }
  const lerpX = (a, b, t) => a + (b - a) * t;

  // ---- state + render ---------------------------------------------------------
  const st = { entry: 0, tipA: 0, ty: 0, drift: 0, couple: 1, soft: 0, kalava: 1, arrive: 1, leave: 0 };
  let time = 0, lastT = 0;

  function tipY() {
    const byTrack = st.ty + TIP_LINE * H + Math.max(0, st.ty - (L.tyEnd - (1 - TIP_LINE) * H));
    return Math.max(st.entry * TIP_LINE * H, st.tipA * H, st.ty > 0 ? byTrack : 0);
  }

  // points, swayed by their position on the page (the track is L.R's frame)
  function points() {
    const P = L.R.map(([x, y]) => [x, y]);
    P.head = L.R.head; P.tail = L.R.tail;
    if (reduced) return P;
    const pageTop = stage.getBoundingClientRect().top + window.scrollY - st.ty;
    return swayAll(P, pageTop, time, (i) => L.R[i]?.[2] === "loop");
  }

  // [a, b] ranges clipped to [0, tip]; and the rest of [0, tip]
  const clipRanges = (ranges, tip) => ranges.map(([a, b]) => [a, Math.min(b, tip)]).filter(([a, b]) => b > a);
  function drawThread() {
    const P = points();
    let y = tipY();
    // hold the tip at the kalava while it wraps
    if (L.loopY != null && st.kalava < 1) y = Math.min(y, L.loopY);
    const tip = tipAtDepth(L.keys, y, st.kalava);
    const backs = clipRanges(L.kalBack, tip);
    if (backs.length) {
      let d = "", from = 0;
      for (const [a, b] of backs) { d += pathRange(P, from, a); from = b; }
      d += pathRange(P, from, tip);
      under.setD(d);
      under.setBack(backs.map(([a, b]) => pathRange(P, a, b)).join(""));
    } else {
      under.draw(P, tip);
      under.setBack("");
    }
    // weave: redraw the stretch across every "front" icon above the icons
    let d = "";
    L.iconIdx.forEach((idx, i) => {
      if (icons[i].dataset.front === "1" && tip > idx - 0.55) d += pathRange(P, idx - 0.55, Math.min(tip, idx + 0.55));
    });
    over.setD(d);
    return y;
  }

  function paintDim() { dim.style.opacity = Math.max(dimObj.card, 0.3 * st.soft).toFixed(3); }

  const M = reduced ? 0 : 1; // reduced motion (7.3): no parallax, pops or drifts
  function render() {
    // Part A parallax: the couple moves a little more than the plate. Arriving
    // and leaving, the whole scene moves at 0.65x the page (the camera
    // passing it), while the track, cards and thread move at 1x.
    const pass = M * H * (0.35 * st.leave - 0.35 * (1 - st.arrive));
    plate.style.transform = `translate3d(0, ${(-0.015 * H * st.drift * M + pass).toFixed(1)}px, 0)`;
    blur.style.transform = `translate3d(0, ${pass.toFixed(1)}px, 0)`;
    couple.style.transform = plate.style.transform; // the painting moves with the plate
    couple.style.opacity = st.couple.toFixed(3);
    blur.style.opacity = st.soft.toFixed(3);
    if (grade) grade.style.opacity = st.leave.toFixed(3);
    if (gradeStars) gradeStars.classList.toggle("is-live", st.leave > 0.01 && st.leave < 1);
    if (sprites) sprites.setOpacity((1 - st.soft).toFixed(3)); // gone in Part B: faint sprites read as smudges
    track.style.transform = `translate3d(0, ${(-st.ty).toFixed(1)}px, 0)`;

    const y = drawThread();
    // reveals: triggered by position, animated in time
    const t = tl.time(), fwd = t >= lastT;
    lastT = t;
    const cardOn = t >= 19 && t < 89; // the middle of the old fade windows
    mainRv.set(cardOn, fwd);
    shadeTo(cardOn ? 1 : 0);
    dimTo(cardOn ? 0.25 : 0);
    icons.forEach((el, i) => iconRv[i].set(y >= L.iconPos[i][1] - L.size * 0.35 + 0.035 * H));
    detailsRv.set(y >= L.dTop + 0.01 * H, fwd);
    paintDim();
  }

  // ---- timeline (vh of scroll across the pin) ----------------------------------
  measure();
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: render });
  // Part A
  tl.to(edgeTop, { opacity: 0, duration: 30 }, 0);
  tl.to(st, { drift: 1, duration: 100 }, 0);
  tl.to(st, { tipA: 0.98, duration: 70, ease: "power1.inOut" }, 22);
  // into Part B: the couple fades, the plate dims and softens
  tl.to(st, { couple: 0, duration: 26, ease: "power1.inOut" }, 90);
  tl.to(st, { soft: 1, duration: 30, ease: "power1.inOut" }, 92);
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

  // arriving (before the pin) and leaving (after it): the camera passes
  ScrollTrigger.create({
    trigger: stage.parentElement, start: "top bottom", end: "top top",
    onUpdate: (s) => { st.arrive = s.progress; render(); },
  });
  ScrollTrigger.create({
    trigger: stage.parentElement, start: "bottom bottom", end: "bottom top",
    onUpdate: (s) => { st.leave = s.progress; render(); },
  });

  let visible = false;
  ScrollTrigger.create({
    trigger: stage.parentElement, start: "top bottom", end: "bottom top",
    onToggle: (s) => { visible = s.isActive; },
  });
  if (!reduced) gsap.ticker.add((t) => { time = t; if (visible && swayDue()) drawThread(); });
  render();

  return {
    tl,
    refresh() { measure(); tl.invalidate(); render(); },
  };
}
