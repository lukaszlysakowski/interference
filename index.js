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

// --- wave superposition pipeline ---

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
