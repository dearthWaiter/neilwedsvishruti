import sharp from "sharp";
import { loadRaw, connectedComponents, morph, fillHoles, nonWhiteMask } from "./lib.mjs";

// Split a white-background sheet into items. Returns array of {box, buffer(rgba raw), w,h}
async function splitSheet(path, { closeR = 5, minAreaFrac = 0.004, thresh = 244, satThresh = 16 } = {}) {
  const { data, w, h, ch } = await loadRaw(path);
  let mask = nonWhiteMask(data, w, h, ch, thresh, satThresh);
  mask = morph(mask, w, h, closeR, true);   // dilate
  mask = morph(mask, w, h, closeR, false);  // erode -> close
  mask = fillHoles(mask, w, h);
  const { labels, boxes } = connectedComponents(mask, w, h, 8);
  const minArea = minAreaFrac * w * h;
  const items = boxes.filter(b => b.area >= minArea);
  return { items, labels, data, w, h, ch };
}

// reading order: cluster into rows by vertical overlap, sort rows top->bottom, items left->right
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

const sheets = [
  ["s3_icons", "../assets/s3_icons.png"],
  ["s4_icons", "../assets/s4_icons.png"],
  ["s5_icons", "../assets/s5_icons.png"],
  ["s6_icons", "../assets/s6_icons.png"],
  ["t1", "../assets/t1_haldi_sprites.png"],
  ["t2", "../assets/t2_marigolds.png"],
  ["clouds", "../assets/s2_clouds.png"],
];

for (const [name, path] of sheets) {
  const opts = name === "clouds" ? { closeR: 8, minAreaFrac: 0.01, thresh: 250, satThresh: 10 }
    : name.startsWith("t") ? { closeR: 4, minAreaFrac: 0.004 }
    : { closeR: 6, minAreaFrac: 0.006 };
  const { items, w, h } = await splitSheet(path, opts);
  const ordered = readingOrder(items);
  console.log(`${name}: ${ordered.length} items`);
  ordered.forEach((b, i) => console.log(`  #${i} x[${(b.minx/w*100).toFixed(0)}-${(b.maxx/w*100).toFixed(0)}] y[${(b.miny/h*100).toFixed(0)}-${(b.maxy/h*100).toFixed(0)}] area=${(b.area/(w*h)*100).toFixed(1)}%`));
}
