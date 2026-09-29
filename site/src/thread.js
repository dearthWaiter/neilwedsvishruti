// The red thread (Section 5.1).
// A thread is an ordered list of screen-space points, smoothed into cubic
// Béziers (Catmull-Rom). It is "drawn" by building the path only up to a tip
// position, measured in point-index units (e.g. tip 3.5 = halfway between
// points 3 and 4), so no getTotalLength / dasharray work is needed per frame.

const NS = "http://www.w3.org/2000/svg";

let uid = 0;

// { fade: true } adds a vertical fade-out mask, positioned with setFade().
export function createThreadSvg(parent, { fade = false } = {}) {
  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("thread");
  svg.setAttribute("aria-hidden", "true");
  let host = svg, grad = null;
  if (fade) {
    const id = `thread-fade-${++uid}`;
    svg.innerHTML = `<defs>
      <linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="9998" y2="9999">
        <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
      <mask id="${id}" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="20000" height="20000">
        <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#${id}-g)"/></mask></defs>`;
    grad = svg.querySelector("linearGradient");
    host = document.createElementNS(NS, "g");
    host.setAttribute("mask", `url(#${id})`);
    svg.appendChild(host);
  }
  const mk = (cls) => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("class", cls);
    host.appendChild(p);
    return p;
  };
  // glow is two wide translucent strokes under the core: no SVG filter,
  // which would be re-rasterised every frame and hurt mid-range Android
  const paths = [mk("thread__glow2"), mk("thread__glow"), mk("thread__core")];
  parent.appendChild(svg);

  return {
    svg,
    draw(points, tip) {
      this.setD(tip > 0 ? buildPath(points, tip) : "");
    },
    setD(d) {
      for (const p of paths) p.setAttribute("d", d);
    },
    // fully visible above y0, faded out by y1
    setFade(y0, y1) {
      grad.setAttribute("y1", y0.toFixed(1));
      grad.setAttribute("y2", Math.max(y1, y0 + 1).toFixed(1));
    },
  };
}

// Catmull-Rom (uniform) -> cubic Bézier control points for segment i
function segment(P, i) {
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
  return [
    p1,
    [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
    [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
    p2,
  ];
}

// de Casteljau: first part of a cubic, cut at t
function splitCubic([a, b, c, d], t) {
  const l = (p, q) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const ab = l(a, b), bc = l(b, c), cd = l(c, d);
  const abc = l(ab, bc), bcd = l(bc, cd);
  return [a, ab, abc, l(abc, bcd)];
}

const f = (n) => n.toFixed(1);

function buildPath(P, tip) {
  return pathRange(P, 0, tip);
}

// last part of a cubic, from t
function splitCubicTail([a, b, c, d], t) {
  const [, , , m] = splitCubic([a, b, c, d], t);
  const l = (p, q) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const bc = l(b, c), cd = l(c, d), bcd = l(bc, cd);
  return [m, bcd, cd, d];
}
const C = ([, c1, c2, e]) => `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(e[0])},${f(e[1])}`;

// The thread between two fractional point indices.
export function pathRange(P, from, to) {
  to = Math.min(to, P.length - 1);
  from = Math.max(0, Math.min(from, to));
  if (to - from < 0.001) return "";
  let d = "";
  for (let i = Math.floor(from); i < Math.ceil(to) && i < P.length - 1; i++) {
    let seg = segment(P, i);
    const a = Math.max(0, from - i), b = Math.min(1, to - i);
    if (b < 1) seg = splitCubic(seg, b);
    if (a > 0) seg = splitCubicTail(seg, a / b);
    if (!d) d = `M${f(seg[0][0])},${f(seg[0][1])}`;
    d += C(seg);
  }
  return d;
}

// Tip position (in point-index units) for a tip that has travelled down to
// depth `y`, given each point's depth key (non-decreasing). A run of points
// sharing one key (a loop, like the kalava) is walked by `loopT` (0..1) once
// the tip reaches that depth.
export function tipAtDepth(keys, y, loopT = 1) {
  if (y <= keys[0]) return 0;
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i], k1 = keys[i + 1];
    if (k1 === k0) {
      // start of a loop run: find its end
      let j = i + 1;
      while (j < keys.length - 1 && keys[j + 1] === k0) j++;
      if (loopT < 1) return i + (j - i) * loopT;
      i = j - 1; continue;
    }
    if (y < k1) return i + (y - k0) / (k1 - k0);
  }
  return keys.length - 1;
}

// Maps image-fraction coords (u, v) on a full-bleed 2:3 image into stage
// pixels, matching `object-fit: cover`, plus any translate/scale we apply to
// that image's plane (transform-origin in plane px).
export function coverBox(stageW, stageH, imgAspect = 2 / 3) {
  let w = stageW, h = stageW / imgAspect;
  if (h < stageH) { h = stageH; w = stageH * imgAspect; }
  return { w, h, x: (stageW - w) / 2, y: (stageH - h) / 2 };
}

export function planeToScreen(box, u, v, t = { tx: 0, ty: 0, s: 1, ou: 0.5, ov: 0.5 }) {
  const ox = t.ou * box.w, oy = t.ov * box.h;
  const px = u * box.w, py = v * box.h;
  return [
    box.x + ox + (px - ox) * t.s + t.tx,
    box.y + oy + (py - oy) * t.s + t.ty,
  ];
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpPt = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

// Screens 1 and 8 rhyme: his little finger, and the loop on it, sit at the
// same point on screen in both close-ups (s1_hands and s8_hands).
export const PINKY_ANCHOR = [0.30, 0.68]; // stage fractions

// Transform for a cover-fit 2:3 plane, scaled by `s` about image point (u, v)
// and moved so that point lands on stage point (ax, ay). Nudged, if needed, so
// the plane still covers the stage (then the landing is as close as it gets).
export function anchorTransform(box, W, H, u, v, s, ax, ay) {
  let tx = ax - (box.x + u * box.w), ty = ay - (box.y + v * box.h);
  const left = ax - u * box.w * s, right = ax + (1 - u) * box.w * s;
  const top = ay - v * box.h * s, bottom = ay + (1 - v) * box.h * s;
  if (left > 0) tx -= left; else if (right < W) tx += W - right;
  if (top > 0) ty -= top; else if (bottom < H) ty += H - bottom;
  return { tx, ty, s, ou: u, ov: v };
}
