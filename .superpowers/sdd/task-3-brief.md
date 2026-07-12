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

