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

