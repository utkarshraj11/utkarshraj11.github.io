// Live behaviour for the token-bucket figure. Runs after the inlined kit and
// model.mjs, with DATA from the build. One loop: model → physics → DOM.
const {
  P, C, D, COIN_H, SLOT, STACK_Z, PLATE_TOP, DISC_Z, POCKET_R, COIN_R, PIN_REST, PIN_LOCK,
  RAIL_Y, RAIL_TOP, REQ, REQ_H, DIV, DIV_LEN, DIV_ANGLE, SLOT_C, CHANNEL, FEEDER, SLOT_PLAN, REJECT_H, OUTBOX,
  RATE_KNOB, REFILL_KNOB, FEEDER_H, GEAR_H, coinSvg, requestSvg, rideSvg,
} = DATA;

const stage = document.querySelector(".tb-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector(`[data-part="${name}"]`);
const el = {
  stack: part("stack"), drop: part("drop"), pockets: part("pockets"), eject: part("eject"), arm: part("arm"),
  rail: part("rail"), kicked: part("kicked"), pin: part("pin"), passed: part("passed"), refused: part("refused"),
  ratePointer: part("rate-pointer"), refillPointer: part("refill-pointer"),
};
const readoutEl = document.querySelector("[data-readout]");
const liveEl = document.querySelector("[data-live]");
const rateButtons = [...document.querySelectorAll("[data-rate]")];
const burstButton = document.querySelector("[data-burst]");
const refillButton = document.querySelector("[data-refill]");
const refillLabel = document.querySelector("[data-refill-label]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

// ---------- constants ----------
const G = 900;                 // gravity for falling tokens and requests, world units / s²
const SPEED = 90;              // rail speed, world units / s
const GAP = 13.5;              // closest two requests may queue on the rail
const HALF = REQ.w / 2;
const GATE_X = C[0];
const FEED_FACE = FEEDER.x + FEEDER.w;
const TAN = Math.tan(DIV_ANGLE);
const ZONE_IN = DIV[0] - 1.5;                              // a request's front crossing this enters the diverter zone
const ARM_END = DIV[0] + DIV_LEN * Math.cos(DIV_ANGLE);    // past this the arm no longer touches it
const steeredY = (x) => RAIL_Y + Math.max(0, x - DIV[0] - 2) * TAN;

// ---------- state ----------
const bucket = createBucket();
let refillRate = 2;
let rateName = "steady";
let inRate = RATES[rateName];
let arrivals = 0.6;            // fraction of the next arrival; starts part-way so the first comes soon
let pending = 0;               // requests waiting inside the feeder
const coins = [];              // the column, bottom first: one per whole token
for (let i = 0; i < bucket.n; i++) coins.push({ z: STACK_Z + i * SLOT, v: 0 });
const ejects = [];             // tokens on their way from the column to a request
const requests = [];           // { id, x, y, z, vz, state: rail | fall | gone, decided, pass, coin }
const arm = { a: 0, want: 0 }; // diverter angle: 0 along the rail's back edge, DIV_ANGLE across the rail
let pin = 0;                   // stop pin: 0 rest, 1 locked (column full: the wheel stops)
let ids = 0;

// ---------- geometry helpers (screen polygons for clips) ----------
function hull(points) {
  const p = points.map((q) => iso(q, P)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return "M" + lower.slice(0, -1).concat(upper.slice(0, -1)).map((q) => q[0].toFixed(2) + " " + q[1].toFixed(2)).join("L") + "Z";
}
const boxPts = (x0, x1, y0, y1, z0, z1) => [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
// What shows through the feeder's exit slot, and through the 429 box's slot.
const FEED_OPENING = hull([[FEED_FACE, RAIL_Y - 7.4, RAIL_TOP - 0.6], [FEED_FACE, RAIL_Y + 7.4, RAIL_TOP - 0.6], [FEED_FACE, RAIL_Y + 7.4, RAIL_TOP + REQ_H + 1.6], [FEED_FACE, RAIL_Y - 7.4, RAIL_TOP + REQ_H + 1.6]]);
const SLOT_OPENING = hull(boxPts(SLOT_PLAN.x, SLOT_PLAN.x + SLOT_PLAN.w, SLOT_PLAN.y, SLOT_PLAN.y + SLOT_PLAN.d, REJECT_H, REJECT_H));

// ---------- simulation ----------
const inZone = (r) => r.x + HALF > ZONE_IN && r.x - HALF < ARM_END + 1;

function step(dt, calm) {
  // Arrivals: evenly spaced at the chosen rate; they wait in the feeder until there is room on the rail.
  arrivals += inRate * dt;
  while (arrivals >= 1) { arrivals -= 1; pending += 1; }
  const back = requests.filter((r) => r.state === "rail").reduce((m, r) => Math.min(m, r.x), Infinity);
  if (pending > 0 && back - (FEED_FACE - HALF - 0.5) >= GAP) {
    pending -= 1;
    requests.push({ id: ids++, x: FEED_FACE - HALF - 0.5, y: RAIL_Y, z: 0, vz: 0, state: "rail", decided: false, pass: false, coin: false });
  }

  // Refill: the feed wheel drops whole tokens into the column, and stops while it is full.
  const dropped = refill(bucket, dt, refillRate);
  for (let i = 0; i < dropped; i++) coins.push({ z: calm ? STACK_Z + coins.length * SLOT : DISC_Z[0] - COIN_H, v: 0 });

  // The diverter zone holds one kind of request at a time. The arm is set for the next request
  // only once the zone is clear of the other kind, and that request waits at the zone until it is.
  const onRail = requests.filter((r) => r.state === "rail").sort((a, b) => b.x - a.x);
  const zone = onRail.filter(inZone);
  const zoneKind = zone.length ? (zone.some((r) => r.decided && !r.pass) ? "refused" : "passed") : null;
  const next = onRail.find((r) => !inZone(r) && r.x + HALF <= ZONE_IN);
  if (zoneKind) arm.want = zoneKind === "refused" ? DIV_ANGLE : 0;
  else if (next && next.decided) arm.want = next.pass ? 0 : DIV_ANGLE;
  arm.a += calm ? arm.want - arm.a : (arm.want - arm.a) * (1 - Math.exp(-dt / 0.045));
  if (Math.abs(arm.want - arm.a) < 1e-3) arm.a = arm.want;

  // Requests on the rail, front first, each a gap behind the one ahead.
  let limit = Infinity;
  for (const r of onRail) {
    let to = Math.min(r.x + SPEED * dt, limit - GAP);
    if (!inZone(r) && r.x + HALF <= ZONE_IN) {
      const kind = r.decided ? (r.pass ? "passed" : "refused") : null;
      const armReady = kind && Math.abs(arm.a - (r.pass ? 0 : DIV_ANGLE)) < 0.02;
      const clear = !zoneKind || zoneKind === kind;
      if (!(kind && armReady && clear)) to = Math.min(to, ZONE_IN - HALF);
    }
    r.x = Math.max(r.x, to);
    if (!r.decided && r.x >= GATE_X) {
      r.decided = true;
      r.pass = admit(bucket);
      if (r.pass) { coins.shift(); ejects.push({ t: calm ? 1 : 0, req: r }); }
      announce();
    }
    if (r.decided && !r.pass) {
      r.y = steeredY(r.x);
      if (r.x >= SLOT_C[0]) { r.x = SLOT_C[0]; r.y = SLOT_C[1]; r.state = "fall"; r.vz = 0; }
    }
    limit = r.y < RAIL_Y + REQ.d ? r.x : limit;   // a request steered off the rail no longer blocks the line
    if (r.x > OUTBOX.x + REQ.w + 2) r.state = "gone"; // fully inside the served box
  }

  // Refused requests drop through the 429 slot.
  for (const r of requests) if (r.state === "fall") {
    r.vz += G * dt; r.z -= calm ? 99 : r.vz * dt;
    if (r.z < -(RAIL_TOP + REQ_H + 2)) r.state = "gone";
  }
  for (let i = requests.length - 1; i >= 0; i--) if (requests[i].state === "gone") requests.splice(i, 1);

  // Tokens in the column fall to their slots.
  coins.forEach((c, i) => {
    const rest = STACK_Z + i * SLOT;
    if (c.z > rest) { c.v += G * dt; c.z = calm ? rest : Math.max(rest, c.z - c.v * dt); if (c.z === rest) c.v = 0; }
    else { c.z = rest; c.v = 0; }
  });

  // Tokens on their way to a request.
  for (let i = ejects.length - 1; i >= 0; i--) {
    const e = ejects[i];
    e.t += dt / 0.24;
    if (e.t >= 1) { e.req.coin = true; ejects.splice(i, 1); }
  }

  // The stop pin rises while the column is full.
  const lockTo = bucket.n >= bucket.capacity ? 1 : 0;
  pin += calm ? lockTo - pin : (lockTo - pin) * (1 - Math.exp(-dt / 0.08));
}

// Where a token on its way to a request is: along the channel, then a hop onto the request's back.
function ejectAt(e) {
  const t = Math.min(1, e.t);
  const exit = CHANNEL.y + CHANNEL.d;
  if (t < 0.55) {
    const u = t / 0.55, s = u * u * (3 - 2 * u);
    return [C[0], C[1] + (exit - C[1]) * s, STACK_Z];
  }
  const u = (t - 0.55) / 0.45, s = u * u * (3 - 2 * u);
  return [e.req.x * s, exit + (RAIL_Y - exit) * s, STACK_Z + (RAIL_TOP + REQ_H - STACK_Z) * s + Math.sin(Math.PI * u) * 2];
}

// ---------- drawing ----------
const move = (dx, dy, dz) => translateAlong(P, [dx, dy, dz]);
const coinAt = (x, y, z) => `<g transform="${move(x - C[0], y - C[1], z)}">${coinSvg}</g>`;
const shown = { passed: -1, refused: -1 };

function armRing(a) {
  // A flat bar from the pivot, half-round at both ends.
  const ring = [], half = 1.3, steps = 8;
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  for (let i = 0; i <= steps; i++) { const t = -Math.PI / 2 + (i / steps) * Math.PI; ring.push([DIV[0] + ux * (DIV_LEN + Math.cos(t) * half) + vx * Math.sin(t) * half, DIV[1] + uy * (DIV_LEN + Math.cos(t) * half) + vy * Math.sin(t) * half]); }
  for (let i = 0; i <= steps; i++) { const t = Math.PI / 2 + (i / steps) * Math.PI; ring.push([DIV[0] + ux * Math.cos(t) * half + vx * Math.sin(t) * half, DIV[1] + uy * Math.cos(t) * half + vy * Math.sin(t) * half]); }
  return ring;
}

function draw() {
  // Column: a token being pushed out sits under the stack until it clears the cage.
  const under = [], channel = [];
  for (const e of ejects) { const p = ejectAt(e); (p[1] < CHANNEL.y ? under : channel).push(coinAt(...p)); }
  const inside = [], above = [];
  for (const c of coins) (c.z + COIN_H > PLATE_TOP ? above : inside).push(coinAt(C[0], C[1], c.z));
  el.stack.innerHTML = under.join("") + inside.join("");
  el.drop.innerHTML = above.join("");
  el.eject.innerHTML = channel.join("");

  // Feed wheel: it turns one pocket per token made; pockets that have passed the hopper carry a token.
  const turn = wheelTurns(bucket) * Math.PI * 2;
  const pockets = [];
  for (let i = 0; i < POCKETS; i++) {
    const a = turn + (i / POCKETS) * Math.PI * 2;
    const x = D[0] + Math.cos(a) * POCKET_R, y = D[1] + Math.sin(a) * POCKET_R;
    const m = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const full = m > Math.PI + 0.35 && m < Math.PI * 2 - 0.05;
    pockets.push({ depth: depthOf([x, y, 0], P), svg: lineSvg(ring(x, y, COIN_R + 0.6, DISC_Z[1], P, 28), { tone: "lo" }) + (full ? solidSvg(cylinder(x, y, COIN_R - 0.4, DISC_Z[1] - 0.5, 1.1, P, 28, 0.3), { tone: "hi", crease: "lo", lit: true }) : "") });
  }
  el.pockets.innerHTML = pockets.sort((a, b) => a.depth - b.depth).map((p) => p.svg).join("");

  el.pin.setAttribute("transform", move(0, 0, pin * (PIN_LOCK - PIN_REST - 0.2)));
  el.arm.innerHTML = solidSvg(extrude(armRing(arm.a), RAIL_TOP + 0.8, REQ_H - 0.6, P, { bevel: 0.3 }), { tone: "mid", crease: "lo" });

  // Requests on the rail and on the chute, back to front; one coming out of the feeder is clipped
  // to the part outside it plus what shows through its exit slot.
  const items = [], clips = [];
  for (const r of requests) {
    if (r.state === "fall") continue;
    const body = `<g transform="${move(r.x, r.y, 0)}">${requestSvg}${r.coin ? rideSvg : ""}</g>`;
    let item = body;
    if (r.x - HALF < FEED_FACE) {
      const id = `tb-feed-${r.id}`;
      clips.push(`<clipPath id="${id}"><path d="${hull(boxPts(FEED_FACE, r.x + HALF + 1, r.y - 7, r.y + 7, 0, 40))}${FEED_OPENING}"/></clipPath>`);
      item = `<g clip-path="url(#${id})">${body}</g>`;
    }
    items.push({ depth: depthOf([r.x, r.y, 0], P), svg: item });
  }
  el.rail.innerHTML = (clips.length ? `<defs>${clips.join("")}</defs>` : "") + items.sort((a, b) => a.depth - b.depth).map((i) => i.svg).join("");

  // Refused requests dropping through the 429 slot: clipped to what is above the box top, or seen through the slot.
  const fallClips = [], falling = [];
  for (const r of requests) {
    if (r.state !== "fall") continue;
    const id = `tb-fall-${r.id}`;
    fallClips.push(`<clipPath id="${id}"><path d="${hull(boxPts(r.x + REQ.x, r.x + REQ.x + REQ.w, r.y + REQ.y, r.y + REQ.y + REQ.d, REJECT_H, 60))}${SLOT_OPENING}"/></clipPath>`);
    falling.push(`<g clip-path="url(#${id})"><g transform="${move(r.x, r.y, r.z)}">${requestSvg}</g></g>`);
  }
  el.kicked.innerHTML = (fallClips.length ? `<defs>${fallClips.join("")}</defs>` : "") + falling.join("");

  // Counters and knobs.
  if (bucket.passed !== shown.passed) { el.passed.textContent = String(Math.min(999, bucket.passed)).padStart(3, "0"); shown.passed = bucket.passed; }
  if (bucket.refused !== shown.refused) { el.refused.textContent = String(Math.min(999, bucket.refused)).padStart(3, "0"); shown.refused = bucket.refused; }
  el.ratePointer.setAttribute("d", knobPointer(RATE_KNOB, FEEDER_H + 4.6, inRate / 4));
  el.refillPointer.setAttribute("d", knobPointer(REFILL_KNOB, GEAR_H + 4.6, REFILLS.indexOf(refillRate) / (REFILLS.length - 1)));

  const text = `${tokens(bucket).toFixed(1)} of ${bucket.capacity} tokens · ${inRate}/s in · ${refillRate}/s refill`;
  if (readoutEl.textContent !== text) readoutEl.textContent = text;
}

function knobPointer([cx, cy], z, share) {
  const a = (225 * Math.PI) / 180 + share * Math.PI, ux = Math.sin(a), uy = -Math.cos(a);
  return lineOnTop([cx + ux * 0.9, cy + uy * 0.9], [cx + ux * 3, cy + uy * 3], z, P);
}

// ---------- controls ----------
function setRate(name) {
  rateName = name; inRate = RATES[name];
  rateButtons.forEach((b) => (b.dataset.rate === name ? b.setAttribute("data-on", "") : b.removeAttribute("data-on")));
  run();
}
function burst() { pending += BURST; run(); }
function cycleRefill(dir = 1) {
  refillRate = REFILLS[(REFILLS.indexOf(refillRate) + dir + REFILLS.length) % REFILLS.length];
  refillLabel.textContent = `${refillRate}/s`;
  run();
}

let announceTimer = 0;
function announce() {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (document.activeElement !== stage) return;
    liveEl.textContent = `${Math.floor(tokens(bucket))} tokens left; ${bucket.passed} passed, ${bucket.refused} refused`;
  }, 900);
}

// ---------- tour: steady → a burst → busy → quiet ----------
const TOUR = [["steady", 6], ["burst", 0], ["quiet", 6], ["busy", 9], ["quiet", 7]];
let touring = !still.matches, tourIndex = 0, tourLeft = 0, idleTimer = 0;
function tourTick(dt) {
  tourLeft -= dt;
  if (tourLeft > 0) return;
  const [what, seconds] = TOUR[tourIndex % TOUR.length];
  tourIndex++;
  if (what === "burst") burst(); else setRate(what);
  tourLeft = seconds;
}
function takeOver() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) { touring = true; tourLeft = 0; run(); } }, 12000);
}

// ---------- loop ----------
let frame = 0, last = 0, visible = false;
const busy = () => touring || inRate > 0 || pending > 0 || requests.length > 0 || ejects.length > 0 || arm.a !== arm.want || bucket.n < bucket.capacity || coins.some((c, i) => c.z > STACK_Z + i * SLOT);
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) tourTick(dt);
  step(dt, calm);
  draw();
  frame = visible && busy() ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

rateButtons.forEach((b) => b.addEventListener("click", () => { takeOver(); setRate(b.dataset.rate); }));
burstButton.addEventListener("click", () => { takeOver(); burst(); });
refillButton.addEventListener("click", () => { takeOver(); cycleRefill(1); });
stage.addEventListener("keydown", (event) => {
  const names = Object.keys(RATES);
  const i = names.indexOf(rateName);
  let handled = true;
  if (event.key === "ArrowRight") setRate(names[Math.min(names.length - 1, i + 1)]);
  else if (event.key === "ArrowLeft") setRate(names[Math.max(0, i - 1)]);
  else if (event.key === "ArrowUp") cycleRefill(1);
  else if (event.key === "ArrowDown") cycleRefill(-1);
  else if (event.key === "b" || event.key === "B" || event.key === " ") burst();
  else handled = false;
  if (!handled) return;
  event.preventDefault();
  takeOver();
});
still.addEventListener("change", () => { if (still.matches) touring = false; run(); });

// Embedded in a page: tell the parent how tall the card is, so its iframe can fit it exactly.
function reportHeight() { if (window.parent !== window) window.parent.postMessage({ type: "figure-height", height: Math.ceil(document.documentElement.scrollHeight) }, "*"); }
new ResizeObserver(reportHeight).observe(document.body);
window.addEventListener("load", reportHeight);

setRate(rateName);
draw();
