// usage: node scripts/sheet.mjs out.png h a.png b.png ...  (labels = file names)
import sharp from "sharp";
import path from "node:path";
const [out, hs, ...files] = process.argv.slice(2);
const H = +hs, tiles = []; let x = 0;
for (const f of files) {
  const b = await sharp(f).resize({ height: H }).toBuffer({ resolveWithObject: true });
  const lab = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${b.info.width}" height="22"><rect width="100%" height="22" fill="#000a"/><text x="6" y="16" font-size="14" font-family="sans-serif" fill="#ff0">${path.basename(f, ".png")}</text></svg>`);
  tiles.push({ input: b.data, left: x, top: 0 }, { input: lab, left: x, top: 0 });
  x += b.info.width + 10;
}
await sharp({ create: { width: x - 10, height: H, channels: 3, background: "#222" } }).composite(tiles).png().toFile(out);
