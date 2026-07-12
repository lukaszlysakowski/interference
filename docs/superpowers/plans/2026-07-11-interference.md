# Interference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A p5.js plotter-art maker: overlapping wave sources superpose into a scalar field that self-tunes toward legible fringe density, rendered as ink iso-contours with a red level-0 nodal set — SVG pen passes + PNG export.

**Architecture:** Single `index.js` (+ `index.html`, vendored `p5.min.js`, no build step). Pipeline per regenerate: `rollSources → settle → buildGrid → buildContours → renderAll`. All geometry lives in `state` arrays consumed identically by the canvas renderer and the SVG exporter.

**Tech Stack:** p5.js (vendored), vanilla JS, Node harness (`vm.runInContext` + p5-stub) for verification.

**Spec:** `docs/superpowers/specs/2026-07-11-interference-design.md` (approved).

## Global Constraints

- Canvas `CS = 2170`, `PAD = Math.round(CS * 0.04)` (= 87). Paper `#F7E6D4`, ink `#1A1613` (rgb 26,22,19), red `#A93B2A`. Red appears ONLY in the Nodes pass.
- Determinism contract: `Math.random` ONLY at seed choice (`regenerate(true)`) and `randomizeAll`. Everything downstream of `randomSeed(state.masterSeed)` is deterministic. Settle step `s` uses a seeded RNG derived from `masterSeed + s*1013`; wobble reseeds from `pts[0].x*0.01+50`; no other `Math.random`.
- Wobble parity: canvas and SVG both wobble via `wobblePts`, seeded from `pts[0].x * 0.01 + 50`. Default OFF.
- SVG pen passes, exact labels and weights: Border ink 0.9 · Contours ink 0.5 · Nodes red 1.0 · Signature ink 0.9. Paths are M/L-only.
- Signature: `Interference · seed N · <K> sources · <M> levels  YYYY-MM-DD HH:MM`.
- A11y floor: sidebar CSS copied from Watershed (`--muted: #969082`, `.ctrl` min-height 24px). Container div id `canvas-container`. Never regress Lighthouse a11y 100.
- Read-only sources (NEVER modify): `/Users/lukasz/genuary-2026/sketches/watershed/*`, `/Users/lukasz/genuary-2026/sketches/fold/*`.
- Timeout-resilience protocol (controller + implementers): incremental commits after each step; write `.superpowers/sdd/task-N-report.md` EARLY (create at task start, update as you go). Controller: detect limit-killed subagents (tiny result / "session limit"), salvage from git + working tree, CONTROLLER INLINE fallback with ledger attribution, final review by a fresh independent subagent.
- Controller note: after Task 1, add launch config `interference` (npx serve `/Users/lukasz/genuary-2026/sketches/interference` --listen 3463, port 3463) to `/Users/lukasz/claude/self-redaction/.claude/launch.json` — controller does this inline; implementers never touch files outside the repo.

---

### Task 1: Scaffold — page, sidebar shell, seed plumbing, harness stub

**Files:**
- Create: `index.html` (copied from Watershed, retitled)
- Create: `index.js` (skeleton: constants, ui, state, setup/draw, regenerate shell, paper/border/signature render)
- Create: `p5.min.js` (copied)
- Create: `.superpowers/sdd/p5-stub.js` (copied)
- Test: `.superpowers/sdd/task-1-verify.js`

**Interfaces:**
- Produces: globals `CS`, `PAD`, `PAPER`, `INK`, `INK_RGB`, `RED`, `LEVELS`, `SETTLE_STEPS`, `CONTROL_DEFS`, `ui`, `state`, functions `regenerate(newSeed)`, `renderAll()`, `signatureText()`, `randomizeAll()`, `setupControls()`, `drawPoly(pts)`, `wobblePts(pts)`, `seededRng(seed)`. Later tasks fill the pipeline hooks `rollSources/settle/buildGrid/buildContours` — Task 1 defines them as no-op function declarations so the file always parses and runs.
- Consumes: nothing.

- [ ] **Step 1: Copy vendored assets**

```bash
cd /Users/lukasz/genuary-2026/sketches/interference
cp /Users/lukasz/genuary-2026/sketches/watershed/p5.min.js .
mkdir -p .superpowers/sdd
cp /Users/lukasz/genuary-2026/sketches/watershed/.superpowers/sdd/p5-stub.js .superpowers/sdd/
cp /Users/lukasz/genuary-2026/sketches/watershed/index.html .
```

- [ ] **Step 2: Adapt index.html**

Edit the copied `index.html`: change `<title>` to `Interference` and the sidebar `<h1>` to `Interference`. Keep the `<style>` block byte-for-byte (a11y floor). Keep the container div id `canvas-container`. Verify these element ids exist (grep); the copied file already uses them:
`canvas-container`, `controls`, `btn-random`, `btn-refresh`, `btn-svg`, `btn-png`, `btn-png4`.
Script tags at the end of `<body>` must be:

```html
<script src="p5.min.js"></script>
<script src="index.js"></script>
```

Remove any Watershed-specific static sidebar text other than the h1 and the buttons (control rows are built by JS into `#controls`).

- [ ] **Step 3: Write index.js skeleton**

```javascript
// Interference — wave-source superposition tuned into legible fringe.
// Family: palimpsest / core-samples / second-reading / fold / watershed.

const CS = 2170;
const PAD = Math.round(CS * 0.04);
const PAPER = '#F7E6D4';
const INK = '#1A1613';
const INK_RGB = [26, 22, 19];
const RED = '#A93B2A';
// Density → ink contour level count M.
const LEVELS = [5, 9, 14]; // Sparse / Medium / Dense
// Settle → hill-climb step count.
const SETTLE_STEPS = [0, 30, 80]; // Off / Light / Full

const CONTROL_DEFS = [
    { key: 'sources', label: 'Sources', opts: ['random', '3', '4', '5', '6'], def: 0 },
    { key: 'mix',     label: 'Mix',     opts: ['Radial', 'Balanced', 'Linear'], def: 1 },
    { key: 'detail',  label: 'Detail',  opts: ['320', '400', '480'],            def: 1 },
    { key: 'density', label: 'Density', opts: ['Sparse', 'Medium', 'Dense'],    def: 1 },
    { key: 'settle',  label: 'Settle',  opts: ['Off', 'Light', 'Full'],         def: 1 },
    { key: 'wobble',  label: 'Wobble',  opts: ['Off', 'On'],                    def: 0 }
];

const ui = { sources: 0, mix: 1, detail: 1, density: 1, settle: 1, wobble: 0 };

const state = {
    masterSeed: 1,
    sources: [],
    grid: { N: 0, cell: 0 },
    field: null,
    contours: [],
    nodes: []
};

const ctrlButtons = {};

// --- pipeline hooks (filled in by later tasks) ---
function rollSources() {}
function settle() {}
function buildGrid() {}
function buildContours() {}

function regenerate(newSeed) {
    if (newSeed) state.masterSeed = Math.floor(Math.random() * 1e9);
    randomSeed(state.masterSeed);
    rollSources();
    settle();
    buildGrid();
    buildContours();
    renderAll();
}

// Small deterministic PRNG (mulberry32) for settle steps — independent of p5's RNG.
function seededRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function wobblePts(pts) {
    if (!ui.wobble) return pts;
    randomSeed(pts[0].x * 0.01 + 50);
    return pts.map(p => ({ x: p.x + random(-1.2, 1.2), y: p.y + random(-1.2, 1.2) }));
}

function drawPoly(pts) {
    const w = wobblePts(pts);
    beginShape();
    for (const p of w) vertex(p.x, p.y);
    endShape();
}

function signatureText() {
    const d = new Date();
    const p2 = n => String(n).padStart(2, '0');
    const M = LEVELS[ui.density];
    return `Interference · seed ${state.masterSeed} · ${state.sources.length} sources · ${M} levels  ` +
        `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function renderAll() {
    background(PAPER);
    noFill();
    // ink contours
    stroke(INK);
    strokeWeight(1.2);
    for (const pl of state.contours) drawPoly(pl);
    // red nodal set
    stroke(RED);
    strokeWeight(2.4);
    for (const pl of state.nodes) drawPoly(pl);
    // border + signature
    stroke(INK);
    strokeWeight(2.2);
    rect(PAD, PAD, CS - 2 * PAD, CS - 2 * PAD);
    noStroke();
    fill(INK);
    textSize(26);
    textAlign(LEFT, BASELINE);
    text(signatureText(), PAD, CS - PAD + 44);
    noFill();
}

function syncControlButtons() {
    for (const def of CONTROL_DEFS) {
        if (ctrlButtons[def.key]) ctrlButtons[def.key].textContent = def.opts[ui[def.key]];
    }
}

function randomizeAll() {
    for (const def of CONTROL_DEFS) {
        if (def.key === 'detail' || def.key === 'wobble') continue;
        ui[def.key] = Math.floor(Math.random() * def.opts.length);
    }
    syncControlButtons();
    regenerate(true);
}

function setupControls() {
    const panel = document.getElementById('controls');
    for (const def of CONTROL_DEFS) {
        const row = document.createElement('div');
        row.className = 'ctrl';
        const lab = document.createElement('span');
        lab.className = 'ctrl-name';
        lab.textContent = def.label;
        const btn = document.createElement('button');
        btn.className = 'ctrl-val';
        btn.textContent = def.opts[ui[def.key]];
        btn.addEventListener('click', () => {
            ui[def.key] = (ui[def.key] + 1) % def.opts.length;
            btn.textContent = def.opts[ui[def.key]];
            regenerate(false);
        });
        ctrlButtons[def.key] = btn;
        row.appendChild(lab);
        row.appendChild(btn);
        panel.appendChild(row);
    }
    document.getElementById('btn-random').addEventListener('click', randomizeAll);
    document.getElementById('btn-refresh').addEventListener('click', () => regenerate(true));
    document.getElementById('btn-svg').addEventListener('click', () => exportSVG());
    document.getElementById('btn-png').addEventListener('click', () => exportPNG(1));
    document.getElementById('btn-png4').addEventListener('click', () => exportPNG(4));
}

// export stubs — Task 6 replaces these
function exportSVG() {}
function exportPNG(scale) {}

function setup() {
    const c = createCanvas(CS, CS);
    c.parent('canvas-container');
    pixelDensity(1);
    noLoop();
    setupControls();
    regenerate(true);
}

function draw() {}

function mousePressed() {
    if (mouseX >= 0 && mouseX <= CS && mouseY >= 0 && mouseY <= CS) regenerate(true);
}
```

Note: `.ctrl` / `.ctrl-name` / `.ctrl-val` class names must match the CSS copied from Watershed's `index.html` — grep the copied `<style>` block; if Watershed's CSS uses different class names for control rows/labels/value buttons, use Watershed's names in `setupControls` instead (CSS wins; JS adapts). Report which names you used.

- [ ] **Step 4: Write verify script**

`.superpowers/sdd/task-1-verify.js`:

```javascript
// Task 1 verification: skeleton loads, regenerates, deterministic seed plumbing
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { installP5Stub } = require('./p5-stub.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
const sandbox = Object.assign({}, installP5Stub(), {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => ({ catch: () => {} }),
    confirm: () => false,
    document: { getElementById: () => null, createElement: () => ({ click: () => {} }) },
    Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    window: {}
});
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox);
// index.js declares state/ui/CS/PAD with const — lexical bindings are NOT sandbox
// properties, so export them explicitly for direct sandbox.X reads below.
vm.runInContext('globalThis.state = state; globalThis.ui = ui; globalThis.CS = CS; globalThis.PAD = PAD; renderAll = function () {};', sandbox);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  ok  ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

check('CS is 2170', sandbox.CS === 2170);
check('PAD is 87', sandbox.PAD === 87);
check('ui defaults', sandbox.ui.density === 1 && sandbox.ui.settle === 1 && sandbox.ui.wobble === 0);
vm.runInContext('state.masterSeed = 123; regenerate(false);', sandbox);
check('regenerate(false) keeps seed', sandbox.state.masterSeed === 123);
const r = vm.runInContext('const g = seededRng(42); [g(), g(), g()]', sandbox);
const r2 = vm.runInContext('const h = seededRng(42); [h(), h(), h()]', sandbox);
check('seededRng deterministic + in [0,1)', JSON.stringify(r) === JSON.stringify(r2) && r.every(v => v >= 0 && v < 1), JSON.stringify(r));
const sig = vm.runInContext('signatureText()', sandbox);
check('signature format', /^Interference · seed 123 · \d+ sources · \d+ levels  \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(sig), sig);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 5: Run verify**

Run: `cd /Users/lukasz/genuary-2026/sketches/interference && node .superpowers/sdd/task-1-verify.js`
Expected: `6 passed, 0 failed`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Task 1: scaffold — page, sidebar shell, seed plumbing, harness"
```

---

### Task 2: Wave sources + field superposition + grid sampling

**Files:**
- Modify: `index.js` (replace `rollSources` and `buildGrid` stubs; add `sourceAt`, `fieldAt`)
- Test: `.superpowers/sdd/task-2-verify.js`

**Interfaces:**
- Consumes: `ui`, `state`, p5 `random/randomSeed` (seeded by `regenerate`).
- Produces: `sourceAt(src, x, y) → number` (one source's contribution at page point x,y); `fieldAt(sources, x, y) → number` (sum over sources); `rollSources()` fills `state.sources` = array of `{kind:'radial', A, k, phase, sx, sy}` | `{kind:'linear', A, k, phase, theta}`; `buildGrid()` fills `state.grid = {N, cell}` and `state.field` (Float64Array N², row-major `idx = y*N + x`, sampled at page point `PAD + (x+0.5)*cell`).

- [ ] **Step 1: Implement**

Replace the `rollSources` and `buildGrid` stubs with:

```javascript
function sourceAt(src, x, y) {
    if (src.kind === 'radial') {
        const r = Math.hypot(x - src.sx, y - src.sy);
        return src.A * Math.sin(src.k * r + src.phase);
    }
    // linear plane wave
    return src.A * Math.sin(src.k * (x * Math.cos(src.theta) + y * Math.sin(src.theta)) + src.phase);
}

function fieldAt(sources, x, y) {
    let z = 0;
    for (const s of sources) z += sourceAt(s, x, y);
    return z;
}

function rollSources() {
    const nOpt = CONTROL_DEFS[0].opts[ui.sources];
    const K = nOpt === 'random' ? Math.floor(random(3, 7)) : parseInt(nOpt, 10);
    // Mix: Radial → mostly radial, Balanced → ~50/50, Linear → mostly linear
    const radialProb = [0.85, 0.5, 0.15][ui.mix];
    const span = CS - 2 * PAD;
    // frequency band: ~8–40 wavelengths across the page → k = 2π·waves/span
    const kFor = () => (Math.PI * 2) * random(8, 40) / span;
    state.sources = [];
    for (let i = 0; i < K; i++) {
        const A = random(0.6, 1.4);
        const k = kFor();
        const phase = random(Math.PI * 2);
        if (random() < radialProb) {
            // source point within (and slightly beyond) the drawable square
            state.sources.push({
                kind: 'radial', A, k, phase,
                sx: PAD + random(-0.15, 1.15) * span,
                sy: PAD + random(-0.15, 1.15) * span
            });
        } else {
            state.sources.push({ kind: 'linear', A, k, phase, theta: random(Math.PI) });
        }
    }
}

function buildGrid() {
    const N = [320, 400, 480][ui.detail];
    const cell = (CS - 2 * PAD) / N;
    const field = new Float64Array(N * N);
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            const px = PAD + (x + 0.5) * cell, py = PAD + (y + 0.5) * cell;
            field[y * N + x] = fieldAt(state.sources, px, py);
        }
    }
    state.grid = { N, cell };
    state.field = field;
}
```

Note: `buildGrid` reads `state.sources` — which `settle()` (Task 3, still a stub here) will later mutate before `buildGrid` runs. That ordering is already correct in `regenerate`. For this task `settle` is a no-op, so `buildGrid` samples the rolled sources directly.

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-2-verify.js` (copy the boilerplate from task-1-verify.js from the top through the `check` function definition, INCLUDING the globals-export vm.runInContext line, then):

```javascript
// Superposition: field = sum of individual sources
const superErr = vm.runInContext(`
    (function () {
        const s1 = { kind: 'radial', A: 1.1, k: 0.02, phase: 0.3, sx: 500, sy: 700 };
        const s2 = { kind: 'linear', A: 0.9, k: 0.015, phase: 1.2, theta: 0.8 };
        let e = 0;
        for (let x = 100; x <= 2000; x += 200)
            for (let y = 100; y <= 2000; y += 200)
                e = Math.max(e, Math.abs(sourceAt(s1,x,y) + sourceAt(s2,x,y) - fieldAt([s1,s2],x,y)));
        return e;
    })()
`, sandbox);
check('superposition (field = Σ sources)', superErr < 1e-9, `${superErr}`);

// order-independence
const orderErr = vm.runInContext(`
    (function () {
        const s1 = { kind: 'radial', A: 1.1, k: 0.02, phase: 0.3, sx: 500, sy: 700 };
        const s2 = { kind: 'linear', A: 0.9, k: 0.015, phase: 1.2, theta: 0.8 };
        const s3 = { kind: 'radial', A: 0.7, k: 0.03, phase: 2.0, sx: 1500, sy: 400 };
        let e = 0;
        for (let x = 100; x <= 2000; x += 300)
            for (let y = 100; y <= 2000; y += 300)
                e = Math.max(e, Math.abs(fieldAt([s1,s2,s3],x,y) - fieldAt([s3,s1,s2],x,y)));
        return e;
    })()
`, sandbox);
check('order-independent', orderErr < 1e-9, `${orderErr}`);

// Sources control sets K
vm.runInContext('ui.sources = 2; state.masterSeed = 42; regenerate(false);', sandbox); // opts[2] = '4'
check('Sources="4" → 4 sources', sandbox.state.sources.length === 4, `${sandbox.state.sources.length}`);
vm.runInContext('ui.sources = 4; regenerate(false);', sandbox); // opts[4] = '6'
check('Sources="6" → 6 sources', sandbox.state.sources.length === 6);

// Mix bias: Radial produces more radial than Linear does (aggregate over seeds)
const countRadial = (mix) => vm.runInContext(`
    (function () {
        ui.mix = ${mix}; ui.sources = 0; let radial = 0, total = 0;
        for (let s = 0; s < 40; s++) { state.masterSeed = 1000 + s; regenerate(false);
            for (const src of state.sources) { total++; if (src.kind === 'radial') radial++; } }
        return radial / total;
    })()
`, sandbox);
const radFrac = countRadial(0), linFrac = countRadial(2);
check('Mix biases type (Radial > Linear radial-fraction)', radFrac > linFrac + 0.3, `radial-mix ${radFrac.toFixed(2)} vs linear-mix ${linFrac.toFixed(2)}`);

// Grid shape
vm.runInContext('ui.mix = 1; ui.sources = 0; ui.detail = 0; state.masterSeed = 7; regenerate(false);', sandbox);
check('grid N=320', sandbox.state.grid.N === 320 && sandbox.state.field.length === 320 * 320);
check('cell size', Math.abs(sandbox.state.grid.cell - (2170 - 174) / 320) < 1e-9);

// Determinism
vm.runInContext('state.masterSeed = 777; regenerate(false); globalThis.__f1 = state.field[12345]; globalThis.__s1 = JSON.stringify(state.sources);', sandbox);
vm.runInContext('state.masterSeed = 777; regenerate(false); globalThis.__f2 = state.field[12345]; globalThis.__s2 = JSON.stringify(state.sources);', sandbox);
check('determinism: field + sources', sandbox.__f1 === sandbox.__f2 && sandbox.__s1 === sandbox.__s2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-2-verify.js`
Expected: `8 passed, 0 failed`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 2: wave sources + field superposition + grid sampling"
```

---

### Task 3: Settle — greedy hill-climb toward target fringe density

**Files:**
- Modify: `index.js` (replace `settle` stub; add `fringeDensity`, `settleScore`, `SETTLE_N`, `TARGET_DENSITY`)
- Test: `.superpowers/sdd/task-3-verify.js`

**Interfaces:**
- Consumes: `state.sources`, `state.masterSeed`, `ui.settle`, `ui.density`, `LEVELS`, `sourceAt`/`fieldAt`, `seededRng`, `CS`, `PAD`.
- Produces: module-level `SETTLE_N` (=80) and `TARGET_DENSITY` (=0.42); `fringeDensity(sources) → number` (fraction of cheap-grid cells a contour family crosses, in [0,1]); `settleScore(sources) → number` (= `−|fringeDensity − TARGET_DENSITY|`); `settle()` mutates `state.sources` in place via `SETTLE_STEPS[ui.settle]` greedy hill-climb steps. Invariant: every ACCEPTED step does not decrease the score (score after ≥ score before).

- [ ] **Step 1: Implement**

Replace the `settle` stub with:

```javascript
const SETTLE_N = 80;        // cheap metric grid resolution
const TARGET_DENSITY = 0.42; // desired fraction of page crossed by fringe

// Coarse fringe-density estimate: on an 80² grid, count cells whose corner span
// exceeds the contour interval (i.e. a level line passes through). Cheap proxy
// for "how much of the page is covered by fringe."
function fringeDensity(sources) {
    const n = SETTLE_N;
    const span = CS - 2 * PAD;
    const step = span / n;
    const g = new Float64Array((n + 1) * (n + 1));
    let lo = Infinity, hi = -Infinity;
    for (let y = 0; y <= n; y++) {
        for (let x = 0; x <= n; x++) {
            const v = fieldAt(sources, PAD + x * step, PAD + y * step);
            g[y * (n + 1) + x] = v;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
        }
    }
    const M = LEVELS[ui.density];
    const interval = (hi - lo) / (M + 1);
    if (interval <= 1e-9) return 0;
    let crossed = 0;
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const a = g[y * (n + 1) + x], b = g[y * (n + 1) + x + 1];
            const c = g[(y + 1) * (n + 1) + x], d = g[(y + 1) * (n + 1) + x + 1];
            const cmax = Math.max(a, b, c, d), cmin = Math.min(a, b, c, d);
            if (cmax - cmin >= interval) crossed++;
        }
    }
    return crossed / (n * n);
}

function settleScore(sources) {
    return -Math.abs(fringeDensity(sources) - TARGET_DENSITY);
}

function settle() {
    const steps = SETTLE_STEPS[ui.settle];
    if (steps === 0) return;
    const span = CS - 2 * PAD;
    let score = settleScore(state.sources);
    for (let s = 0; s < steps; s++) {
        const rng = seededRng((state.masterSeed + s * 1013) >>> 0);
        // snapshot for revert
        const backup = state.sources.map(src => Object.assign({}, src));
        for (const src of state.sources) {
            src.phase += (rng() - 0.5) * 0.6;
            if (src.kind === 'radial') {
                src.sx += (rng() - 0.5) * 0.06 * span;
                src.sy += (rng() - 0.5) * 0.06 * span;
            } else {
                src.theta += (rng() - 0.5) * 0.2;
            }
        }
        const next = settleScore(state.sources);
        if (next >= score) {
            score = next; // keep
        } else {
            state.sources = backup; // revert
        }
    }
}
```

Note: `settle` runs BEFORE `buildGrid` in `regenerate` (already wired in Task 1), so the settled sources are what `buildGrid` samples. `settle` uses the same `ui.density` level count as the final contours, so the metric matches what will actually be drawn.

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-3-verify.js` (boilerplate through `check`, then):

```javascript
// Off = no change to sources
vm.runInContext('ui.settle = 0; ui.sources = 0; ui.detail = 0; state.masterSeed = 4242; rollSources(); globalThis.__before = JSON.stringify(state.sources); settle(); globalThis.__after = JSON.stringify(state.sources);', sandbox);
check('Settle Off: sources unchanged', sandbox.__before === sandbox.__after);

// fringeDensity in [0,1]
const fd = vm.runInContext('ui.settle = 2; state.masterSeed = 4242; rollSources(); fringeDensity(state.sources)', sandbox);
check('fringeDensity in [0,1]', fd >= 0 && fd <= 1, `${fd}`);

// settle improves-or-holds the score (final score ≥ initial score)
const scores = vm.runInContext(`
    (function () {
        ui.settle = 2; ui.density = 1; ui.detail = 0; state.masterSeed = 4242;
        rollSources();
        const before = settleScore(state.sources);
        settle();
        const after = settleScore(state.sources);
        return [before, after];
    })()
`, sandbox);
check('settle improves-or-holds score', scores[1] >= scores[0] - 1e-12, `before ${scores[0].toFixed(4)} → after ${scores[1].toFixed(4)}`);

// settle moves score at least once across several seeds (it actually does something)
const improved = vm.runInContext(`
    (function () {
        ui.settle = 2; ui.density = 1; ui.detail = 0; let anyImproved = 0;
        for (let s = 0; s < 8; s++) {
            state.masterSeed = 5000 + s; rollSources();
            const b = settleScore(state.sources); settle(); const a = settleScore(state.sources);
            if (a > b + 1e-9) anyImproved++;
        }
        return anyImproved;
    })()
`, sandbox);
check('settle improves on most seeds', improved >= 5, `${improved}/8 improved`);

// determinism: same seed → same settled sources
vm.runInContext('ui.settle = 2; state.masterSeed = 99; rollSources(); settle(); globalThis.__d1 = JSON.stringify(state.sources);', sandbox);
vm.runInContext('state.masterSeed = 99; rollSources(); settle(); globalThis.__d2 = JSON.stringify(state.sources);', sandbox);
check('settle deterministic', sandbox.__d1 === sandbox.__d2);

// full regenerate at Full settle stays deterministic end-to-end
vm.runInContext('ui.settle = 2; state.masterSeed = 31; regenerate(false); globalThis.__g1 = state.field[9999];', sandbox);
vm.runInContext('state.masterSeed = 31; regenerate(false); globalThis.__g2 = state.field[9999];', sandbox);
check('regenerate determinism with settle', sandbox.__g1 === sandbox.__g2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-3-verify.js`
Expected: `6 passed, 0 failed`

If `settle improves on most seeds` fails (fewer than 5/8), the perturbation scale is off — the rolled sources may already sit near target so there's little to gain. First confirm `fringeDensity` of fresh rolls is often far from 0.42; if rolls cluster near target, that's acceptable (settle correctly holds) — loosen the threshold to `improved >= 3` and note it in the report rather than inflating perturbations. Do NOT change TARGET_DENSITY to make this pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 3: settle — greedy hill-climb toward target fringe density"
```

---

### Task 4: Contours + nodal set — marching squares (ink levels + red level 0)

**Files:**
- Modify: `index.js` (replace `buildContours` stub; add `marchCell`, `samplePt`, `chainSegments`, `chaikin`, `marchLevel`)
- Test: `.superpowers/sdd/task-4-verify.js`

**Interfaces:**
- Consumes: `state.field`, `state.grid`, `ui.density`, `LEVELS`.
- Produces: `samplePt(gx, gy) → {x, y}` (grid→page, cell-center); `marchCell(x, y, v00, v10, v01, v11, lv, segs)` (emits [x1,y1,x2,y2] grid-coord segments for one cell at one level); `chainSegments(segs, keyFn)` and `chaikin(pts)` (ported utilities); `marchLevel(lv) → array of page-coord polylines`; `buildContours()` fills `state.contours` (ink, M non-zero levels between 5th–95th percentiles) and `state.nodes` (red, level 0). No ink level coincides with 0.

- [ ] **Step 1: Implement**

Replace the `buildContours` stub with (these functions are ported from Watershed's contour code):

```javascript
function samplePt(gx, gy) {
    const { cell } = state.grid;
    return { x: PAD + (gx + 0.5) * cell, y: PAD + (gy + 0.5) * cell };
}

// standard 16-case marching squares on one 2x2 block; emits [x1,y1,x2,y2] grid coords
function marchCell(x, y, v00, v10, v01, v11, lv, segs) {
    let c = 0;
    if (v00 >= lv) c |= 1;
    if (v10 >= lv) c |= 2;
    if (v11 >= lv) c |= 4;
    if (v01 >= lv) c |= 8;
    if (c === 0 || c === 15) return;
    const t = (a, b) => (lv - a) / (b - a);
    const top = () => [x + t(v00, v10), y];
    const bottom = () => [x + t(v01, v11), y + 1];
    const left = () => [x, y + t(v00, v01)];
    const right = () => [x + 1, y + t(v10, v11)];
    const add = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
    switch (c) {
        case 1: case 14: add(left(), top()); break;
        case 2: case 13: add(top(), right()); break;
        case 3: case 12: add(left(), right()); break;
        case 4: case 11: add(right(), bottom()); break;
        case 6: case 9: add(top(), bottom()); break;
        case 7: case 8: add(left(), bottom()); break;
        case 5: {
            const mid = (v00 + v10 + v01 + v11) / 4 >= lv;
            if (mid) { add(left(), top()); add(right(), bottom()); }
            else { add(left(), bottom()); add(top(), right()); }
            break;
        }
        case 10: {
            const mid = (v00 + v10 + v01 + v11) / 4 >= lv;
            if (mid) { add(top(), right()); add(left(), bottom()); }
            else { add(left(), top()); add(right(), bottom()); }
            break;
        }
    }
}

// chain undirected segments into polylines, float-tolerant via keyFn
function chainSegments(segs, keyFn) {
    const key = keyFn || ((x, y) => x + ',' + y);
    const adj = new Map();
    const addAdj = (k, si) => { if (!adj.has(k)) adj.set(k, []); adj.get(k).push(si); };
    segs.forEach((s, si) => { addAdj(key(s[0], s[1]), si); addAdj(key(s[2], s[3]), si); });
    const used = new Uint8Array(segs.length);
    const chains = [];
    for (let si = 0; si < segs.length; si++) {
        if (used[si]) continue;
        used[si] = 1;
        const chain = [[segs[si][0], segs[si][1]], [segs[si][2], segs[si][3]]];
        for (const end of [1, 0]) {
            while (true) {
                const tip = end ? chain[chain.length - 1] : chain[0];
                const cands = (adj.get(key(tip[0], tip[1])) || []).filter(j => !used[j]);
                if (!cands.length) break;
                const j = cands[0];
                used[j] = 1;
                const s = segs[j];
                const other = (Math.abs(s[0] - tip[0]) < 1e-9 && Math.abs(s[1] - tip[1]) < 1e-9)
                    ? [s[2], s[3]] : [s[0], s[1]];
                if (end) chain.push(other); else chain.unshift(other);
            }
        }
        chains.push(chain);
    }
    return chains;
}

// corner-cutting smoothing, endpoints preserved
function chaikin(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(pts[pts.length - 1]);
    return out;
}

function marchLevel(lv) {
    const { N } = state.grid;
    const f = state.field;
    const segs = [];
    for (let y = 0; y < N - 1; y++) {
        for (let x = 0; x < N - 1; x++) {
            marchCell(x, y,
                f[y * N + x], f[y * N + x + 1],
                f[(y + 1) * N + x], f[(y + 1) * N + x + 1], lv, segs);
        }
    }
    const fkey = (x, y) => x.toFixed(3) + ',' + y.toFixed(3);
    return chainSegments(segs, fkey).map(ch => chaikin(chaikin(ch.map(gp => samplePt(gp[0], gp[1])))));
}

function buildContours() {
    state.contours = [];
    state.nodes = [];
    const { N } = state.grid;
    const f = state.field;
    if (!N) return;
    const sorted = Float64Array.from(f).sort();
    const p05 = sorted[Math.floor(0.05 * sorted.length)];
    const p95 = sorted[Math.floor(0.95 * sorted.length)];
    const M = LEVELS[ui.density];
    const range = p95 - p05;
    const eps = range > 0 ? range * 0.02 : 1e-6; // keep ink levels off 0
    for (let li = 0; li < M; li++) {
        let lv = p05 + ((li + 1) / (M + 1)) * range;
        if (Math.abs(lv) < eps) lv += (lv >= 0 ? eps : -eps); // nudge off the nodal level
        for (const pl of marchLevel(lv)) state.contours.push(pl);
    }
    // red nodal set: level exactly 0
    for (const pl of marchLevel(0)) state.nodes.push(pl);
}
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-4-verify.js` (boilerplate through `check`, then):

```javascript
vm.runInContext('ui.settle = 1; ui.density = 1; ui.detail = 0; state.masterSeed = 4242; regenerate(false);', sandbox);
const st = sandbox.state;
const N = st.grid.N, cell = st.grid.cell, PAD = sandbox.PAD, CS = sandbox.CS;

check('contours exist', st.contours.length > 0, `${st.contours.length}`);
check('nodes exist', st.nodes.length > 0, `${st.nodes.length}`);

// each ink chain closed or edge-terminated
const edgeTol = 1.6 * cell;
const nearEdge = p => p.x < PAD + edgeTol || p.y < PAD + edgeTol || p.x > CS - PAD - edgeTol || p.y > CS - PAD - edgeTol;
let bad = 0;
for (const pl of st.contours) {
    const a = pl[0], b = pl[pl.length - 1];
    const closed = Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
    if (!closed && !(nearEdge(a) && nearEdge(b))) bad++;
}
check('ink chains closed or edge-terminated', bad === 0, `${bad} of ${st.contours.length}`);

// nodal set: every node vertex has |field| near 0 (sample the field at the vertex)
// reconstruct fieldAt via the settled sources on state
function fieldAtPage(px, py) { return vm.runInContext(`fieldAt(state.sources, ${px}, ${py})`, sandbox); }
let nodeBad = 0, nodeChecked = 0;
const fieldRange = (() => {
    let lo = Infinity, hi = -Infinity;
    for (const v of st.field) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return hi - lo;
})();
const nodeTol = 0.03 * fieldRange;
for (const pl of st.nodes) {
    for (let i = 0; i < pl.length; i += Math.max(1, Math.floor(pl.length / 4))) {
        nodeChecked++;
        if (Math.abs(fieldAtPage(pl[i].x, pl[i].y)) > nodeTol) nodeBad++;
    }
}
check('nodes lie on |field|≈0', nodeBad === 0, `${nodeBad}/${nodeChecked} off (tol ${nodeTol.toFixed(3)})`);

// ink level count = M (Medium → 9); count distinct levels by re-deriving, simpler: contours came from M marchLevel calls, so assert nonzero and that Dense yields more chains than Sparse
vm.runInContext('ui.density = 0; regenerate(false); globalThis.__cS = state.contours.length;', sandbox);
vm.runInContext('ui.density = 2; regenerate(false); globalThis.__cD = state.contours.length;', sandbox);
check('Dense yields more ink chains than Sparse', sandbox.__cD > sandbox.__cS, `${sandbox.__cD} vs ${sandbox.__cS}`);

// no ink level coincides with 0: check by verifying ink and node vertex sets never sample field≈0 on ink
vm.runInContext('ui.density = 1; state.masterSeed = 4242; regenerate(false);', sandbox);
// determinism
vm.runInContext('state.masterSeed = 88; regenerate(false); globalThis.__k1 = JSON.stringify({c: state.contours.slice(0,3), n: state.nodes.slice(0,3)});', sandbox);
vm.runInContext('state.masterSeed = 88; regenerate(false); globalThis.__k2 = JSON.stringify({c: state.contours.slice(0,3), n: state.nodes.slice(0,3)});', sandbox);
check('determinism: contours + nodes', sandbox.__k1 === sandbox.__k2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-4-verify.js`
Expected: `6 passed, 0 failed`

Note on the `nodes lie on |field|≈0` test: node polylines are Chaikin-smoothed, so a smoothed vertex sits slightly off the true zero contour. The 3% -of-range tolerance absorbs that. If it fails widely, the nodal pass is picking up a non-zero level — investigate `marchLevel(0)` before loosening.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 4: marching-squares ink contours + red level-0 nodal set"
```

---

### Task 5: Full-pipeline control effects (integration check)

The renderer and sidebar were wired in Task 1; the pipeline is complete after Task 4. This task verifies end-to-end control behavior — the seams between tasks.

**Files:**
- Test: `.superpowers/sdd/task-5-verify.js`
- Modify: `index.js` only if a defect is found.

**Interfaces:**
- Consumes: everything.
- Produces: confidence.

- [ ] **Step 1: Write verify script**

`.superpowers/sdd/task-5-verify.js` (boilerplate through `check`, then):

```javascript
function run(setup) {
    vm.runInContext(`
        ui.sources = 0; ui.mix = 1; ui.detail = 0; ui.density = 1; ui.settle = 1; ui.wobble = 0;
        ${setup}
        regenerate(false);
        globalThis.__snap = {
            sources: state.sources.length,
            contours: state.contours.length,
            cverts: state.contours.reduce((a, p) => a + p.length, 0),
            nodes: state.nodes.length
        };
    `, sandbox);
    return sandbox.__snap;
}

const base = run('state.masterSeed = 4242;');
check('base: contours + nodes populated', base.contours > 0 && base.nodes > 0 && base.sources >= 3);
check('base: substantial fringe (>1500 contour vertices)', base.cverts > 1500, `${base.cverts}`);

const sparse = run('state.masterSeed = 4242; ui.density = 0;');
const dense = run('state.masterSeed = 4242; ui.density = 2;');
check('density monotone: sparse < base < dense (chains)', sparse.contours < base.contours && base.contours < dense.contours,
    `${sparse.contours} / ${base.contours} / ${dense.contours}`);

const off = run('state.masterSeed = 4242; ui.settle = 0;');
const full = run('state.masterSeed = 4242; ui.settle = 2;');
check('settle changes geometry (off vs full differ)', off.cverts !== full.cverts, `off ${off.cverts} vs full ${full.cverts}`);

const s6 = run('state.masterSeed = 4242; ui.sources = 4;'); // '6'
check('Sources control effective', s6.sources === 6);

// full determinism across whole pipeline
vm.runInContext('ui.sources=0; ui.mix=1; ui.detail=0; ui.density=1; ui.settle=1; ui.wobble=0; state.masterSeed = 4242; regenerate(false); globalThis.__w1 = JSON.stringify({c: state.contours, n: state.nodes});', sandbox);
vm.runInContext('state.masterSeed = 4242; regenerate(false); globalThis.__w2 = JSON.stringify({c: state.contours, n: state.nodes});', sandbox);
check('full-pipeline determinism', sandbox.__w1 === sandbox.__w2);

// three fresh seeds survive the pipeline
let ok = 0;
for (const seed of [11, 222, 3333]) {
    const s = run(`state.masterSeed = ${seed};`);
    if (s.contours > 0 && s.cverts > 200) ok++;
}
check('3 fresh seeds all viable', ok === 3, `${ok}/3`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run verify**

Run: `node .superpowers/sdd/task-5-verify.js`
Expected: `7 passed, 0 failed`

If `base: substantial fringe (>1500 contour vertices)` fails at N=320, the default fringe is too sparse — the fix is the level count or the frequency band, both in earlier tasks. Do NOT lower the test threshold; report it and re-open Task 2 (frequency band) or Task 4 (LEVELS). If `settle changes geometry` fails (off === full), settle isn't moving sources enough to alter the drawn contours at this seed — try 2–3 other seeds in the test before treating it as a defect (some seeds legitimately settle to a near-identical state).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Task 5: full-pipeline control-effect verification"
```

---

### Task 6: Export — SVG pen passes + PNG

**Files:**
- Modify: `index.js` (replace `exportSVG`/`exportPNG` stubs; add `polyToPath`, `svgPass`, `buildSVG`)
- Test: `.superpowers/sdd/task-6-verify.js`

**Interfaces:**
- Consumes: `state.contours/nodes`, `wobblePts`, `signatureText`.
- Produces: `buildSVG() → string` (4 passes: Border, Contours, Nodes, Signature; M/L-only paths; red only in Nodes); `exportSVG()` downloads it; `exportPNG(scale)` re-renders at pixelDensity and saves (`scale` 1 or 4).

- [ ] **Step 1: Implement**

```javascript
function polyToPath(pts) {
    const w = wobblePts(pts);
    let d = `M ${w[0].x.toFixed(2)} ${w[0].y.toFixed(2)}`;
    for (let i = 1; i < w.length; i++) d += ` L ${w[i].x.toFixed(2)} ${w[i].y.toFixed(2)}`;
    return d;
}

function svgPass(label, color, weight, paths) {
    if (!paths.length) return '';
    let s = `  <g id="${label}" inkscape:groupmode="layer" inkscape:label="${label}" ` +
        `stroke="${color}" stroke-width="${weight}" fill="none" ` +
        `stroke-linecap="round" stroke-linejoin="round">\n`;
    for (const d of paths) s += `    <path d="${d}"/>\n`;
    s += '  </g>\n';
    return s;
}

function buildSVG() {
    const contourPaths = state.contours.map(polyToPath);
    const nodePaths = state.nodes.map(polyToPath);
    const borderPath = `M ${PAD} ${PAD} L ${CS - PAD} ${PAD} L ${CS - PAD} ${CS - PAD} ` +
        `L ${PAD} ${CS - PAD} L ${PAD} ${PAD}`;
    let s = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ` +
        `width="${CS}" height="${CS}" viewBox="0 0 ${CS} ${CS}">\n`;
    s += `  <rect width="${CS}" height="${CS}" fill="${PAPER}"/>\n`;
    s += svgPass('Border', INK, 0.9, [borderPath]);
    s += svgPass('Contours', INK, 0.5, contourPaths);
    s += svgPass('Nodes', RED, 1.0, nodePaths);
    s += `  <g id="Signature" inkscape:groupmode="layer" inkscape:label="Signature">\n` +
        `    <text x="${PAD}" y="${CS - PAD + 44}" font-family="monospace" font-size="26" ` +
        `fill="${INK}">${signatureText()}</text>\n  </g>\n`;
    s += '</svg>\n';
    return s;
}

function exportSVG() {
    const blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `interference-seed${state.masterSeed}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportPNG(scale) {
    pixelDensity(scale);
    renderAll();
    saveCanvas(`interference-seed${state.masterSeed}-${scale}x`, 'png');
    pixelDensity(1);
    renderAll();
}
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-6-verify.js` (boilerplate through `check`, then):

```javascript
vm.runInContext('ui.settle = 1; ui.density = 1; ui.detail = 0; ui.wobble = 0; state.masterSeed = 4242; regenerate(false);', sandbox);
const svg = vm.runInContext('buildSVG()', sandbox);

const labels = ['Border', 'Contours', 'Nodes', 'Signature'];
for (const l of labels) check(`pass present: ${l}`, svg.includes(`inkscape:label="${l}"`));
check('exactly 4 layer groups', (svg.match(/inkscape:groupmode="layer"/g) || []).length === 4);

// red only in the Nodes pass
const groups = svg.split('<g ').slice(1);
let redOK = true;
for (const g of groups) if (g.includes('#A93B2A') && !g.startsWith('id="Nodes"')) redOK = false;
check('red only in Nodes', redOK);

// M/L-only path data
const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
check('paths exist', ds.length > 10, `${ds.length}`);
check('M/L-only paths', ds.every(d => /^M( -?\d+(\.\d+)?){2}( L( -?\d+(\.\d+)?){2})+$/.test(d.replace(/ +/g, ' '))));

check('viewBox correct', svg.includes('viewBox="0 0 2170 2170"'));
check('signature in svg', /Interference · seed 4242 · \d+ sources · \d+ levels/.test(svg));

// wobble parity/determinism
vm.runInContext('ui.wobble = 1;', sandbox);
const w1 = vm.runInContext('buildSVG()', sandbox);
const w2 = vm.runInContext('buildSVG()', sandbox);
check('wobble deterministic across builds', w1 === w2);
check('wobble changes geometry', w1 !== svg);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-6-verify.js`
Expected: `11 passed, 0 failed`

Note: the p5-stub already exposes `randomSeed/random` (used by `wobblePts`). If `saveCanvas`/`pixelDensity` are missing from the stub, add no-ops to the SANDBOX object in the verify script, not to the stub file.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 6: SVG pen passes + PNG/PNG-4x export"
```

---

### Task 7: README + final multi-seed QA

**Files:**
- Create: `README.md`
- Test: `.superpowers/sdd/task-7-verify.js`

**Interfaces:**
- Consumes: everything.
- Produces: documentation + a timed multi-seed pipeline soak.

- [ ] **Step 1: Write README.md**

```markdown
# Interference

Overlapping coherent wave sources — radial ripples and linear gratings — superpose into
one scalar field. The page is the field's iso-contours: where two wave families nearly
align, contour spacing beats against itself and moiré emerges purely from line geometry.
One red curve family: the nodal set (level 0), where the waves cancel — the ripple-tank
dark bands, the Chladni silence.

Before plotting, the field tunes itself: from a random roll, sources drift phase and
position under a greedy hill-climb that maximizes a legibility metric (fringe density near
a target — neither empty nor mushed). No rating loop; the piece settles on its own.

## Running

Static files, no build step: serve the directory (`npx serve . --listen 3463`) and open
`index.html`.

## Controls

- **Field** — Sources (random/3/4/5/6) · Mix (Radial/Balanced/Linear source bias) · Detail (grid 320/400/480)
- **Fringe** — Density (Sparse/Medium/Dense contour count) · Settle (Off/Light/Full — hill-climb steps)
- **Style** — Wobble (default Off)
- randomize / refresh / svg / png / png 4x · click canvas = new seed

randomize rerolls Sources / Mix / Density / Settle with a new seed; Detail and Wobble are
left as you set them.

## Exports

Layered SVG pen passes (Border / Contours / Nodes / Signature) for two-pen plotting
(ink fringe + red nodal set); PNG at 1x (2170²) and 4x (8680²).

## How it works

- **Field:** `Σ Aᵢ·sin(kᵢ·φᵢ(x,y) + θᵢ)` where φ is radius (radial) or projected distance (linear).
- **Settle:** an 80² cheap grid estimates fringe density (fraction of cells a level line
  crosses); a greedy hill-climb perturbs source phases/positions, keeping only improvements.
- **Contours:** marching squares — M ink levels between the 5th–95th field percentiles
  (never coinciding with 0), plus the red level-0 nodal set.

## Family

[palimpsest](https://github.com/lukaszlysakowski/palimpsest) ·
[core-samples](https://github.com/lukaszlysakowski/core-samples) ·
[second-reading](https://github.com/lukaszlysakowski/second-reading) ·
[fold](https://github.com/lukaszlysakowski/fold) ·
[watershed](https://github.com/lukaszlysakowski/watershed) ·
[field-script](https://github.com/lukaszlysakowski/field-script)
```

- [ ] **Step 2: Write soak script**

`.superpowers/sdd/task-7-verify.js` (boilerplate through `check`, then):

```javascript
let allOK = true;
for (const seed of [17, 404, 9090, 123456, 777777]) {
    const t0 = Date.now();
    vm.runInContext(`ui.detail = 1; ui.density = 1; ui.settle = 2; state.masterSeed = ${seed}; regenerate(false);`, sandbox);
    const ms = Date.now() - t0;
    const st = sandbox.state;
    const cverts = st.contours.reduce((a, p) => a + p.length, 0);
    const ok = st.contours.length > 0 && cverts > 800 && st.nodes.length >= 0 && ms < 20000;
    console.log(`  seed ${seed}: ${st.sources.length} sources, ${st.contours.length} ink chains, ${cverts} verts, ${st.nodes.length} node chains, ${ms}ms ${ok ? 'ok' : 'FAIL'}`);
    if (!ok) allOK = false;
}
check('5-seed soak at N=400 + Full settle', allOK);

const svg = vm.runInContext('buildSVG()', sandbox);
check('soak SVG has all 4 passes', (svg.match(/inkscape:groupmode="layer"/g) || []).length === 4);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run soak**

Run: `node .superpowers/sdd/task-7-verify.js`
Expected: `2 passed, 0 failed`, each seed well under 20s (Full settle = 80 metric evals on an 80² grid + one 400² field build).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 7: README + multi-seed soak"
```

---

## Post-plan (controller, not a subagent task)

1. Add `interference` launch config (port 3463) to `/Users/lukasz/claude/self-redaction/.claude/launch.json`.
2. Browser gate: start the dev server, screenshot at defaults + several randomizes, check fringe/moiré legibility and the red nodal set reading distinctly against ink; tune canvas stroke weights if needed (SVG weights are spec-fixed; canvas is presentation). Confirm settle visibly improves mushy/sparse rolls.
3. Final review: fresh independent subagent (most capable model), zero deference to inline work; triage any recorded Minor findings.
4. GitHub publish only when the user asks.
