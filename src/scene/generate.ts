// Procedural sky → grass scene generation. Ported nearly verbatim from the design
// reference, locked to palette "riso", texture "grain".
// Pure: no DOM access, so it runs in a worker (OffscreenCanvas) or on the main thread.

type RGB = readonly [number, number, number];

export const P = {
  skyTop: [40, 108, 140],
  skyMid: [64, 132, 158],
  skyLow: [150, 196, 204],
  hi: [248, 240, 216],
  lit: [240, 230, 202],
  sh1: [186, 208, 204],
  sh2: [132, 178, 188],
  grassA: [112, 150, 96],
  grassB: [76, 120, 84],
  grassC: [156, 180, 112],
  ink: [34, 66, 58],
  bird: '#16323c',
} as const satisfies Record<string, RGB | string>;
export type Palette = typeof P;
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

const SEED = 5;

const rgb = (c: RGB, a?: number) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')';

function hash2(ix: number, iy: number, seed: number) {
  let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, seed: number, oct: number) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); a *= 0.5; f *= 2.03; }
  return s;
}
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
interface Exclusion { x: number; y: number; hw: number; hh: number }

// A cumulus is a pile of 3D spheres: big lobes stacked in columns, each sprouting smaller lobes on its upper/front surface.
function cumulus(r: Rng, cx: number, baseY: number, w: number, hgt: number, ex: Exclusion | null, lobe?: number, dome?: number) {
  const S: number[] = [];
  const grow = (x: number, y: number, z: number, rad: number, d: number) => {
    if (ex && Math.hypot(x - Math.max(ex.x - ex.hw, Math.min(x, ex.x + ex.hw)), y - Math.max(ex.y - ex.hh, Math.min(y, ex.y + ex.hh))) < rad + 16) return;
    S.push(x, y, z, rad);
    if (d <= 0 || rad < 6) return;
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.05 + 0.9 * r()), el = r() * 1.2, kk = rad * (0.7 + 0.35 * r()), ce = Math.cos(el);
      grow(x + Math.cos(a) * ce * kk, y + Math.sin(a) * ce * kk, z + Math.sin(el) * kk, rad * (0.4 + 0.3 * r()), d - 1);
    }
  };
  const cols = dome ? Math.max(6, Math.round(w / (hgt * 0.2))) : Math.max(3, Math.round(w / (hgt * 0.3)));
  for (let i = 0; i < cols; i++) {
    const f = (i + 0.5) / cols,
      env = dome ? Math.pow(Math.sin(Math.PI * f), 1.15) * (0.86 + 0.14 * r()) : Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * f)), 0.8) * (0.55 + 0.45 * r()),
      top = baseY - hgt * env,
      x = cx + (f - 0.5) * w;
    let rr = hgt * (0.13 + 0.08 * r()) * (lobe || 1), y = baseY - rr * 0.5;
    while (y - rr * 0.5 > top) { grow(x + (r() - 0.5) * rr, y, (r() - 0.5) * rr * 0.5, rr, 2); y -= rr * (0.65 + 0.35 * r()); rr *= 0.88 + 0.14 * r(); }
  }
  return S;
}

function splat(hb: Float32Array, LW: number, LH: number, S: number[]) {
  for (let i = 0; i < S.length; i += 4) {
    const cx = S[i], cy = S[i + 1], cz = S[i + 2] + 1000, rad = S[i + 3], r2 = rad * rad;
    const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(LW - 1, Math.ceil(cx + rad)), y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(LH - 1, Math.ceil(cy + rad));
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy, o = y * LW;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, d2 = dx * dx + dy * dy;
        if (d2 < r2) { const z = cz + Math.sqrt(r2 - d2); if (z > hb[o + x]) hb[o + x] = z; }
      }
    }
  }
}

// Light the height field from the upper left, warp it so no lobe stays a circle, and stipple between four flat tones.
function shade(hb: Float32Array, LW: number, LH: number, d: Uint8ClampedArray, seed: number, y0: number, y1: number, hz0: number, hz1: number) {
  const k = Math.max(0.6, LW / 1280), wf = 1 / (52 * k), amp = 11 * k, df = 1 / (15 * k), gw = Math.ceil(LW / 16), gh = Math.ceil(LH / 16), occ = new Uint8Array(gw * gh);
  for (let y = Math.max(0, y0 - 16); y < Math.min(LH, y1 + 16); y += 4) for (let x = 0; x < LW; x += 4) if (hb[y * LW + x]) {
    const gx = x >> 4, gy = y >> 4;
    for (let j = Math.max(0, gy - 1); j <= Math.min(gh - 1, gy + 1); j++) for (let i = Math.max(0, gx - 1); i <= Math.min(gw - 1, gx + 1); i++) occ[j * gw + i] = 1;
  }
  let s = seed * 7919 + 13;
  for (let y = y0; y < y1; y++) for (let x = 0; x < LW; x++) {
    if (!occ[(y >> 4) * gw + (x >> 4)]) continue;
    s = (Math.imul(s, 1664525) + 1013904223) | 0; const r1 = (s >>> 8) / 16777216;
    s = (Math.imul(s, 1664525) + 1013904223) | 0; const r2 = (s >>> 8) / 16777216;
    const sx = Math.round(x + (fbm(x * wf, y * wf, seed + 1, 2) - 0.44) * 2 * amp + (r1 - 0.5) * 3.4),
      sy = Math.round(y + (fbm(x * wf + 40, y * wf + 9, seed + 5, 2) - 0.44) * 2 * amp + (r2 - 0.5) * 3.4);
    if (sx < 2 || sy < 2 || sx > LW - 3 || sy > LH - 3) continue;
    const o = sy * LW + sx, h = hb[o]; if (!h) continue;
    const e = h - 12, hl = hb[o - 2] || e, hr = hb[o + 2] || e, hu = hb[o - 2 * LW] || e, hd = hb[o + 2 * LW] || e;
    const gx = (hr - hl) / 4, gy = (hd - hu) / 4;
    let v = (gx * 0.5 + gy * 0.68 + 0.53) / Math.sqrt(gx * gx + gy * gy + 1);
    v -= Math.max(0, Math.min(0.4, (hl + hr + hu + hd - 4 * h) * 0.035));
    v += (fbm(x * df, y * df, seed + 9, 3) - 0.44) * 0.5 + (r1 + r2 - 1) * 0.2;
    const t = v > 0.62 ? 0 : v > 0.3 ? 1 : v > -0.02 ? 2 : 3;
    const c = t === 0 ? P.hi : t === 1 ? P.lit : t === 2 ? P.sh1 : P.sh2;
    const hz = hz1 > hz0 ? Math.max(0, Math.min(1, (y - hz0) / (hz1 - hz0))) * 0.3 : 0, g = (r1 - 0.5) * 10, i = (y * LW + x) * 4;
    d[i] = c[0] + (P.skyLow[0] - c[0]) * hz + g; d[i + 1] = c[1] + (P.skyLow[1] - c[1]) * hz + g; d[i + 2] = c[2] + (P.skyLow[2] - c[2]) * hz + g; d[i + 3] = 255;
  }
}

function ground(wx: Ctx2D, TW: number, TH: number, crest: (x: number) => number, r: Rng, k: number) {
  const WH = TH * 2;
  wx.beginPath(); wx.moveTo(0, WH); for (let x = 0; x <= TW + 4; x += 4) wx.lineTo(x, crest(x)); wx.lineTo(TW, WH); wx.closePath();
  const g = wx.createLinearGradient(0, TH * 1.42, 0, WH); g.addColorStop(0, rgb(P.grassC)); g.addColorStop(0.3, rgb(P.grassA)); g.addColorStop(1, rgb(P.grassB));
  wx.fillStyle = g; wx.fill();
  wx.save(); wx.clip();
  for (let i = 0; i < 280; i++) {
    const x = r() * TW, f = r(), y = crest(x) + f * f * (WH - crest(x)), rw = (30 + 120 * r()) * k * (0.4 + f), rh = rw * (0.12 + 0.1 * r());
    wx.fillStyle = rgb(r() < 0.5 ? P.grassB : P.grassC, 0.1 + 0.14 * r()); wx.beginPath(); wx.ellipse(x, y, rw, rh, (r() - 0.5) * 0.2, 0, 6.2832); wx.fill();
  }
  wx.restore();
  const paths = [new Path2D(), new Path2D(), new Path2D()];
  const blade = (p: Path2D, x: number, y: number, len: number, lean: number) => { p.moveTo(x, y); p.quadraticCurveTo(x + lean * 0.2, y - len * 0.6, x + lean, y - len); };
  for (let f = 0; f < 1; f += 0.008 + 0.04 * f) {
    const size = (5 + 26 * f) * k, gap = (4 + 15 * f) * k;
    for (let x = -gap * r(); x < TW + gap; x += gap * (0.5 + r())) {
      const len = size * (0.6 + 0.8 * r());
      blade(paths[r() < 0.42 ? 0 : r() < 0.5 ? 1 : 2], x, crest(x) + f * (WH - crest(x)) + (r() - 0.5) * size * 0.6, len, (r() - 0.45) * len * 0.7);
    }
  }
  for (let x = 0; x < TW; x += (2 + 3 * r()) * k) { const len = (5 + 11 * r()) * k; blade(paths[r() < 0.6 ? 0 : 2], x, crest(x) + 2, len, (r() - 0.45) * len * 0.8); }
  wx.lineCap = 'round'; wx.lineWidth = 1.3 * k;
  wx.strokeStyle = rgb(P.grassB, 0.9); wx.stroke(paths[1]); wx.strokeStyle = rgb(P.grassC, 0.9); wx.stroke(paths[2]);
  wx.lineWidth = 1.05 * k; wx.strokeStyle = rgb(P.ink, 0.85); wx.stroke(paths[0]);
  wx.strokeStyle = 'rgba(250,240,232,.9)'; wx.lineWidth = 1.7 * k; wx.beginPath();
  for (let i = 0; i < 16; i++) {
    const f = 0.12 + 0.85 * r(), cx = r() * TW, cy = crest(cx) + f * (WH - crest(cx)), n = 8 + r() * 18, sp = (20 + 70 * f) * k;
    for (let j = 0; j < n; j++) {
      const x = cx + (r() - 0.5) * sp * 2.4, y = cy + (r() - 0.5) * sp * 0.35, a = r() * 3.14, l = (2 + 4 * f) * k;
      wx.moveTo(x, y); wx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5);
    }
  }
  wx.stroke();
}

export interface Bird { x: number; y: number; head: number; sc: number; delay: number; ph: number }
export interface Generated<C> { world: C; layer: C; TW: number; LW: number; M: number; birds: Bird[] }

/** Builds the 2×-tall world (sky, clouds, ground) and the parallax cloud layer for a w×h viewport. */
export function generate<C extends AnyCanvas>(w: number, h: number, makeCanvas: (w: number, h: number) => C): Generated<C> {
  const sc = Math.min(1, 1280 / w), TW = Math.round(w * sc), TH = Math.round(h * sc), WH = TH * 2, k = Math.max(0.6, TW / 1280), U = Math.min(TH, TW * 1.3);
  const seed = SEED, r = mulberry32(seed * 131 + 7);
  const crest = (x: number) => TH * (1.47 - 0.035 * Math.sin((x / TW) * 3.3 + 0.5) + 0.012 * Math.sin((x / TW) * 9 + 2));
  const world = makeCanvas(TW, WH);
  const wx = world.getContext('2d') as Ctx2D | null;
  if (!wx) throw new Error('2D canvas unavailable');
  const img = wx.createImageData(TW, WH), d = img.data, mix = (a: number, b: number, t: number) => a + (b - a) * t;
  let s = seed * 9973 + 1;
  for (let y = 0; y < WH; y++) {
    const f = y / WH, a = Math.min(1, f / 0.55), b = Math.max(0, Math.min(1, (f - 0.55) / 0.2));
    const cr = mix(mix(P.skyTop[0], P.skyMid[0], a), P.skyLow[0], b), cg = mix(mix(P.skyTop[1], P.skyMid[1], a), P.skyLow[1], b), cb = mix(mix(P.skyTop[2], P.skyMid[2], a), P.skyLow[2], b);
    for (let x = 0; x < TW; x++) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      const g = (((s >>> 9) & 255) / 255) * 22 - 11, i = (y * TW + x) * 4;
      d[i] = cr + g; d[i + 1] = cg + g; d[i + 2] = cb + g; d[i + 3] = 255;
    }
  }
  const hb = new Float32Array(TW * WH), y0 = Math.floor(TH * 0.97), y1 = Math.ceil(TH * 1.56);
  ([[0.55, 1.53, 1.05, 0.26], [0.53, 1.42, 0.46, 0.34], [0.05, 1.52, 0.4, 0.14]] as const).forEach(q => splat(hb, TW, WH, cumulus(r, TW * q[0], TH * q[1], TW * q[2], U * q[3], null)));
  shade(hb, TW, WH, d, seed, y0, y1, TH * 1.2, TH * 1.5);
  wx.putImageData(img, 0, 0);
  ground(wx, TW, TH, crest, r, k);
  const gy0 = Math.floor(TH * 1.36), gi = wx.getImageData(0, gy0, TW, WH - gy0), gd = gi.data;
  for (let x = 0; x < TW; x++) {
    const top = Math.max(0, Math.floor(crest(x) - 22 * k) - gy0);
    for (let y = top; y < WH - gy0; y++) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      const g = (((s >>> 9) & 255) / 255) * 26 - 13, i = (y * TW + x) * 4;
      gd[i] += g; gd[i + 1] += g; gd[i + 2] += g;
    }
  }
  wx.putImageData(gi, 0, gy0);

  // Foreground cloud layer, with an exclusion box around the title so text stays clear.
  const M = Math.round(28 * k), LW = TW + 2 * M, LH = Math.round(TH * 1.5), lay = makeCanvas(LW, LH);
  const lx = lay.getContext('2d') as Ctx2D | null;
  if (!lx) throw new Error('2D canvas unavailable');
  const li = lx.createImageData(LW, LH), hb2 = new Float32Array(LW * LH);
  const ex = { x: LW / 2, y: TH / 2, hw: Math.min(w * 0.46, 300) * sc, hh: 124 * sc };
  const layerClouds: ReadonlyArray<readonly [number, number, number, number, number?, number?]> = [
    [0.14, 1.27, 0.56, 0.72], [0.88, 1.22, 0.5, 0.74], [0.52, 1.42, 0.6, 0.44], [0.18, 0.3, 0.2, 0.19, 1.7, 1], [0.8, 0.15, 0.32, 0.085, 0, 2],
  ];
  layerClouds.forEach(q => {
    const cl = cumulus(r, LW * q[0], TH * q[1], TW * q[2], U * q[3], ex, q[4]);
    if (q[5] === 1) return; // generated (to keep the RNG sequence) but not drawn
    splat(hb2, LW, LH, cl);
    if (q[5] === 2) {
      // Top-left cloud: a copy of the top-right one, shifted, stretched and enlarged.
      const c2 = cl.slice();
      for (let i = 0; i < c2.length; i += 4) { c2[i] -= LW * 0.6; c2[i + 1] = TH * q[1] + (c2[i + 1] - TH * q[1]) * 1.5; c2[i + 2] *= 1.25; c2[i + 3] *= 1.25; }
      splat(hb2, LW, LH, c2);
    }
  });
  shade(hb2, LW, LH, li.data, seed + 3, 0, LH, 0, 0);
  lx.putImageData(li, 0, 0);

  const u = Math.max(0.5, Math.min(1.25, Math.min(w / 1280, h / 760))), birds: Bird[] = [];
  for (let i = 0; i < 7; i++) birds.push({ x: 0.4 + i * 0.025 + (r() - 0.5) * 0.02, y: 0.27 - i * 0.021 + (r() - 0.5) * 0.05, head: -0.45 + (r() - 0.5) * 0.5, sc: (1.1 + r() * 0.5) * u, delay: r(), ph: r() * 6.28 });
  [[0.77, 0.71], [0.805, 0.78], [0.838, 0.7]].forEach(q => birds.push({ x: q[0] + (r() - 0.5) * 0.02, y: q[1] + (r() - 0.5) * 0.02, head: -2.5 + (r() - 0.5) * 0.7, sc: (1.1 + r() * 0.5) * u, delay: r(), ph: r() * 6.28 }));
  return { world, layer: lay, TW, LW, M, birds };
}
