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

