// Composite the re-cut kids onto Screen 1 at their true position/scale, at a
// 390px CSS viewport rendered at device pixel ratios 1x, 2x and 3x, so the real
// on-screen sharpness is visible. Portrait canvas 390x844 (the brief's target).
import sharp from "sharp";
import fs from "fs";
const m = JSON.parse(fs.readFileSync("public/img/manifest.json", "utf8"));

const VW = 390, VH = 844;
// Screen 1 shows the plate as a full-height cover. The plate is 2:3 (1080x1620).
// cover-fit into 390x844: scale by height -> width overflows and is centre-cropped.
async function place(dpr) {
  const W = VW * dpr, H = VH * dpr;
  const plateSrc = "public/" + m["s1_plate@1080"].file;
  const pm = m["s1_plate@1080"];
  // cover fit
  const scale = Math.max(W / pm.w, H / pm.h);
  const pw = Math.round(pm.w * scale), ph = Math.round(pm.h * scale);
  const bg = await sharp(plateSrc).resize(pw, ph).toBuffer();
  const offX = Math.round((pw - W) / 2), offY = Math.round((ph - H) / 2);
  const base = sharp(bg).extract({ left: offX, top: offY, width: W, height: H });

  const comps = [];
  for (const k of ["s1_boy", "s1_girl"]) {
    const b = m[k].srcBox;
    // the kid's box in plate-image space -> then into the covered/cropped canvas
    const kxImg = (b.minx / b.imgW) * pw, kyImg = (b.miny / b.imgH) * ph;
    const kw = ((b.maxx - b.minx) / b.imgW) * pw, kh = ((b.maxy - b.miny) / b.imgH) * ph;
    const kbuf = await sharp("public/" + m[k].file).resize(Math.round(kw), Math.round(kh)).toBuffer();
    comps.push({ input: kbuf, left: Math.round(kxImg - offX), top: Math.round(kyImg - offY) });
  }
  const out = await base.composite(comps).png().toBuffer();
  // label
  const lbl = Buffer.from(`<svg width="${W}" height="28"><rect width="${W}" height="28" fill="rgba(0,0,0,0.6)"/><text x="8" y="19" font-family="monospace" font-size="14" fill="#fff">390px CSS @ ${dpr}x DPR = ${W}x${H} device px</text></svg>`);
  return sharp(out).composite([{ input: lbl, left: 0, top: 0 }]).png().toBuffer();
}

const cols = [];
for (const dpr of [1, 2, 3]) cols.push(await place(dpr));
// place side by side at common display height
const H = VH;
const scaled = await Promise.all(cols.map(c => sharp(c).resize({ height: H }).extend({ right: 12, background: { r: 20, g: 20, b: 20 } }).toBuffer()));
const metas = await Promise.all(scaled.map(s => sharp(s).metadata()));
const totalW = metas.reduce((a, mt) => a + mt.width, 0);
const comps = [];
let x = 0;
for (let i = 0; i < scaled.length; i++) { comps.push({ input: scaled[i], left: x, top: 0 }); x += metas[i].width; }
await sharp({ create: { width: totalW, height: H, channels: 3, background: { r: 20, g: 20, b: 20 } } })
  .composite(comps).png().toFile("pipeline_out/kids_actual_size.png");
console.log("wrote pipeline_out/kids_actual_size.png");
