// Stage 4 extras: pre-blurred plates (Part B backdrops) and bright light spots
// (fairy lights, diya flames) measured from the plates.
import sharp from "sharp";
import fs from "node:fs";

const man = JSON.parse(fs.readFileSync("public/img/manifest.json", "utf8"));

// 1. blurred, slightly darkened plates. Small: they are soft by design.
const BLUR_SRC = { s7m: "s7_master", s1: "s1_plate", s2: "s2_sky" }; // s1/s2: desktop backdrop only
for (const s of ["s3", "s4", "s5", "s6", "s7m", "s1", "s2"]) {
  // s7m: the Prayagraj master (couple included), the RSVP's backdrop
  const src = `public/img/${BLUR_SRC[s] || s + "_plate"}-750.webp`;
  const out = `img/${BLUR_SRC[s] || s + "_plate"}_blur.webp`;
  await sharp(src).resize(540).blur(10).webp({ quality: 60 }).toFile(`public/${out}`);
  const kb = Math.round(fs.statSync(`public/${out}`).size / 1024);
  man[`${BLUR_SRC[s] || s + "_plate"}_blur`] = { file: out, w: 540, h: 810, kind: "blur", kb };
  console.log(out, kb + "KB");
}
fs.writeFileSync("public/img/manifest.json", JSON.stringify(man, null, 2));

// 2. light spots: small, very bright blobs in a region of the plate
async function spots(key, region, { thr, maxArea, hueWarm, flame = false, minDist = 0.03, max = 60 }) {
  const { data, info } = await sharp(`public/img/${key}-1080.webp`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, seen = new Uint8Array(W * H), res = [];
  const lit = (i) => {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (flame) return r > 250 && g > 215 && b > 120 && b < 215; // white-hot flame core
    return l > thr && (!hueWarm || (r > 220 && b < 170 && r >= b + 70));
  };
  const [x0, y0, x1, y1] = region.map((v, i) => Math.round(v * (i % 2 ? H : W)));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * W + x;
    if (seen[i] || !lit(i)) continue;
    const q = [i]; seen[i] = 1; let n = 0, sx = 0, sy = 0;
    while (q.length) {
      const j = q.pop(); n++; sx += j % W; sy += (j / W) | 0;
      for (const k of [j - 1, j + 1, j - W, j + W]) if (k >= 0 && k < W * H && !seen[k] && lit(k)) { seen[k] = 1; q.push(k); }
    }
    if (n >= 3 && n <= maxArea) res.push([+(sx / n / W).toFixed(4), +(sy / n / H).toFixed(4), n]);
  }
  // keep the brightest-biggest first, spaced out, capped
  res.sort((a, b) => b[2] - a[2]);
  const keep = [];
  for (const p of res) {
    if (keep.length >= max) break;
    if (keep.every((q) => Math.hypot(p[0] - q[0], (p[1] - q[1]) * 1.5) > minDist)) keep.push(p);
  }
  return keep.map(([u, v]) => [u, v]);
}
const lights = {
  s4: await spots("s4_plate", [0, 0.58, 1, 0.8], { thr: 200, maxArea: 260, hueWarm: true }),
  s5: await spots("s5_plate", [0, 0.55, 1, 1], { thr: 0, maxArea: 600, flame: true, minDist: 0.04, max: 14 }),
  // sun glints on the Sangam (river area only) for the water shimmer
  s7: await spots("s7_plate", [0, 0.43, 1, 0.64], { thr: 238, maxArea: 300, minDist: 0.035, max: 46 }),
  s6: await spots("s6_plate", [0, 0.38, 1, 0.7], { thr: 225, maxArea: 200, hueWarm: true, minDist: 0.035, max: 50 }),
};
for (const k in lights) console.log(k, lights[k].length, "spots");
// s5's diya flames are measured by hand (marigolds and marble glare fool the
// detector), so keep whatever is already in lights.json for s5.
const prev = fs.existsSync("src/lights.json") ? JSON.parse(fs.readFileSync("src/lights.json", "utf8")) : {};
if (prev.s5) lights.s5 = prev.s5;
fs.writeFileSync("src/lights.json", JSON.stringify(lights));

// overlay for eyeballing
for (const k in lights) {
  const circles = lights[k].map(([u, v]) => `<circle cx="${u * 1080}" cy="${v * 1620}" r="9" fill="none" stroke="#0ff" stroke-width="2"/>`).join("");
  const full = await sharp(`public/img/${k}_plate-1080.webp`).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1620">${circles}</svg>`) }]).png().toBuffer();
  await sharp(full).resize(540).png().toFile(`pipeline_out/dbg_lights_${k}.png`);
}
