// Token bucket: an isometric figure of a token dispenser that is a rate limiter.
//
//   node build.mjs           → ../../public/figures/token-bucket.html (light, for the blog)
//   node build.mjs --dark    → token-bucket-dark.html beside this script (for checking)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import * as M from "./model.mjs";

const SKILL = join(homedir(), ".claude/skills/anatomy");
const k = await import(join(SKILL, "kit/iso-kit.mjs"));
const { kitScript } = await import(join(SKILL, "scripts/inline-kit.mjs"));

const HERE = dirname(fileURLToPath(import.meta.url));
const dark = process.argv.includes("--dark");
const theme = dark ? "dark" : "light";

const WIDTH = 600;
const HEIGHT = 340;

// ---------- world (plate top at z = 0) ----------
const PLATE = { x: -102, y: -46, w: 212, d: 104, r: 8 };
const PLATE_H = 10, FOOT_H = 5;
const RAIL_Y = 20, RAIL_TOP = 4.4;
const REQ = { x: -5.5, y: -6, w: 11, d: 12, r: 1.4 }, REQ_H = 7;          // a request, centred on (x, RAIL_Y)
const C = [0, -14];                                                          // the column's axis: the gate is at x = 0
const COIN_R = 6.5, COIN_H = 2.8, SLOT = 3, STACK_Z = 12.4;
const HOUSING = { x: -13, y: -27, w: 26, d: 22, r: 2 };
const ROD_R = 8.3, CAGE_TOP = 39.2, PLATE_TOP = 41.8;
const D = [-25, -14], DISC_R = 31, POCKET_R = 25, DISC_Z = [45.6, 48.6];       // feed wheel: pocket circle passes over C
const GEARBOX = { x: -39, y: -28, w: 22, d: 24, r: 2 }, GEAR_H = 20;
const PIN = [-19.5, -14], PIN_REST = 39.6, PIN_LOCK = 45.6;
const HOPPER = [-50, -14], HOPPER_R = 9.4, HOPPER_Z = [49.2, 68];
const HPOST = [-50, -39];
const CHANNEL = { x: -7, y: -5, w: 14, d: 15, r: 0.6 };
// Diverter: an arm on a pivot behind the rail. Out, it lies across the rail at DIV_ANGLE and steers a refused request into the 429 box.
const DIV = [14, 10.6], DIV_LEN = 26, DIV_ANGLE = Math.atan(0.625);
const DIV_BOX = { x: 9.4, y: -3, w: 12, d: 9, r: 1.4 };
const FEEDER = { x: -96, y: 9, w: 18, d: 22, r: 2 }, FEEDER_H = 28;
const OUTBOX = { x: 86, y: 8, w: 20, d: 24, r: 2 }, OUTBOX_H = 24;
const SLOT_C = [DIV[0] + 2 + (44 - RAIL_Y) / 0.625, 44];                       // where a diverted request reaches the slot
const REJECT = { x: 32, y: 31, w: 50, d: 24, r: 2 }, REJECT_H = RAIL_TOP;   // its top is flush with the chute bed
const SLOT_PLAN = { x: SLOT_C[0] - 8.5, y: SLOT_C[1] - 7.5, w: 17, d: 15, r: 1.2 };
const RATE_KNOB = [-82, 25], REFILL_KNOB = [-32, -9];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [HOPPER[0], HOPPER[1], HOPPER_Z[1] + 6], [HPOST[0], HPOST[1], 62]],
  WIDTH, HEIGHT, { pad: 22, azimuth: 58 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const plan = (x, y, w, d, r = 1) => ({ x, y, w, d, r });

// ---------- base ----------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 18))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4.5), 0, P, 8), { tone: "lo" }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dt(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Ruler along the front of the rail.
  const strip = plan(-74, 29.4, 100, 5);
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 4, strip.y + 0.6, 0.6, [1.6, 3.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // Label plate.
  const label = plan(-95, 38, 18, 14, 1.4);
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  [[4, 10], [4, 7], [4, 9]].forEach(([x0, len], i) => out.push(L(k.lineOnTop([label.x + x0, label.y + 4 + i * 3], [label.x + x0 + len, label.y + 4 + i * 3], 0.8, P), { tone: "lo", free: true })));
  out.push(Dt([at([label.x + 2.6, label.y + 2.6, 0.8]), at([label.x + label.w - 2.6, label.y + label.d - 2.6, 0.8])], { size: 0.4 }));
  return out.join("");
}

function rails() {
  const out = [];
  for (let x = -72; x <= 82; x += 14) out.push(S(k.slabOf(plan(x - 2, 11, 4, 18, 0.6), 0, 1.4, P, 2), { tone: "lo", crease: "none" }));
  for (const y of [RAIL_Y - 6.6, RAIL_Y + 4.2]) {
    out.push(S(k.slabOf(plan(-78, y, 166, 2.4, 0.6), 1.4, RAIL_TOP - 1.4, P, 2, 0.3), { tone: "mid" }));
  }
  return out.join("");
}

// ---------- the feed: hopper, wheel, gearbox ----------
function gearbox() {
  const out = [];
  out.push(S(k.slabOf(GEARBOX, 0, GEAR_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(GEARBOX, 6, P, 4), { tone: "faint" }) }));
  out.push(Dt(k.corners(GEARBOX, 2.8).map(([x, y]) => at([x, y, GEAR_H])), { size: 0.45 }));
  // Refill-rate knob with its scale: 1, 2, 4 tokens per second.
  const [kx, ky] = REFILL_KNOB;
  out.push(S(k.cylinder(kx, ky, 5.4, GEAR_H, 0.6, P, 32), { tone: "lo", crease: "none" }));
  const t = k.radialTicks(kx, ky, 5.2, 4, 2, GEAR_H + 0.6, [0.8, 1.6], P, knobA(0), Math.PI);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(S(k.cylinder(kx, ky, 3.4, GEAR_H + 0.6, 4, P, 24, 0.3), { tone: "mid", crease: "lo" }));
  out.push(L(k.knurl(kx, ky, 3.4, GEAR_H + 1.8, GEAR_H + 4.6, 22, P, 0.3), { tone: "lo" }));
  out.push(`<path data-part="refill-pointer" class="iso-line" data-tone="hi" data-free="end" d="${pointerD([kx, ky], GEAR_H + 4.6, refillShare(2))}" style="stroke-width:.8"/>`);
  // Column bearing.
  out.push(S(k.cylinder(D[0], D[1], 6.4, GEAR_H, 2, P, 32), { tone: "mid" }));
  // Stop-pin guide.
  out.push(S(k.cylinder(PIN[0], PIN[1], 2.6, GEAR_H, 1.6, P, 20), { tone: "mid" }));
  return out.join("");
}
function knobA(share) { return (225 * Math.PI) / 180 + share * Math.PI; }   // radialTicks angle: 0 → screen-left-ish, 1 → half a turn on
function refillShare(rate) { return M.REFILLS.indexOf(rate) / (M.REFILLS.length - 1); }
function pointerD([cx, cy], z, share) {
  const a = knobA(share), ux = Math.sin(a), uy = -Math.cos(a);
  return k.lineOnTop([cx + ux * 0.9, cy + uy * 0.9], [cx + ux * 3, cy + uy * 3], z, P);
}

function pinSvg() {
  return S(k.cylinder(PIN[0], PIN[1], 1.4, GEAR_H + 1.6, PIN_REST - GEAR_H - 1.6, P, 16), { tone: "hi", crease: "none" }) +
    S(k.cylinder(PIN[0], PIN[1], 1.9, PIN_REST - 1.2, 1.2, P, 16), { tone: "hi" });
}

function column() {
  return S(k.cylinder(D[0], D[1], 3.6, GEAR_H + 2, DISC_Z[0] - GEAR_H - 2, P, 24), { tone: "mid", crease: "none", inner: L(k.sideArc(D[0], D[1], 3.6, 32, P, 12), { tone: "faint" }) });
}

function hopperPost() {
  const out = [];
  out.push(S(k.cylinder(HPOST[0], HPOST[1], 4.6, 0, 1.6, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(HPOST[0], HPOST[1], 2.4, 1.6, 60.4, P, 18), { tone: "mid", crease: "none" }));
  return out.join("");
}

function hopper() {
  const out = [];
  const [hx, hy] = HOPPER;
  out.push(S(k.slabOf(plan(hx - 2, HPOST[1], 4, HOPPER[1] - HOPPER_R - HPOST[1] + 1, 0.8), 58, 3, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(hx, hy, HOPPER_R, HOPPER_Z[0], HOPPER_Z[1] - HOPPER_Z[0], P, 48, 0.6), { tone: "mid", inner: L([52, 60].map((z) => k.sideArc(hx, hy, HOPPER_R, z, P, 32)).join(""), { tone: "faint" }) }));
  out.push(S(k.cylinder(hx, hy, HOPPER_R + 0.6, HOPPER_Z[1], 1.6, P, 48, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(hx, hy, 2.6, HOPPER_Z[1] + 1.6, 3, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(hx, hy, 2.6, HOPPER_Z[1] + 1.6, HOPPER_Z[1] + 4.6, 16, P), { tone: "lo" }));
  out.push(Dt([0, 90, 180, 270].map((d) => at([hx + Math.cos((d + 45) * Math.PI / 180) * 7.4, hy + Math.sin((d + 45) * Math.PI / 180) * 7.4, HOPPER_Z[1] + 1.6])), { size: 0.4 }));
  return out.join("");
}

// ---------- the column (the bucket) ----------
function housing() {
  const out = [];
  out.push(S(k.slabOf(HOUSING, 0, STACK_Z, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(HOUSING, 4, P, 4), { tone: "faint" }) }));
  out.push(Dt(k.corners(HOUSING, 2.6).map(([x, y]) => at([x, y, STACK_Z])), { size: 0.45 }));
  out.push(L(k.ring(C[0], C[1], ROD_R + 1.6, STACK_Z, P, 40), { tone: "faint" }));
  return out.join("");
}
const RODS = [45, 135, 225, 315].map((d) => [C[0] + Math.cos(d * Math.PI / 180) * ROD_R, C[1] + Math.sin(d * Math.PI / 180) * ROD_R]);
const rodSvg = ([x, y]) => S(k.cylinder(x, y, 0.9, STACK_Z, CAGE_TOP - STACK_Z, P, 12), { tone: "mid", crease: "none" });
const behind = (p) => k.depthOf([p[0], p[1], 0], P) < k.depthOf([C[0], C[1], 0], P);

function gaugePost() {
  // A flat gauge post beside the column: one tick per token, a long tick at 0, 4 and 8.
  const post = plan(C[0] + 9.2, C[1] - 1.2, 2.4, 2.4, 0.4);
  const out = [S(k.slabOf(post, STACK_Z, CAGE_TOP - STACK_Z, P, 2), { tone: "mid" })];
  const face = post.y + post.d, edge = post.x + post.w;
  const ticks = [];
  for (let i = 0; i <= M.CAPACITY; i++) {
    const z = STACK_Z + i * SLOT;
    const len = i % 4 === 0 ? 2 : 1.1;
    ticks.push({ d: k.segment([edge, face, z], [edge - len, face, z], P), big: i % 4 === 0 });
  }
  out.push(L(ticks.filter((t) => !t.big).map((t) => t.d).join(""), { tone: "lo" }), L(ticks.filter((t) => t.big).map((t) => t.d).join(""), { tone: "mid" }));
  return out.join("");
}

function topPlate() {
  const out = [];
  out.push(S(k.cylinder(C[0], C[1], ROD_R + 2.8, CAGE_TOP, PLATE_TOP - CAGE_TOP, P, 48, 0.5), { tone: "mid" }));
  out.push(L(k.ring(C[0], C[1], COIN_R + 0.8, PLATE_TOP, P, 40), { tone: "lo" }));
  out.push(Dt(RODS.map(([x, y]) => at([x, y, PLATE_TOP])), { size: 0.4 }));
  return out.join("");
}

function discSvg() {
  return S(k.cylinder(D[0], D[1], DISC_R, DISC_Z[0], DISC_Z[1] - DISC_Z[0], P, 96, 0.6), { tone: "mid", inner: L(k.sideArc(D[0], D[1], DISC_R, DISC_Z[0] + 1.4, P, 48), { tone: "faint" }) }) +
    L(k.ring(D[0], D[1], 5, DISC_Z[1], P, 24), { tone: "lo" }) + Dt([at([D[0], D[1], DISC_Z[1]])], { size: 0.5, tone: "mid" });
}

// ---------- gate: channel, kicker ----------
function channelBack() {
  return S(k.slabOf(CHANNEL, 9.6, 2.8, P, 2), { tone: "mid", crease: "none" }) +
    S(k.slabOf(plan(CHANNEL.x - 1.4, CHANNEL.y, 1.4, CHANNEL.d, 0.4), 9.6, 5, P, 2), { tone: "mid" });
}
function channelFront() {
  return S(k.slabOf(plan(CHANNEL.x + CHANNEL.w, CHANNEL.y, 1.4, CHANNEL.d, 0.4), 9.6, 5, P, 2), { tone: "mid" });
}
function diverterBase() {
  // Actuator box behind the rail, a link out to the pivot post, and the post the arm turns on.
  return S(k.slabOf(DIV_BOX, 0, 12, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(DIV_BOX, 4, P, 3), { tone: "faint" }) }) +
    Dt(k.corners(DIV_BOX, 2.2).map(([x, y]) => at([x, y, 12])), { size: 0.4 }) +
    S(k.slabOf(plan(DIV[0] - 1.6, DIV_BOX.y + DIV_BOX.d, 3.2, DIV[1] - DIV_BOX.y - DIV_BOX.d, 0.6), 4, 3, P, 2), { tone: "mid", crease: "none" }) +
    S(k.cylinder(DIV[0], DIV[1], 2.4, 0, RAIL_TOP + REQ_H + 1, P, 20, 0.3), { tone: "mid" }) +
    L(k.ring(DIV[0], DIV[1], 1, RAIL_TOP + REQ_H + 1, P, 12), { tone: "lo" });
}

// ---------- feeder, boxes, counters ----------
function feeder() {
  const out = [];
  out.push(S(k.slabOf(FEEDER, 0, FEEDER_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(FEEDER, 3, P, 4), { tone: "faint" }) }));
  // Card well on top, with the edges of the waiting cards.
  const well = plan(FEEDER.x + 3, FEEDER.y + 3, 10, 12, 1);
  out.push(L(k.planOutline(well, FEEDER_H, P, 4), { tone: "lo" }));
  for (let i = 1; i < 4; i++) out.push(L(k.lineOnTop([well.x, well.y + i * 3], [well.x + well.w, well.y + i * 3], FEEDER_H, P), { tone: "faint" }));
  // The exit slot on the +x face, where requests come out onto the rail.
  const fx = FEEDER.x + FEEDER.w;
  const slot = [[fx, RAIL_Y - 7.4, RAIL_TOP - 0.6], [fx, RAIL_Y + 7.4, RAIL_TOP - 0.6], [fx, RAIL_Y + 7.4, RAIL_TOP + REQ_H + 1.6], [fx, RAIL_Y - 7.4, RAIL_TOP + REQ_H + 1.6]];
  out.push(`<path class="tb-void" d="M${slot.map((p) => at(p).join(" ")).join("L")}Z"/>`);
  out.push(L(`M${slot.map((p) => at(p).join(" ")).join("L")}Z`, { tone: "lo" }));
  // Traffic knob: requests per second.
  const [kx, ky] = RATE_KNOB;
  out.push(S(k.cylinder(kx, ky, 5.4, FEEDER_H, 0.6, P, 32), { tone: "lo", crease: "none" }));
  const t = k.radialTicks(kx, ky, 5.2, 8, 4, FEEDER_H + 0.6, [0.8, 1.6], P, knobA(0), Math.PI);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(S(k.cylinder(kx, ky, 3.4, FEEDER_H + 0.6, 4, P, 24, 0.3), { tone: "mid", crease: "lo" }));
  out.push(L(k.knurl(kx, ky, 3.4, FEEDER_H + 1.8, FEEDER_H + 4.6, 22, P, 0.3), { tone: "lo" }));
  out.push(`<path data-part="rate-pointer" class="iso-line" data-tone="hi" data-free="end" d="${pointerD([kx, ky], FEEDER_H + 4.6, 0)}" style="stroke-width:.8"/>`);
  return out.join("");
}

function counterWindow(cx, cy, z, part) {
  const win = plan(cx - 6.4, cy - 3.2, 12.8, 6.4, 1.2);
  return S(k.slabOf(win, z, 0.5, P, 3), { tone: "lo", crease: "none" }) +
    `<path class="tb-void" d="${k.planOutline(k.insetPlan(win, 1), z + 0.5, P, 3)}"/>` +
    L(k.planOutline(k.insetPlan(win, 1), z + 0.5, P, 3), { tone: "lo" }) +
    k.faceTextSvg(k.topMatrix([cx, cy + 1.7], z + 0.5, P, "x"), "000", { size: 4.2, tone: "hi", anchor: "middle" }).replace("<text ", `<text data-part="${part}" `);
}

function outbox() {
  const out = [];
  out.push(S(k.slabOf(OUTBOX, 0, OUTBOX_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(OUTBOX, 3, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(OUTBOX, 2.4), OUTBOX_H, P, 4), { tone: "faint" }));
  out.push(counterWindow(OUTBOX.x + OUTBOX.w / 2, OUTBOX.y + 15, OUTBOX_H, "passed"));
  out.push(Dt(k.corners(OUTBOX, 3.6).map(([x, y]) => at([x, y, OUTBOX_H])), { size: 0.4 }));
  return out.join("");
}

/** A rectangle on the floor, centred on (cx, cy), long side along angle a. */
function rotatedRect(cx, cy, a, len, half) {
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [cx + ux * s * len / 2 + vx * t * half, cy + uy * s * len / 2 + vy * t * half]);
}
function chute() {
  // The bed a diverted request slides across, from the rail's front edge onto the 429 box.
  const a = DIV_ANGLE, from = 25.4, to = 35.4;   // x where the bed starts and ends along the request's path
  const y = (x) => RAIL_Y + (x - DIV[0] - 2) * Math.tan(a);
  const len = (to - from) / Math.cos(a);
  const ring = rotatedRect((from + to) / 2, (y(from) + y(to)) / 2, a, len, 7.6);
  return S(k.extrude(ring, 0, RAIL_TOP, P, { bevel: 0.3 }), { tone: "mid", crease: "faint" });
}

function rejectBox() {
  const out = [];
  out.push(S(k.slabOf(REJECT, 0, REJECT_H, P, 4, 0.6), { tone: "mid" }));
  out.push(`<path class="tb-void" d="${k.planOutline(SLOT_PLAN, REJECT_H, P, 3)}"/>`);
  out.push(L(k.planOutline(SLOT_PLAN, REJECT_H, P, 3), { tone: "lo" }));
  out.push(counterWindow(REJECT.x + REJECT.w - 9, REJECT.y + 15.6, REJECT_H, "refused"));
  // The box's one engraved label: the status code a refused request gets back.
  out.push(k.faceTextSvg(k.topMatrix([REJECT.x + REJECT.w - 9, REJECT.y + 7.8], REJECT_H, P, "x"), "429", { size: 4.4, tone: "lo", anchor: "middle" }));
  out.push(Dt([at([REJECT.x + 2.6, REJECT.y + 2.6, REJECT_H]), at([REJECT.x + REJECT.w - 2.6, REJECT.y + REJECT.d - 2.6, REJECT_H])], { size: 0.4 }));
  return out.join("");
}

// ---------- moving parts, built at the origin and moved with translateAlong ----------
const COIN_SVG = S(k.cylinder(C[0], C[1], COIN_R, 0, COIN_H, P, 40, 0.4), { tone: "hi", crease: "lo", lit: true }) + L(k.ring(C[0], C[1], COIN_R - 1.6, COIN_H, P, 32), { tone: "lo" });
const REQUEST_SVG =
  S(k.slabOf(REQ, RAIL_TOP, REQ_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(REQ, RAIL_TOP + 2.4, P, 3), { tone: "faint" }) }) +
  L(k.onTop([[REQ.x + 0.6, REQ.y + 0.6], [0, 1.4], [REQ.x + REQ.w - 0.6, REQ.y + 0.6]], RAIL_TOP + REQ_H, P), { tone: "lo" });
// A coin riding on an accepted request, built centred on the request's own origin.
const RIDE_SVG = S(k.cylinder(0, 0, COIN_R - 1, RAIL_TOP + REQ_H, COIN_H - 0.6, P, 36, 0.4), { tone: "hi", crease: "lo", lit: true });

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A token dispenser that works as a rate limiter. A feed wheel drops brass tokens into a column that holds eight, at a steady refill rate, and stops when the column is full. Requests slide along a rail past a gate: each one that finds a token takes one from the bottom of the column and goes on to the served box; when the column is empty, a diverter arm swings across the rail and steers the request into the 429 box.",
  body: [
    base(),
    rails(),
    hopperPost(),
    gearbox(),
    `<g data-part="pin">${pinSvg()}</g>`,
    column(),
    housing(),
    RODS.filter(behind).map(rodSvg).join(""),
    `<g data-part="stack"></g>`,
    gaugePost(),
    RODS.filter((p) => !behind(p)).map(rodSvg).join(""),
    topPlate(),
    `<g data-part="drop"></g>`,
    discSvg(),
    `<g data-part="pockets"></g>`,
    hopper(),
    channelBack(),
    `<g data-part="eject"></g>`,
    channelFront(),
    diverterBase(),
    `<g data-part="arm"></g>`,
    feeder(),
    chute(),
    `<g data-part="rail"></g>`,
    rejectBox(),
    `<g data-part="kicked"></g>`,
    outbox(),
  ],
});

// ---------- card ----------
const controls = `<div class="tb-controls" role="group" aria-label="Traffic">
${Object.entries(M.RATES).map(([name, rate]) => `<button type="button" class="tb-btn" data-rate="${name}">${name[0].toUpperCase() + name.slice(1)}<span class="tb-sub">${rate}/s</span></button>`).join("")}
<button type="button" class="tb-btn" data-burst>Burst<span class="tb-sub">×${M.BURST}</span></button>
<button type="button" class="tb-btn" data-refill>Refill<span class="tb-sub" data-refill-label>2/s</span></button>
</div>`;

const CSS = `
.tb-void{fill:var(--tb-void)}
.iso{--tb-void:#0a0a0a;--tb-ring:#ffffff14;--tb-hover:#ffffff0a}
.iso[data-theme="light"]{--tb-void:#d7d7d3;--tb-ring:#00000014;--tb-hover:#0000000a}
.tb-controls{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.tb-btn{display:inline-flex;align-items:baseline;gap:7px;padding:5px 11px;border:0;border-radius:999px;background:transparent;color:var(--anatomy-text);font:inherit;font-size:12.5px;cursor:pointer;box-shadow:inset 0 0 0 1px var(--tb-ring)}
.tb-btn:hover,.tb-btn:focus-visible,.tb-btn[data-on]{color:var(--anatomy-strong);background:var(--tb-hover);outline:none}
.tb-sub{font:11px var(--anatomy-mono);color:var(--anatomy-muted)}
.tb-stage{border-radius:10px}
.tb-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.tb-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* Embedded in the blog: no page chrome, transparent around the card. */
html:has(body.tb-embed){color-scheme:light}
body.tb-embed{background:transparent}
body.tb-embed .iso-page{width:100%;margin:0;padding:1px 1px 2px}
`;

const caption =
  `A token bucket holds up to ${M.CAPACITY} tokens and refills at a steady rate. Every request spends one token; with none left it is refused, which an HTTP API answers with 429. A full bucket lets a burst through, up to ${M.CAPACITY} plus whatever refills while it arrives, and under sustained load the limiter passes exactly the refill rate.`;

const stage = `<div class="iso-stage tb-stage" tabindex="0" role="group" aria-label="Token bucket rate limiter. Left and right arrows change the traffic, B sends a burst of ${M.BURST}, up and down change the refill rate.">${svg}</div><span class="tb-live" aria-live="polite" data-live></span>`;
const body = `<style>${CSS}</style>` + k.plateHtml({
  fig: "Fig 1",
  title: "Token bucket",
  hint: "Pick the traffic · try a burst",
  readout: `${M.CAPACITY}.0 of ${M.CAPACITY} tokens`,
  keys: [
    { mark: "lit", label: "Tokens: the bucket's contents" },
    { mark: "raised", label: "Requests" },
  ],
  caption,
  body: stage,
}).replace('<figcaption class="iso-legend">', `<figcaption class="iso-legend">${controls}`);

const inline = (file) => readFileSync(join(HERE, file), "utf8").replace(/^export\s+/gm, "");
const DATA = {
  P, WIDTH, HEIGHT, C, D, COIN_R, COIN_H, SLOT, STACK_Z, PLATE_TOP, DISC_Z, POCKET_R, PIN, PIN_REST, PIN_LOCK,
  RAIL_Y, RAIL_TOP, REQ, REQ_H, DIV, DIV_LEN, DIV_ANGLE, SLOT_C, CHANNEL, FEEDER, SLOT_PLAN, REJECT_H, OUTBOX,
  RATE_KNOB, REFILL_KNOB, FEEDER_H, GEAR_H,
  coinSvg: COIN_SVG, requestSvg: REQUEST_SVG, rideSvg: RIDE_SVG,
};
const live = `${inline("model.mjs")}\nconst DATA = ${JSON.stringify(DATA)};\n${readFileSync(join(HERE, "live.js"), "utf8")}`;

let page = k.pageHtml({ title: "Token bucket", theme, body, script: kitScript() + live });
if (!dark) page = page.replace('<body class="iso"', '<body class="iso tb-embed"');
const outFile = dark ? join(HERE, "token-bucket-dark.html") : join(HERE, "../../public/figures/token-bucket.html");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, page);
console.log("wrote", outFile.replace(join(HERE, "../.."), "."), `${(page.length / 1024).toFixed(0)} KB`);
