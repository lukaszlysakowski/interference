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

