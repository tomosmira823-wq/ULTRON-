// draws the ✱ asterisk icon in Kivo green on a dark metal tile
const { PNG } = require('pngjs'); const fs = require('fs');
const S = 512, png = new PNG({ width: S, height: S });
const set = (x, y, r, g, b, a) => { const i = (y * S + x) * 4; png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = a; };
const R = 96, c = S / 2;
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const dx = Math.max(0, Math.abs(x - c) - (c - R - 16)), dy = Math.max(0, Math.abs(y - c) - (c - R - 16));
  const inTile = dx * dx + dy * dy <= R * R;
  if (!inTile) { set(x, y, 0, 0, 0, 0); continue; }
  const t = y / S, base = 38 - t * 16 + ((x % 3) ? 0 : 3);
  let r = base, g = base + 3, b = base + 4;
  // asterisk: 6 arms
  let best = 1e9; const px = x - c, py = y - c, len = 150;
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a); const p = Math.max(0, Math.min(len, px * ux + py * uy)); const d = Math.hypot(px - ux * p, py - uy * p); best = Math.min(best, d); }
  const w = 30;
  if (best < w) { r = 70; g = 255; b = 154; }
  else if (best < w + 26) { const k = 1 - (best - w) / 26; r += (70 - r) * k * 0.35; g += (255 - g) * k * 0.35; b += (154 - b) * k * 0.35; }
  set(x, y, r | 0, g | 0, b | 0, 255);
}
fs.writeFileSync('build/icon.png', PNG.sync.write(png));
