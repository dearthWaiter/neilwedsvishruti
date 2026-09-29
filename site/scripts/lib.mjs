import sharp from "sharp";

// ---------- generic raw helpers ----------
export async function loadRaw(path, w, h) {
  let img = sharp(path).removeAlpha();
  if (w && h) img = img.resize(w, h);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

// Connected-components labelling on a boolean mask (4/8-connectivity). Returns
// {labels:Int32Array, boxes:[{id,minx,maxx,miny,maxy,area}]}
export function connectedComponents(mask, w, h, connectivity = 8) {
  const labels = new Int32Array(w * h).fill(0);
  const boxes = [];
  const stack = new Int32Array(w * h);
  let next = 1;
  const neigh8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  const neigh4 = [[0,-1],[-1,0],[1,0],[0,1]];
  const neigh = connectivity === 8 ? neigh8 : neigh4;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || labels[i]) continue;
    const id = next++;
    let sp = 0;
    stack[sp++] = i;
    labels[i] = id;
    let minx = w, maxx = 0, miny = h, maxy = 0, area = 0;
    while (sp > 0) {
      const p = stack[--sp];
      const px = p % w, py = (p / w) | 0;
      area++;
      if (px < minx) minx = px; if (px > maxx) maxx = px;
      if (py < miny) miny = py; if (py > maxy) maxy = py;
      for (const [dx, dy] of neigh) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const np = ny * w + nx;
        if (mask[np] && !labels[np]) { labels[np] = id; stack[sp++] = np; }
      }
    }
    boxes.push({ id, minx, maxx, miny, maxy, area });
  }
  return { labels, boxes };
}

// Binary dilation / erosion with a square kernel of given radius.
export function morph(mask, w, h, radius, dilate = true) {
  if (radius <= 0) return mask.slice();
  // separable: horizontal then vertical
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const test = dilate ? 1 : 0; // dilate: any neighbor set; erode: any neighbor unset
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let hit = dilate ? 0 : 1;
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= w) { if (!dilate) { hit = 0; break; } continue; }
        const v = mask[y * w + xx];
        if (dilate && v) { hit = 1; break; }
        if (!dilate && !v) { hit = 0; break; }
      }
      tmp[y * w + x] = hit;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let hit = dilate ? 0 : 1;
      for (let k = -radius; k <= radius; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= h) { if (!dilate) { hit = 0; break; } continue; }
        const v = tmp[yy * w + x];
        if (dilate && v) { hit = 1; break; }
        if (!dilate && !v) { hit = 0; break; }
      }
      out[y * w + x] = hit;
    }
  }
  return out;
}

// Fill holes: flood fill background from borders on !mask; anything not reached is a hole.
export function fillHoles(mask, w, h) {
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    if (bg[p] || mask[p]) continue;
    bg[p] = 1;
    const px = p % w, py = (p / w) | 0;
    if (px > 0) stack.push(p - 1);
    if (px < w - 1) stack.push(p + 1);
    if (py > 0) stack.push(p - w);
    if (py < h - 1) stack.push(p + w);
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = mask[i] || !bg[i] ? 1 : 0;
  return out;
}

// Build an alpha mask from a "non-white" test for icon/sprite sheets on white.
// Returns Uint8Array mask (1 = content).
export function nonWhiteMask(data, w, h, ch, thresh = 244, satThresh = 18) {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    // content if it is not near-white: either dark-ish or saturated
    if (mx < thresh || (mx - mn) > satThresh) mask[i] = 1;
  }
  return mask;
}
