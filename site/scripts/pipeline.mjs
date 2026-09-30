// Asset pipeline for the Neil & Vishruti wedding site.
// Inputs: ../assets/*.png  Outputs: public/img/*  + img/manifest.json
// Cutouts (people): produced by rembg (see run_rembg_human.py) then refined here.
// Icons / sprites / clouds: split by connected components + recursive valley split.
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { loadRaw, connectedComponents, morph, fillHoles, nonWhiteMask } from "./lib.mjs";

const ASSETS = "../assets";
const OUT = "public/img";
const REMBG = "pipeline_out/rembg_h"; // human_seg cutouts
fs.mkdirSync(OUT, { recursive: true });

const manifest = {};
function record(name, file, meta) {
  manifest[name] = { file: "img/" + path.basename(file), ...meta };
}

// ---------------------------------------------------------------------------
// Recursive valley split: separate icons that connected components merged
// because a light bridge (garland, moss) links them. Splits a bbox by the
// deepest interior row/column valley when it is much emptier than its flanks.
// ---------------------------------------------------------------------------
function densityProfile(mask, w, box, axis) {
  const { minx, maxx, miny, maxy } = box;
  if (axis === "x") {
    const prof = new Array(maxx - minx + 1).fill(0);
    for (let y = miny; y <= maxy; y++)
      for (let x = minx; x <= maxx; x++)
        if (mask[y * w + x]) prof[x - minx]++;
    return prof;
  } else {
    const prof = new Array(maxy - miny + 1).fill(0);
    for (let y = miny; y <= maxy; y++)
      for (let x = minx; x <= maxx; x++)
        if (mask[y * w + x]) prof[y - miny]++;
    return prof;
  }
}

// find a good cut index in a profile: interior minimum whose value is < ratio
// of the smaller flanking peak, with real mass on both sides.
// Split only on a valley that is BOTH deep (much emptier than both flanks) AND
// mass-balanced (each side holds a real share) so we never slice thin slivers.
function findCut(prof, ratio = 0.36, margin = 0.2, minSideFrac = 0.28) {
  const n = prof.length;
  const lo = Math.floor(n * margin), hi = Math.ceil(n * (1 - margin));
  if (hi - lo < 4) return -1;
  const total = prof.reduce((a, b) => a + b, 0);
  let best = -1, bestVal = Infinity;
  for (let i = lo; i <= hi; i++) {
    if (prof[i] < bestVal) { bestVal = prof[i]; best = i; }
  }
  let leftPeak = 0, rightPeak = 0, leftMass = 0, rightMass = 0;
  for (let i = 0; i < best; i++) { leftPeak = Math.max(leftPeak, prof[i]); leftMass += prof[i]; }
  for (let i = best + 1; i < n; i++) { rightPeak = Math.max(rightPeak, prof[i]); rightMass += prof[i]; }
  const flank = Math.min(leftPeak, rightPeak);
  if (flank === 0) return -1;
  if (bestVal > ratio * flank) return -1;
  if (leftMass < minSideFrac * total || rightMass < minSideFrac * total) return -1;
  return best;
}

function splitBox(mask, w, h, box, depth = 0) {
  if (depth > 3) return [box];
  const bw = box.maxx - box.minx, bh = box.maxy - box.miny;
  // try the longer axis first
  const tryAxes = bw >= bh ? ["x", "y"] : ["y", "x"];
  for (const axis of tryAxes) {
    const prof = densityProfile(mask, w, box, axis);
    const cut = findCut(prof);
    if (cut < 0) continue;
    if (axis === "x") {
      const xc = box.minx + cut;
      const a = { minx: box.minx, maxx: xc - 1, miny: box.miny, maxy: box.maxy };
      const b = { minx: xc + 1, maxx: box.maxx, miny: box.miny, maxy: box.maxy };
      return [...splitBox(mask, w, h, a, depth + 1), ...splitBox(mask, w, h, b, depth + 1)];
    } else {
      const yc = box.miny + cut;
      const a = { minx: box.minx, maxx: box.maxx, miny: box.miny, maxy: yc - 1 };
      const b = { minx: box.minx, maxx: box.maxx, miny: yc + 1, maxy: box.maxy };
      return [...splitBox(mask, w, h, a, depth + 1), ...splitBox(mask, w, h, b, depth + 1)];
    }
  }
  return [box];
}

// tighten a box to the actual mask content inside it
function tighten(mask, w, box) {
  let minx = box.maxx, maxx = box.minx, miny = box.maxy, maxy = box.miny, area = 0;
  for (let y = box.miny; y <= box.maxy; y++)
    for (let x = box.minx; x <= box.maxx; x++)
      if (mask[y * w + x]) {
        area++;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
  if (area === 0) return null;
  return { minx, maxx, miny, maxy, area };
}

function readingOrder(items) {
  const sorted = [...items].sort((a, b) => a.miny - b.miny);
  const rows = [];
  for (const it of sorted) {
    const cy = (it.miny + it.maxy) / 2;
    let row = rows.find(r => cy >= r.top && cy <= r.bot);
    if (!row) { row = { top: it.miny, bot: it.maxy, items: [] }; rows.push(row); }
    row.top = Math.min(row.top, it.miny); row.bot = Math.max(row.bot, it.maxy);
    row.items.push(it);
  }
  rows.sort((a, b) => a.top - b.top);
  const out = [];
  for (const r of rows) { r.items.sort((a, b) => a.minx - b.minx); out.push(...r.items); }
  return out;
}

// ---------------------------------------------------------------------------
// Split a white-background sheet and export named items.
// spec: { names:[...], closeR, minAreaFrac, thresh, satThresh, maxDim, prefix, circleFor }
// ---------------------------------------------------------------------------
async function splitSheet(file, spec) {
  const src = path.join(ASSETS, file);
  const { data, w, h, ch } = await loadRaw(src);
  let mask = nonWhiteMask(data, w, h, ch, spec.thresh ?? 244, spec.satThresh ?? 16);
  const cr = spec.closeR ?? 3;
  mask = morph(mask, w, h, cr, true);
  mask = morph(mask, w, h, cr, false);
  mask = fillHoles(mask, w, h);
  const { boxes } = connectedComponents(mask, w, h, 8);
  const minArea = (spec.minAreaFrac ?? 0.006) * w * h;
  let comps = boxes.filter(b => b.area >= minArea);
  // recursive valley split of each component, then tighten
  let leaves = [];
  for (const c of comps) {
    for (const lb of splitBox(mask, w, h, c)) {
      const t = tighten(mask, w, lb);
      if (t && t.area >= minArea * 0.5) leaves.push(t);
    }
  }
  const ordered = readingOrder(leaves);

  // load full-res original RGB for cropping
  const origBuf = await sharp(src).removeAlpha().raw().toBuffer();
  const results = [];
  const names = spec.names || ordered.map((_, i) => `${spec.prefix}_${i}`);
  for (let i = 0; i < ordered.length; i++) {
    const box = ordered[i];
    const name = names[i] || `${spec.prefix}_${i}`;
    const pad = Math.round((spec.padFrac ?? 0.02) * w);
    const x0 = Math.max(0, box.minx - pad), y0 = Math.max(0, box.miny - pad);
    const x1 = Math.min(w - 1, box.maxx + pad), y1 = Math.min(h - 1, box.maxy + pad);
    const cw = x1 - x0 + 1, chh = y1 - y0 + 1;
    // build alpha for this item: mask limited to this box, feathered
    const alpha = Buffer.alloc(cw * chh);
    const rgb = Buffer.alloc(cw * chh * 3);
    for (let y = 0; y < chh; y++)
      for (let x = 0; x < cw; x++) {
        const sx = x0 + x, sy = y0 + y;
        const inBox = sx >= box.minx && sx <= box.maxx && sy >= box.miny && sy <= box.maxy;
        alpha[y * cw + x] = inBox && mask[sy * w + sx] ? 255 : 0;
        const si = (sy * w + sx) * 3, di = (y * cw + x) * 3;
        rgb[di] = origBuf[si]; rgb[di + 1] = origBuf[si + 1]; rgb[di + 2] = origBuf[si + 2];
      }
    // feather alpha (soft 1-2px edge)
    // single-object items: drop any stray fragment of a neighbour bled into the
    // padded box (clouds globally; specific icons via keepLargestFor).
    if (spec.keepLargest || (spec.keepLargestFor && spec.keepLargestFor(name))) {
      const bin = new Uint8Array(cw * chh);
      for (let p = 0; p < cw * chh; p++) bin[p] = alpha[p] > 0 ? 1 : 0;
      const cc = connectedComponents(bin, cw, chh, 8);
      const largest = cc.boxes.sort((a, b) => b.area - a.area)[0];
      if (largest) for (let p = 0; p < cw * chh; p++) if (cc.labels[p] !== largest.id) alpha[p] = 0;
    }
    const featherSigma = spec.circleFor && spec.circleFor(name) ? 0 : 1.1;
    let alphaBuf;
    if (featherSigma > 0) {
      alphaBuf = await sharp(alpha, { raw: { width: cw, height: chh, channels: 1 } })
        .blur(featherSigma).toColourspace("b-w").raw().toBuffer();
    } else {
      alphaBuf = alpha; // already single channel
    }

    // compose rgba
    let rgba = Buffer.alloc(cw * chh * 4);
    for (let p = 0; p < cw * chh; p++) {
      rgba[p * 4] = rgb[p * 3]; rgba[p * 4 + 1] = rgb[p * 3 + 1];
      rgba[p * 4 + 2] = rgb[p * 3 + 2]; rgba[p * 4 + 3] = alphaBuf[p];
    }
    let outW = cw, outH = chh;

    // special case: circular cameo (tattoo), cut from the sheet itself so the
    // circle can reach past the item's own mask, then cropped to the circle
    if (spec.circleFor && spec.circleFor(name)) {
      ({ rgba, size: outW } = circleCameo(origBuf, w, h, box));
      outH = outW;
    }

    const maxDim = spec.maxDim ?? 400;
    const outFile = path.join(OUT, name + ".webp");
    await sharp(rgba, { raw: { width: outW, height: outH, channels: 4 } })
      .resize({ width: outW > outH ? maxDim : null, height: outH >= outW ? maxDim : null, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90 })
      .toFile(outFile);
    const om = await sharp(outFile).metadata();
    record(name, outFile, { w: om.width, h: om.height, kind: spec.kind });
    results.push({ name, box, file: outFile });
  }
  return results;
}

// Circular soft-edged cameo centred on the butterfly: the circle is sized from
// the tattoo's own dark ink (not the item's box), so it holds just the
// butterfly and a margin of skin, and nothing of the neighbouring icon.
function circleCameo(img, W, H, box) {
  // the butterfly is the biggest patch of solid ink: dark pixels, joined up
  const bw = box.maxx - box.minx + 1, bh = box.maxy - box.miny + 1;
  let ink = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const i = ((y + box.miny) * W + x + box.minx) * 3;
      ink[y * bw + x] = (img[i] + img[i + 1] + img[i + 2]) / 3 < 55 ? 1 : 0;
    }
  ink = morph(ink, bw, bh, 5, true);
  const fly = connectedComponents(ink, bw, bh, 8).boxes.sort((a, b) => b.area - a.area)[0];
  const [minx, maxx, miny, maxy] = fly
    ? [fly.minx + box.minx, fly.maxx + box.minx, fly.miny + box.miny, fly.maxy + box.miny]
    : [box.minx, box.maxx, box.miny, box.maxy];
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
  const R = Math.round(Math.max(maxx - minx, maxy - miny) / 2 * 1.2);
  const soft = R * 0.14, size = 2 * R;
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sx = Math.round(cx - R + x), sy = Math.round(cy - R + y), o = (y * size + x) * 4;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const d = Math.hypot(x - R, y - R);
      const i = (sy * W + sx) * 3;
      // the white sheet around the forearm goes transparent too
      const lum = (img[i] + img[i + 1] + img[i + 2]) / 3;
      const skin = Math.min(1, Math.max(0, (246 - lum) / 14));
      const a = (d > R ? 0 : d > R - soft ? (R - d) / soft : 1) * skin;
      rgba[o] = img[i]; rgba[o + 1] = img[i + 1]; rgba[o + 2] = img[i + 2]; rgba[o + 3] = Math.round(a * 255);
    }
  return { rgba, size };
}

// ---------------------------------------------------------------------------
// People cutouts: refine rembg output (trim stray alpha, feather, tight crop)
// ---------------------------------------------------------------------------
async function refineCutout(id, name, opts = {}) {
  const src = path.join(REMBG, `${id}_r.png`);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  // binary from alpha
  let m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  // clean: open (erode+dilate) to drop specks, keep large components
  m = morph(m, w, h, 2, false);
  m = morph(m, w, h, 2, true);
  const { labels, boxes } = connectedComponents(m, w, h, 8);
  const big = boxes.filter(b => b.area > 0.002 * w * h).sort((a, b) => b.area - a.area);
  const keep = opts.keep ?? 1;
  const kept = big.slice(0, keep);
  const keepIds = new Set(kept.map(b => b.id));
  const clean = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) clean[i] = keepIds.has(labels[i]) ? 1 : 0;
  const filled = fillHoles(clean, w, h);
  return exportCutoutFromMask(data, filled, w, h, name, opts);
}

async function exportCutoutFromMask(rgbaData, mask, w, h, name, opts = {}) {
  // bbox
  let minx = w, maxx = 0, miny = h, maxy = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
  if (maxx < minx) throw new Error("empty cutout " + name);
  const pad = Math.round(0.01 * w);
  minx = Math.max(0, minx - pad); miny = Math.max(0, miny - pad);
  maxx = Math.min(w - 1, maxx + pad); maxy = Math.min(h - 1, maxy + pad);
  const cw = maxx - minx + 1, chh = maxy - miny + 1;
  // feathered alpha from mask, but keep rembg's soft alpha where mask is set
  const bin = Buffer.alloc(cw * chh);
  for (let y = 0; y < chh; y++)
    for (let x = 0; x < cw; x++)
      bin[y * cw + x] = mask[(miny + y) * w + (minx + x)] ? 255 : 0;
  const feath = await sharp(bin, { raw: { width: cw, height: chh, channels: 1 } }).blur(1.0).toColourspace("b-w").raw().toBuffer();
  const rgba = Buffer.alloc(cw * chh * 4);
  for (let y = 0; y < chh; y++)
    for (let x = 0; x < cw; x++) {
      const si = ((miny + y) * w + (minx + x)) * 4, di = (y * cw + x) * 4;
      rgba[di] = rgbaData[si]; rgba[di + 1] = rgbaData[si + 1]; rgba[di + 2] = rgbaData[si + 2];
      // combine feathered shape with rembg alpha (min keeps soft hair edges tidy)
      const ra = rgbaData[si + 3];
      rgba[di + 3] = Math.min(ra, feath[y * cw + x]);
    }
  // full-res webp at up to 1080 wide
  const outFile = path.join(OUT, name + ".webp");
  await sharp(rgba, { raw: { width: cw, height: chh, channels: 4 } })
    .resize({ width: Math.min(cw, opts.maxW ?? 1080), withoutEnlargement: true })
    .webp({ quality: 84, alphaQuality: 92 })
    .toFile(outFile);
  const om = await sharp(outFile).metadata();
  record(name, outFile, { w: om.width, h: om.height, kind: "cutout", srcBox: { minx, miny, maxx, maxy, imgW: w, imgH: h } });
  return { name, box: { minx, miny, maxx, maxy }, w, h };
}

// s1: split the two kids into boy (left) and girl (right)
async function refineS1() {
  // cut from the 4x Real-ESRGAN upscale so the kids stay crisp on the first screen
  const src = path.join(REMBG, `s1_x4_r.png`);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  let m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  m = morph(m, w, h, 2, false); m = morph(m, w, h, 2, true);
  const { labels, boxes } = connectedComponents(m, w, h, 8);
  const big = boxes.filter(b => b.area > 0.001 * w * h).sort((a, b) => (a.minx + a.maxx) - (b.minx + b.maxx));
  // expect two components; left = boy, right = girl. If merged into one, split at x midpoint gap.
  let boyIds, girlIds;
  if (big.length >= 2) {
    boyIds = new Set([big[0].id]); girlIds = new Set([big[big.length - 1].id]);
  } else {
    boyIds = new Set(); girlIds = new Set(); // handled below by x split
  }
  const boyMask = new Uint8Array(w * h), girlMask = new Uint8Array(w * h);
  if (big.length >= 2) {
    for (let i = 0; i < w * h; i++) {
      if (boyIds.has(labels[i])) boyMask[i] = 1;
      else if (girlIds.has(labels[i])) girlMask[i] = 1;
    }
  } else {
    // fallback: split at overall centroid x
    let sx = 0, n = 0;
    for (let i = 0; i < w * h; i++) if (m[i]) { sx += i % w; n++; }
    const midx = sx / n;
    for (let i = 0; i < w * h; i++) if (m[i]) { (i % w < midx ? boyMask : girlMask)[i] = 1; }
  }
  const r1 = await exportCutoutFromMask(data, fillHoles(boyMask, w, h), w, h, "s1_boy", {});
  const r2 = await exportCutoutFromMask(data, fillHoles(girlMask, w, h), w, h, "s1_girl", {});
  return [r1, r2];
}

// s5 special case: human_seg captures only the bride (the groom's cream
// sherwani blends into the white marble temple). Recover the groom from the
// master-minus-plate diff in a tight left box and union with the bride.
async function refineS5Couple() {
  const W = 1024, H = 1536;
  const mb = await sharp(path.join(ASSETS, "s5_master.png")).removeAlpha().raw().toBuffer();
  const pb = await sharp(path.join(ASSETS, "s5_plate.png")).removeAlpha().raw().toBuffer();
  const { data: hs } = await sharp(path.join(REMBG, "s5_r.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bride = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) bride[i] = hs[i * 4 + 3] > 128 ? 1 : 0;
  const diff = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const j = i * 3;
    const d = Math.abs(mb[j] - pb[j]) + Math.abs(mb[j + 1] - pb[j + 1]) + Math.abs(mb[j + 2] - pb[j + 2]);
    diff[i] = d > 50 ? 1 : 0;
  }
  const gx0 = (0.13 * W) | 0, gx1 = (0.53 * W) | 0, gy0 = (0.53 * H) | 0, gy1 = (0.89 * H) | 0;
  const gb = new Uint8Array(W * H);
  for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) gb[y * W + x] = diff[y * W + x];
  let gm = morph(gb, W, H, 3, true); gm = morph(gm, W, H, 6, false); gm = morph(gm, W, H, 4, true);
  const { labels, boxes } = connectedComponents(gm, W, H, 8);
  const groom = boxes.sort((a, b) => b.area - a.area)[0];
  let u = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) u[i] = (bride[i] || labels[i] === groom.id) ? 1 : 0;
  u = fillHoles(u, W, H);
  // build an rgba buffer (master RGB) for export
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = mb[i * 3]; rgba[i * 4 + 1] = mb[i * 3 + 1]; rgba[i * 4 + 2] = mb[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
  return exportCutoutFromMask(rgba, u, W, H, "s5_couple", { maxW: 1080 });
}

// ---------------------------------------------------------------------------
// Full-bleed backgrounds: plates + sky, at 750 and 1080 wide.
// ---------------------------------------------------------------------------
async function exportFullbleed(file, name) {
  // an explicit path (upscaled source) is used as-is; a bare name resolves in assets/
  const src = file.includes("/") ? file : path.join(ASSETS, file);
  for (const wdt of [750, 1080]) {
    const budget = wdt === 1080 ? 220 * 1024 : 130 * 1024;
    const outFile = path.join(OUT, `${name}-${wdt}.webp`);
    let q = 80, size = Infinity;
    for (let attempt = 0; attempt < 6; attempt++) {
      await sharp(src).resize({ width: wdt }).webp({ quality: q, effort: 6 }).toFile(outFile);
      size = fs.statSync(outFile).size;
      if (size <= budget || q <= 60) break;
      q -= 5;
    }
    const om = await sharp(outFile).metadata();
    record(`${name}@${wdt}`, outFile, { w: om.width, h: om.height, kind: "fullbleed", kb: Math.round(size / 1024), q });
  }
}

// ---------------------------------------------------------------------------
const S3_ICONS = {
  prefix: "s3_icon", kind: "icon", closeR: 6, minAreaFrac: 0.006, maxDim: 400,
  names: ["s3_boardgame", "s3_science", "s3_bottle_dumbbell", "s3_dog", "s3_tattoo"],
  circleFor: (n) => n === "s3_tattoo",
};

async function main() {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  // full paintings (couple included), shown instead of cut-outs in Part A
  if (only === "masters") {
    Object.assign(manifest, JSON.parse(fs.readFileSync(path.join(OUT, "manifest.json"), "utf8")));
    for (const id of ["s3", "s4", "s5", "s6", "s7"]) { await exportFullbleed(`${id}_master.png`, `${id}_master`); console.log("  " + id + "_master"); }
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
    return;
  }
  // one plate re-exported after its painting was regenerated, e.g. --only=plate:s5
  if (only?.startsWith("plate:")) {
    Object.assign(manifest, JSON.parse(fs.readFileSync(path.join(OUT, "manifest.json"), "utf8")));
    const id = only.slice(6);
    await exportFullbleed(`${id}_plate.png`, `${id}_plate`);
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
    return console.log("  " + id + "_plate");
  }
  if (only === "s3icons") {
    Object.assign(manifest, JSON.parse(fs.readFileSync(path.join(OUT, "manifest.json"), "utf8")));
    await splitSheet("s3_icons.png", S3_ICONS);
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
    return console.log("s3 icons re-cut");
  }
  console.log("== full-bleed backgrounds ==");
  const plates = {
    s1_plate: "s1_plate.png", s2_sky: "s2_sky.png",
    s3_plate: "s3_plate.png", s4_plate: "s4_plate.png",
    s5_plate: "s5_plate.png", s6_plate: "s6_plate.png",
    s7_plate: "s7_plate.png",
    s1_hands: "tools/up/s1_hands_x2.png", s8_hands: "tools/up/s8_hands_x2.png",
    s7_master: "s7_master.png",
  };
  // s1_plate from the 4x upscale too (sharper 1080 downscale than the 1024 original)
  plates.s1_plate = "tools/up/s1_plate_x4.png";
  for (const [name, file] of Object.entries(plates)) { await exportFullbleed(file, name); console.log("  " + name); }

  console.log("== people cutouts ==");
  await refineS1(); console.log("  s1_boy, s1_girl");
  for (const id of ["s3", "s4", "s6", "s7"]) {
    await refineCutout(id, `${id}_couple`, { keep: 1, maxW: 1080 });
    console.log("  " + id + "_couple");
  }
  await refineS5Couple(); console.log("  s5_couple (bride+groom recovered)");

  console.log("== icon sheets ==");
  await splitSheet("s3_icons.png", S3_ICONS);
  console.log("  s3 icons");
  await splitSheet("s4_icons.png", {
    prefix: "s4_icon", kind: "icon", closeR: 6, minAreaFrac: 0.006, maxDim: 400,
    names: ["s4_wine_cheese", "s4_gown", "s4_srilanka", "s4_guitar", "s4_mushrooms"],
    keepLargestFor: (n) => n === "s4_mushrooms",
  });
  console.log("  s4 icons");
  await splitSheet("s5_icons.png", {
    prefix: "s5_icon", kind: "icon", closeR: 2, minAreaFrac: 0.01, maxDim: 400,
    names: ["s5_temple", "s5_saibaba", "s5_bhog", "s5_gate", "s5_havan"],
    keepLargestFor: (n) => n === "s5_havan",
  });
  console.log("  s5 icons");
  await splitSheet("s6_icons.png", {
    prefix: "s6_icon", kind: "icon", closeR: 6, minAreaFrac: 0.006, maxDim: 400,
    names: ["s6_clocktower", "s6_bangalore", "s6_balcony", "s6_pondicherry"],
  });
  console.log("  s6 icons");

  console.log("== sprites ==");
  await splitSheet("t1_haldi_sprites.png", { prefix: "t1_petal", kind: "sprite", closeR: 4, minAreaFrac: 0.004, maxDim: 160 });
  await splitSheet("t2_marigolds.png", { prefix: "t2_marigold", kind: "sprite", closeR: 4, minAreaFrac: 0.004, maxDim: 160 });
  console.log("  sprites done");

  console.log("== clouds ==");
  await splitSheet("s2_clouds.png", { prefix: "cloud", kind: "cloud", closeR: 2, minAreaFrac: 0.01, thresh: 252, satThresh: 8, maxDim: 700,
    keepLargest: true, names: ["cloud_0", "cloud_1", "cloud_2", "cloud_3"] });
  console.log("  clouds done");

  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nmanifest: ${Object.keys(manifest).length} entries -> ${path.join(OUT, "manifest.json")}`);
}

main().catch(e => { console.error(e); process.exit(1); });
