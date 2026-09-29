// Central configuration: the scroll timeline and the RSVP endpoint.

// The Apps Script web app that writes RSVPs to the Google Sheet (Section 9;
// setup in apps-script/SETUP.md). If emptied, the form only logs locally.
export const RSVP_URL = "https://script.google.com/macros/s/AKfycbzEYvebeNA18wIFek0qpJ0B5__NJk-mIRvPWQWwUcIAFPEa8xZwu_9fEZHjZUmAxKH42w/exec";

// The scroll timeline, in order. `vh` is each segment's whole scroll length.
// Screens are pinned; transitions scroll normally.
//
// The thread is drawn separately in each segment, so each one hands it on at
// an agreed x (fraction of width): a segment's `xOut` is the next one's `xIn`.
// `top`/`bottom` are the colours a screen blends into at its edges, matched
// to the neighbouring transition's gradient.
//
// Heights are the brief's starting points, lengthened for Screens 3 to 6 so
// the icons rise at roughly the speed of the guest's own scroll.
export const TIMELINE = [
  // Screens 1 and 2 (320vh + 220vh) are one pinned sequence: the camera tilt
  // carries the playground and the sky as one continuous image.
  { id: "opening", type: "screen", vh: 540, build: "opening", xOut: 0.78, bottom: "#e7a172" },

  { id: "t-haldi", type: "transition", vh: 80, xIn: 0.78, xOut: 0.66, sprites: "t1_petal",
    stops: ["#e7a172 0%", "#f2bd55 55%", "#b88422 100%"] },
  { id: "s3", type: "screen", vh: 400, build: "event", xIn: 0.66, xOut: 0.34, top: "#b88422", bottom: "#6f4a26" },

  { id: "t-night", type: "transition", vh: 100, xIn: 0.34, xOut: 0.62, stars: "in",
    stops: ["#6f4a26 0%", "#5b3f5e 35%", "#28295a 70%", "#0c1f49 100%"] },
  { id: "s4", type: "screen", vh: 400, build: "event", xIn: 0.62, xOut: 0.36, top: "#0c1f49", bottom: "#23253b" },

  { id: "t-morning", type: "transition", vh: 100, xIn: 0.36, xOut: 0.64, stars: "out", sprites: "t2_marigold",
    stops: ["#23253b 0%", "#4d5f93 40%", "#8fb6e8 75%", "#3a88e4 100%"] },
  { id: "s5", type: "screen", vh: 430, build: "event", xIn: 0.64, xOut: 0.34, top: "#3a88e4", bottom: "#8a6a4e" },

  { id: "t-twilight", type: "transition", vh: 100, xIn: 0.34, xOut: 0.6, stars: "late",
    stops: ["#8a6a4e 0%", "#6d6690 35%", "#34407a 70%", "#192b52 100%"] },
  { id: "s6", type: "screen", vh: 370, build: "event", xIn: 0.6, xOut: 0.5, top: "#192b52", bottom: "#4a2f2a" },

  { id: "t-prayagraj", type: "transition", vh: 100, xIn: 0.5, xOut: 0.5,
    stops: ["#4a2f2a 0%", "#9a5a3a 32%", "#e2a15e 62%", "#7f8fb4 86%", "#2b61b3 100%"] },
  // Screen 7 (420vh in the brief) is split: 300vh of pinned beats over the
  // Sangam, then the RSVP in the normal flow of the page (never scrubbed, so
  // it stays put while the guest types).
  { id: "s7", type: "screen", vh: 300, build: "prayagraj", xIn: 0.5, xOut: 0.86, top: "#2b61b3", bottom: "#5e3322" },
  { id: "rsvp", type: "rsvp", vh: 130, xIn: 0.86, xOut: 0.32, top: "#5e3322", bottom: "#2f4a80" },
  // Screen 8: 360vh (brief: 280) so the knot can be slow.
  { id: "s8", type: "screen", vh: 360, build: "closing", xIn: 0.32, top: "#2f4a80" },
];

export const TOTAL_VH = TIMELINE.reduce((a, s) => a + s.vh, 0);
