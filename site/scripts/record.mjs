// Scroll-through video for WhatsApp / Instagram status (BRIEF Section 12).
//
// Renders the live site frame by frame at 1080x1920 (9:16), 30fps: the page's
// clock is faked, so each frame is exactly 1/30s apart and time-driven motion
// (petals, twinkles, the thread's sway) plays at its true speed however long
// a screenshot takes. The scroll follows KEYFRAMES: an even glide, pausing on
// every card long enough to read, and slowing for the tie and the knot.
//
//   node scripts/record.mjs [url] [outDir] [maxFrames]
// then encode with scripts/encode-video.sh.

import fs from "node:fs";
import path from "node:path";

const PW = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(PW);

const URL = process.argv[2] || "https://neilwedsvishruti.in/";
const OUT = process.argv[3] || "video-frames";
const MAX = Number(process.argv[4] || Infinity);
const FPS = 30, W = 405, H = 720; // 9:16; x(8/3) = 1080x1920
const GATE_S = 2.4, TAP_FADE_S = 1.0;

// [section id, vh into that section, hold seconds, travel speed in vh/s to get there]
const KEYFRAMES = [
  ["screen-opening", 0, 0.6, 70],
  ["screen-opening", 50, 3.0, 70],    // "They say an invisible red thread..."
  ["screen-opening", 130, 3.0, 70],   // "It may stretch..."
  ["screen-opening", 212, 0, 60],     // into the hands
  ["screen-opening", 285, 0, 30],     // the tie, slowly
  ["screen-opening", 316, 2.6, 40],   // "Ours was tied in a school playground."
  ["screen-opening", 440, 3.6, 55],   // the invitation in the sky
  ["screen-s3", 55, 3.5, 110],        // Haldi & Mehendi
  ["screen-s3", 290, 3.2, 90],        // icons, then details
  ["screen-s4", 55, 3.5, 110],        // Sangeet & Cocktails
  ["screen-s4", 290, 3.2, 90],
  ["screen-s5", 55, 3.5, 110],        // The Wedding
  ["screen-s5", 320, 3.2, 80],        // (the kalava on the way)
  ["screen-s6", 55, 3.5, 110],        // Reception & Dinner
  ["screen-s6", 262, 3.2, 90],
  ["screen-s7", 32, 2.6, 110],        // Prayagraj beats
  ["screen-s7", 88, 2.8, 70],
  ["screen-s7", 144, 2.6, 70],
  ["rsvp", 15, 2.5, 110],             // Will you be there?
  ["screen-s8", 35, 2.4, 90],         // We hope to see you there.
  ["screen-s8", 130, 0, 45],          // the push into the couple
  ["screen-s8", 240, 0, 26],          // the knot, slowly
  ["screen-s8", 262, 6.0, 30],        // With love, ...
];

const smooth = (t) => t * t * (3 - 2 * t);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1080 / W, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.clock.install();
await page.goto(URL, { waitUntil: "load" });
await page.addStyleTag({ content: "#sound-toggle, #scroll-hint { display: none !important; }" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
// freeze the page's clock: from here on, time only moves one frame at a time
await page.clock.pauseAt(new Date(Date.now() + 1000));
await page.clock.runFor(500);

let frame = 0, vt = 0; // vt: virtual ms
async function shoot(y) {
  if (frame >= MAX) return;
  await page.evaluate(({ y, vt }) => {
    if (y != null) { window.scrollTo(0, y); window.dispatchEvent(new Event("scroll")); }
    for (const a of document.getAnimations()) {
      if (!(a instanceof CSSTransition)) { a.pause(); a.currentTime = vt; }
    }
  }, { y, vt });
  await page.clock.runFor(1000 / FPS);
  vt += 1000 / FPS;
  await page.screenshot({ path: path.join(OUT, `f${String(frame).padStart(5, "0")}.jpg`), type: "jpeg", quality: 90 });
  frame++;
}

// 1. the tap gate, then the tap and its fade
for (let i = 0; i < GATE_S * FPS; i++) await shoot(null);
const tapAt = frame / FPS;
await page.tap("#tap-btn");
for (let i = 0; i < TAP_FADE_S * FPS; i++) await shoot(0);

// 2. load every section's images once (off camera), then come back to the top
const vh = await page.evaluate(() => innerHeight);
const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
for (let y = 0; y <= max; y += vh) {
  await page.evaluate((y) => { window.scrollTo(0, y); window.dispatchEvent(new Event("scroll")); }, y);
  await page.clock.runFor(50);
}
await page.waitForFunction(() => [...document.querySelectorAll("img")].every((i) => !i.dataset.src && (i.complete || !i.src)), null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { window.scrollTo(0, 0); window.dispatchEvent(new Event("scroll")); });
await page.clock.runFor(200);

// 3. the scroll-through
const starts = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#scene > *")].map((el) => [el.id, el.getBoundingClientRect().top + scrollY])));
const holds = [];
let y0 = 0;
for (const [id, off, hold, speed] of KEYFRAMES) {
  const y1 = Math.min(max, starts[id] + (off / 100) * vh);
  const dist = Math.abs(y1 - y0) / vh * 100;
  const n = Math.max(1, Math.round((dist / speed) * FPS));
  for (let i = 1; i <= n; i++) await shoot(y0 + (y1 - y0) * smooth(i / n));
  if (hold > 0) holds.push({ at: +(frame / FPS).toFixed(2), label: `${id}+${off}`, hold });
  for (let i = 0; i < hold * FPS; i++) await shoot(y1);
  y0 = y1;
  process.stdout.write(`\r${frame} frames (${(frame / FPS).toFixed(1)}s)   `);
}

fs.writeFileSync(path.join(OUT, "timing.json"), JSON.stringify({ fps: FPS, frames: frame, seconds: frame / FPS, tapAt, holds }, null, 2));
console.log(`\ndone: ${frame} frames, ${(frame / FPS).toFixed(1)}s, tap at ${tapAt.toFixed(2)}s`);
await browser.close();
