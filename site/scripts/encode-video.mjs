// Encode the frames from record.mjs into status-ready MP4s:
//   neil-vishruti-full.mp4         the whole scroll-through
//   neil-vishruti-part-1-of-2.mp4  \  each under 60s, for WhatsApp / Instagram
//   neil-vishruti-part-2-of-2.mp4  /  status, cut on a card's pause
// Music starts at the tap (as on the site) with a 2s fade in, and fades out.
//
//   node scripts/encode-video.mjs <framesDir> <outDir> [music.mp3]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [FRAMES, OUT, MUSIC = "../assets/music.mp3"] = process.argv.slice(2);
const T = JSON.parse(fs.readFileSync(path.join(FRAMES, "timing.json"), "utf8"));
const LIMIT = 59; // status clips are capped at 60s
fs.mkdirSync(OUT, { recursive: true });

const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" });
const video = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
const audio = ["-c:a", "aac", "-b:a", "192k"];

// the full video, music delayed to the tap
const full = path.join(OUT, "neil-vishruti-full.mp4");
const dur = T.seconds, tap = T.tapAt;
ff([
  "-framerate", String(T.fps), "-i", path.join(FRAMES, "f%05d.jpg"),
  "-i", MUSIC,
  "-filter_complex",
  `[1:a]atrim=0:${(dur - tap).toFixed(3)},afade=t=in:d=2,afade=t=out:st=${(dur - tap - 3).toFixed(3)}:d=3,adelay=${Math.round(tap * 1000)}|${Math.round(tap * 1000)},apad[a]`,
  "-map", "0:v", "-map", "[a]", "-t", dur.toFixed(3), ...video, ...audio, full,
]);

// two parts, cut in the middle of the pause nearest the halfway mark (so the
// cut lands on a still frame), keeping each part under LIMIT
const mid = dur / 2;
const cuts = T.holds.map((h) => h.at + h.hold / 2).filter((c) => c <= LIMIT && dur - c <= LIMIT);
if (!cuts.length) throw new Error("no pause lets both parts fit under the limit");
const cut = cuts.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
const parts = [[0, cut], [cut, dur]];
parts.forEach(([a, b], i) => {
  const out = path.join(OUT, `neil-vishruti-part-${i + 1}-of-2.mp4`);
  const len = b - a;
  ff([
    "-ss", a.toFixed(3), "-t", len.toFixed(3), "-i", full,
    "-af", `afade=t=in:d=${i ? 0.8 : 0.01},afade=t=out:st=${(len - 1.5).toFixed(3)}:d=1.5`,
    "-map", "0:v", "-map", "0:a", ...video, ...audio, out,
  ]);
});

for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith(".mp4")).sort()) {
  const p = path.join(OUT, f);
  const d = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).toString().trim();
  console.log(`${f}  ${(+d).toFixed(1)}s  ${(fs.statSync(p).size / 1e6).toFixed(1)}MB`);
}
console.log(`cut at ${cut.toFixed(2)}s`);
