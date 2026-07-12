// Interference — wave-source superposition tuned into legible fringe.
// Family: palimpsest / core-samples / second-reading / fold / watershed.

const CS = 2170;
const PAD = Math.round(CS * 0.04);
const PAPER = '#F7E6D4';
const INK = '#1A1613';
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
    const fkey = (x, y) => x.toFixed(6) + ',' + y.toFixed(6);
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
