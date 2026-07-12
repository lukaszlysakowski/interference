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

