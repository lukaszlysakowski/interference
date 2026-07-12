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

