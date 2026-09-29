import "./styles.css";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { TIMELINE, TOTAL_VH } from "./config.js";
import { createAudio } from "./audio.js";
import { buildOpening } from "./opening.js";
import { buildEvent } from "./event.js";
import { buildTransition } from "./transition.js";
import { EVENTS } from "./events.js";
import { buildPrayagraj, buildClosing } from "./finale.js";
import { buildRsvp } from "./rsvp.js";
import { setSrc, loadIn } from "./lazy.js";

const BUILDERS = {
  opening: (stage, man, opts, seg) => buildOpening(stage, man, opts, seg),
  event: (stage, man, opts, seg) => buildEvent(stage, man, opts, EVENTS[seg.id], seg),
  prayagraj: (stage, man, opts, seg) => buildPrayagraj(stage, man, opts, seg),
  closing: (stage, man, opts, seg) => buildClosing(stage, man, opts, seg, { onWatchAgain: watchAgain }),
};

// "Watch again": a smooth ~2s scroll back to the top of Screen 1 (the tap gate
// is not replayed; the music carries on).
function watchAgain() {
  if (lenis) lenis.scrollTo(0, { duration: 2, easing: (t) => 1 - Math.pow(1 - t, 3) });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}
const built = new Map(); // screen element -> builder result

gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const app = document.getElementById("app");

let manifest = {};

// The stable screen height behind CSS `--u` (1lvh): pin lengths must use the
// same number the stages are sized with.
let probe = null;
function appH() {
  if (!probe) {
    probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:0;left:0;width:1px;height:calc(var(--u) * 100);visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
  }
  return probe.offsetHeight || window.innerHeight;
}

// ---------------------------------------------------------------------------
// asset helpers
// ---------------------------------------------------------------------------
function bgImg(key, extraClass = "stage__bg") {
  const a = manifest[`${key}@750`], b = manifest[`${key}@1080`];
  const img = document.createElement("img");
  if (a && b) {
    setSrc(img, `/${b.file}`, `/${a.file} 750w, /${b.file} 1080w`);
    img.sizes = "(min-width: 600px) 480px, 100vw";
  } else if (b) {
    setSrc(img, `/${b.file}`);
  }
  img.className = extraClass;
  img.decoding = "async";
  img.alt = "";
  return img;
}

// ---------------------------------------------------------------------------
// build DOM
// ---------------------------------------------------------------------------
function buildShell() {
  app.innerHTML = `
    <div id="desktop-bg" aria-hidden="true"><i></i><i></i></div>

    <div id="scene"></div>

    <button id="sound-toggle" aria-pressed="true" title="Sound on">
      <span class="visually-hidden">Sound on</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-on>
        <path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/>
      </svg>
    </button>

    <div id="scroll-hint">
      <span>Scroll</span>
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </div>

    <div id="landscape-guard">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="8" y="3" width="8" height="14" rx="1.6"/><path d="M11 14.5h2"/>
        <path d="M4 12a8 8 0 0 0 7 8"/><path d="M8.5 20.3 11 20l-.6-2.4"/>
      </svg>
      <div>Please turn your phone upright</div>
    </div>

    <div id="tap-gate">
      <div class="invocation">॥ ॐ श्री गणेशाय नमः ॥</div>
      <div class="gate-names">Neil &amp; Vishruti</div>
      <button class="tap-btn" id="tap-btn">Tap to open</button>
      <div class="sound-note">Best with sound on</div>
    </div>
  `;

  const scene = document.getElementById("scene");
  for (const s of TIMELINE) {
    if (s.type === "screen") {
      const screen = document.createElement("section");
      screen.className = "screen";
      screen.id = `screen-${s.id}`;
      screen.dataset.vh = s.vh;
      const stage = document.createElement("div");
      stage.className = "stage";
      screen.appendChild(stage);
      scene.appendChild(screen);
      if (s.build) {
        built.set(screen, BUILDERS[s.build](stage, manifest, { reduced: prefersReduced }, s));
        continue;
      }
      stage.appendChild(bgImg(s.bg));
      const label = document.createElement("div");
      label.className = "stage__label";
      label.innerHTML = `${s.label}<small>${s.vh}vh · pinned</small>`;
      stage.appendChild(label);
    } else {
      const t = document.createElement("div");
      t.id = s.id;
      scene.appendChild(t);
      (s.type === "rsvp" ? buildRsvp : buildTransition)(t, manifest, { reduced: prefersReduced }, s);
    }
  }

  // set the tap-gate blurred plate once manifest is known
  const gate = document.getElementById("tap-gate");
  // (the gate's backdrop is blurred 20px anyway: the small pre-blurred plate
  // is 9KB instead of 200KB, which keeps the pre-tap page light)
  const gp = manifest["s1_plate_blur"];
  if (gp) {
    const im = document.createElement("img");
    im.className = "gate-bg";
    im.src = `/${gp.file}`;
    im.alt = "";
    gate.insertBefore(im, gate.firstChild);
  }

}

// ---------------------------------------------------------------------------
// scroll: Lenis + ScrollTrigger, pin each screen for its exact scroll length
// ---------------------------------------------------------------------------
let lenis = null;
function initScroll() {
  if (!prefersReduced) {
    lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1.1,
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // locked until tap
  }

  const stages = [...document.querySelectorAll(".screen")];
  for (const screen of stages) {
    const vh = Number(screen.dataset.vh);
    const stage = screen.querySelector(".stage");
    const b = built.get(screen);
    ScrollTrigger.create({
      trigger: stage,
      start: "top top",
      // `vh` is the section's whole scroll footprint: the stage's own 100vh
      // plus (vh - 100) of pinned scroll, so the page totals TOTAL_VH.
      end: () => "+=" + appH() * ((vh - 100) / 100),
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      animation: b?.tl,
      scrub: !!b,
      onRefresh: () => b?.refresh(),
    });
  }
  // builders created their own triggers before the pins existed: order all
  // triggers by page position so each accounts for the pin spacing above it
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  document.fonts?.ready.then(() => ScrollTrigger.refresh()); // card heights settle once fonts load
}

// ---------------------------------------------------------------------------
// loading (Section 8): nothing but the gate before the tap; then Screen 1 at
// once, and every later section once the guest is within LEAD screens of it
// ---------------------------------------------------------------------------
const LEAD = 3;
// While the guest reads the gate, warm up just the playground and the kids
// (~250-450KB depending on the screen), so Screen 1 is there the moment the
// gate fades. Everything before the tap stays under the 600KB budget.
function warmUp() {
  const go = () => loadIn(document.querySelector("#screen-opening .plane--plate"));
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300));
  if (document.readyState === "complete") idle(go);
  else window.addEventListener("load", () => idle(go), { once: true });
}
function startLoading() {
  const sections = [...document.querySelectorAll("#scene > *")];
  loadIn(sections[0]);
  for (const el of sections.slice(1)) {
    ScrollTrigger.create({
      trigger: el,
      start: () => `top bottom+=${appH() * LEAD}`,
      end: "bottom top",
      once: true,
      onToggle: () => loadIn(el),
    });
  }
}

// Only sections near the screen are drawn (see .is-near in the CSS).
function initNearness() {
  for (const el of document.querySelectorAll("#scene > *")) {
    ScrollTrigger.create({
      trigger: el,
      start: () => `top bottom+=${appH()}`,
      end: () => `bottom top-=${appH()}`,
      onToggle: (st) => el.classList.toggle("is-near", st.isActive),
    });
  }
}

// backdrop-filter is the one costly effect on low-end Android (Section 8). If
// the phone is light on memory, or frames run slow while the guest scrolls,
// the cards drop the blur for their semi-opaque fallback (body.no-blur).
function initBlurGuard() {
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) {
    document.body.classList.add("no-blur");
    return;
  }
  const samples = [];
  let last = 0, scrolling = false, stopT = 0;
  window.addEventListener("scroll", () => {
    scrolling = true; clearTimeout(stopT);
    stopT = setTimeout(() => { scrolling = false; last = 0; }, 150);
  }, { passive: true });
  const tick = (t) => {
    if (scrolling && !document.hidden) {
      if (last) samples.push(t - last);
      last = t;
      if (samples.length >= 120) {
        const med = [...samples].sort((a, b) => a - b)[60];
        if (med > 24) document.body.classList.add("no-blur"); // well under ~40fps
        return; // one verdict is enough
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// desktop (7.4): the column sits over the current scene, heavily blurred
// ---------------------------------------------------------------------------
const BACKDROP = {
  "t-haldi": "s3_plate", "screen-s3": "s3_plate", "t-night": "s4_plate", "screen-s4": "s4_plate",
  "t-morning": "s5_plate", "screen-s5": "s5_plate", "t-twilight": "s6_plate", "screen-s6": "s6_plate",
  "t-prayagraj": "s7_master", "screen-s7": "s7_master", "rsvp": "s7_master", "screen-s8": "s7_master",
};
function initDesktopBackdrop() {
  const layers = [...document.querySelectorAll("#desktop-bg i")];
  let front = 0, current = null;
  const show = (key) => {
    const m = manifest[`${key}_blur`];
    if (!m || key === current) return;
    current = key;
    front = 1 - front;
    layers[front].style.backgroundImage = `url(/${m.file})`;
    layers[front].classList.add("on");
    layers[1 - front].classList.remove("on");
  };
  show("s1_plate");
  for (const el of document.querySelectorAll("#scene > *")) {
    ScrollTrigger.create({
      trigger: el, start: "top center", end: "bottom center",
      // the opening turns from playground to sky with its tilt
      onUpdate: (st) => show(BACKDROP[el.id] || (st.progress > 0.62 ? "s2_sky" : "s1_plate")),
      onToggle: (st) => st.isActive && show(BACKDROP[el.id] || (st.progress > 0.62 ? "s2_sky" : "s1_plate")),
    });
  }
}

// ---------------------------------------------------------------------------
// tap gate + persistent UI
// ---------------------------------------------------------------------------
function initGate(audio) {
  const gate = document.getElementById("tap-gate");
  const btn = document.getElementById("tap-btn");
  const soundBtn = document.getElementById("sound-toggle");
  const hint = document.getElementById("scroll-hint");

  document.documentElement.classList.add("locked");
  window.scrollTo(0, 0);

  function open() {
    btn.removeEventListener("click", open);
    startLoading();
    audio.start();                          // fade in over 2s
    gsap.to(gate, { opacity: 0, duration: 0.8, ease: "power2.out", onComplete: () => gate.remove() });
    document.documentElement.classList.remove("locked");
    if (lenis) lenis.start();
    soundBtn.classList.add("show");
    hint.classList.add("show");
    ScrollTrigger.refresh();
  }
  btn.addEventListener("click", open);

  // sound toggle
  soundBtn.addEventListener("click", () => {
    const muted = audio.toggle();
    const label = muted ? "Sound off" : "Sound on";
    soundBtn.setAttribute("aria-pressed", String(!muted));
    soundBtn.title = label;
    soundBtn.querySelector(".visually-hidden").textContent = label;
    soundBtn.querySelector("svg").style.opacity = muted ? "0.4" : "1";
  });

  // scroll hint lives on Screens 1 and 2 and fades once the guest has scrolled 40vh (7.2)
  const onScroll = () => {
    hint.style.opacity = window.scrollY > window.innerHeight * 0.4 ? "0" : "1";
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
async function boot() {
  try {
    manifest = await (await fetch("/img/manifest.json")).json();
  } catch (e) { manifest = {}; }

  buildShell();
  const audio = createAudio("/audio/music.mp3");
  if (import.meta.env.DEV) { window.__audio = audio; window.__built = built; window.__ST = ScrollTrigger; } // for Playwright checks
  initScroll();
  initNearness();
  initBlurGuard();
  warmUp();
  if (window.matchMedia("(min-width: 600px)").matches) initDesktopBackdrop();
  initGate(audio);

  // ScrollTrigger refreshes itself on real resizes; height-only resizes on
  // phones (URL bar, the keyboard opening on the RSVP form) are ignored so the
  // page never jumps while someone is typing.
  ScrollTrigger.config({ ignoreMobileResize: true });
  console.log(`[skeleton] total designed scroll = ${TOTAL_VH}vh across ${TIMELINE.length} segments`);
}

boot();
