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
