import sharp from "sharp";
import fs from "fs";
const m = JSON.parse(fs.readFileSync("public/img/manifest.json", "utf8"));
const MAG = { r: 255, g: 0, b: 255 };

function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

async function tile(name, cell, label) {
  const file = "public/" + m[name].file;
  const img = await sharp(file).resize(cell - 16, cell - 40, { fit: "contain", background: { ...MAG, alpha: 1 } }).flatten({ background: MAG }).png().toBuffer();
  const svg = Buffer.from(
    `<svg width="${cell}" height="${cell}"><rect width="${cell}" height="${cell}" fill="rgb(255,0,255)"/>` +
    `<rect x="1" y="1" width="${cell-2}" height="${cell-2}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>` +
    `<text x="${cell/2}" y="${cell-12}" font-family="monospace" font-size="12" fill="#000" text-anchor="middle">${esc(label)}</text></svg>`);
  return sharp(svg).composite([{ input: img, left: 8, top: 8 }]).png().toBuffer();
}

async function sheet(names, cell, cols, outfile, title) {
  const rows = Math.ceil(names.length / cols);
  const W = cols * cell, H = rows * cell + 34;
  const titleSvg = Buffer.from(`<svg width="${W}" height="34"><rect width="${W}" height="34" fill="#111"/><text x="10" y="23" font-family="monospace" font-size="16" fill="#fff">${esc(title)} (${names.length})</text></svg>`);
  const comps = [{ input: titleSvg, left: 0, top: 0 }];
  for (let i = 0; i < names.length; i++) {
    const t = await tile(names[i], cell, names[i]);
    comps.push({ input: t, left: (i % cols) * cell, top: 34 + Math.floor(i / cols) * cell });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: MAG } }).composite(comps).png().toFile(outfile);
  console.log("wrote " + outfile + " (" + names.length + " items)");
}

const byKind = (k) => Object.keys(m).filter(n => m[n].kind === k);

await sheet(byKind("cutout"), 240, 4, "pipeline_out/contact_cutouts.png", "People cutouts");
await sheet(byKind("icon"), 200, 5, "pipeline_out/contact_icons.png", "Icons");
await sheet(byKind("sprite"), 130, 8, "pipeline_out/contact_sprites.png", "Sprites (t1 petals + t2 marigolds)");
await sheet(byKind("cloud"), 260, 4, "pipeline_out/contact_clouds.png", "Clouds");
