// The red thread (Section 5.1).
// A thread is an ordered list of screen-space points, smoothed into cubic
// Béziers (centripetal Catmull-Rom, which never forms cusps or loops where
// points bunch up). It is "drawn" by building the path only up to a tip
// position, measured in point-index units (e.g. tip 3.5 = halfway between
// points 3 and 4), so no getTotalLength / dasharray work is needed per frame.
//
// A point list may carry `head` / `tail` phantom points (P.head, P.tail): they
// only steer the curve's direction at its ends, which is how each section's
// thread leaves and arrives at a seam in the same direction as its neighbour.

const NS = "http://www.w3.org/2000/svg";

let uid = 0;

// { fade: true } adds a vertical fade-out mask, positioned with setFade().
// { back: "mask" } adds a second layer for stretches that pass *behind*
// something (a finger): it is hidden wherever setOccluders() draws a shape.
// { back: "dim" } draws that layer fainter instead (a loop with nothing
// solid inside it, like the kalava, reads as going round the back).
export function createThreadSvg(parent, { fade = false, back = null } = {}) {
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
  let backPaths = [], occ = null;
  if (back) {
    const g = document.createElementNS(NS, "g");
    if (back === "mask") {
      const id = `thread-occ-${++uid}`;
      const defs = document.createElementNS(NS, "defs");
      defs.innerHTML = `<mask id="${id}" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="20000" height="20000">
        <rect x="-10000" y="-10000" width="20000" height="20000" fill="#fff"/><g class="occ" stroke="#000" stroke-linecap="round" fill="none"></g></mask>`;
      svg.insertBefore(defs, svg.firstChild);
      occ = defs.querySelector(".occ");
      g.setAttribute("mask", `url(#${id})`);
    } else {
      g.setAttribute("class", "thread__back-dim");
    }
    host.appendChild(g);
    const mkb = (cls) => { const p = document.createElementNS(NS, "path"); p.setAttribute("class", cls); g.appendChild(p); return p; };
    backPaths = [mkb("thread__glow2"), mkb("thread__glow"), mkb("thread__core")];
  }
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
    setBack(d) {
      for (const p of backPaths) p.setAttribute("d", d);
    },
    // shapes that hide the back layer: [x1, y1, x2, y2, width] thick lines
    setOccluders(lines) {
      if (!occ) return;
      occ.innerHTML = lines.map(([x1, y1, x2, y2, w]) =>
        `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke-width="${f(w)}"/>`).join("");
    },
    // fully visible above y0, faded out by y1
    setFade(y0, y1) {
      grad.setAttribute("y1", y0.toFixed(1));
      grad.setAttribute("y2", Math.max(y1, y0 + 1).toFixed(1));
    },
  };
}

// Centripetal Catmull-Rom (alpha 0.5, Barry-Goldman form) -> cubic Bézier
// control points for segment i. Unlike the uniform variant it never
// overshoots into cusps where neighbouring points are unevenly spaced.
function segment(P, i) {
  const p1 = P[i], p2 = P[i + 1];
  const p0 = i > 0 ? P[i - 1] : (P.head || null);
  const p3 = i + 2 < P.length ? P[i + 2] : (P.tail || null);
  const dist = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]));
  const d2 = dist(p1, p2);
  if (d2 < 1e-4) return [p1, p1, p2, p2];
  const d1 = p0 ? dist(p0, p1) : 0, d3 = p3 ? dist(p2, p3) : 0;
  const B = d2 * d2;
  let b1, b2;
  if (d1 < 1e-4) b1 = [p1[0] + (p2[0] - p1[0]) / 3, p1[1] + (p2[1] - p1[1]) / 3];
  else {
    const A = d1 * d1, k = 3 * d1 * (d1 + d2), m = 2 * A + 3 * d1 * d2 + B;
    b1 = [(A * p2[0] - B * p0[0] + m * p1[0]) / k, (A * p2[1] - B * p0[1] + m * p1[1]) / k];
  }
  if (d3 < 1e-4) b2 = [p2[0] - (p2[0] - p1[0]) / 3, p2[1] - (p2[1] - p1[1]) / 3];
  else {
    const Cc = d3 * d3, k = 3 * d3 * (d3 + d2), m = 2 * Cc + 3 * d3 * d2 + B;
    b2 = [(Cc * p1[0] - B * p3[0] + m * p2[0]) / k, (Cc * p1[1] - B * p3[1] + m * p2[1]) / k];
  }
  return [p1, b1, b2, p2];
}

const bez = ([a, b, c, d], t) => {
  const u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return [a[0] * w0 + b[0] * w1 + c[0] * w2 + d[0] * w3, a[1] * w0 + b[1] * w1 + c[1] * w2 + d[1] * w3];
};

// Arc length of each segment (sampled), cumulative within [i0, i1].
function segLengths(P, i0, i1, n = 10) {
  const out = [];
  for (let i = i0; i < i1; i++) {
    const s = segment(P, i), acc = [0];
    let prev = s[0];
    for (let k = 1; k <= n; k++) { const q = bez(s, k / n); acc.push(acc[k - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1])); prev = q; }
    out.push(acc);
  }
  return out;
}

// The point index that lies fraction f of the way *along the thread's length*
// from index i0 to i1 (integers). Drawing by length, not by point count,
// keeps the "pen" at an even speed through long runs and tight loops alike.
export function indexAtLength(P, i0, i1, f) {
  if (f <= 0) return i0;
  if (f >= 1) return i1;
  const L = segLengths(P, i0, i1);
  const total = L.reduce((a, acc) => a + acc[acc.length - 1], 0);
  let target = f * total;
  for (let j = 0; j < L.length; j++) {
    const acc = L[j], len = acc[acc.length - 1];
    if (target <= len) {
      const n = acc.length - 1;
      for (let k = 1; k <= n; k++) if (acc[k] >= target) {
        const t = (k - 1 + (target - acc[k - 1]) / Math.max(1e-6, acc[k] - acc[k - 1])) / n;
        return i0 + j + t;
      }
      return i0 + j + 1;
    }
    target -= len;
  }
  return i1;
}

// The first place the thread crosses itself between indices a and b:
// { u: index of the earlier (under) pass, v: the later pass, pt }. For
// drawing a knot's crossing with a small gap in the under strand.
export function findCrossing(P, a, b, n = 12) {
  const pts = [];
  for (let i = Math.floor(a); i < Math.ceil(b); i++) {
    const s = segment(P, i);
    for (let k = 0; k < n; k++) pts.push([bez(s, k / n), i + k / n]);
  }
  const hit = (p, q, r, s) => {
    const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
    if (Math.abs(d) < 1e-9) return null;
    const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
    const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
  };
  for (let i = 0; i < pts.length - 1; i++)
    for (let j = i + 3; j < pts.length - 1; j++) {
      const t = hit(pts[i][0], pts[i + 1][0], pts[j][0], pts[j + 1][0]);
      if (t != null) {
        const u = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
        return { u, v: pts[j][1], pt: [pts[i][0][0] + (pts[i + 1][0][0] - pts[i][0][0]) * t, pts[i][0][1] + (pts[i + 1][0][1] - pts[i][0][1]) * t] };
      }
    }
  return null;
}

// Pixels of thread per index unit around index u (for sizing small gaps).
export function pxPerIndex(P, u) {
  const i = Math.max(0, Math.min(P.length - 2, Math.floor(u)));
  const L = segLengths(P, i, i + 1, 6)[0];
  return L[L.length - 1];
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
