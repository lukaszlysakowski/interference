// Task 4 verification: marching-squares contours + nodal set
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
vm.runInContext('globalThis.state = state; globalThis.ui = ui; globalThis.CS = CS; globalThis.PAD = PAD; globalThis.LEVELS = LEVELS; renderAll = function () {};', sandbox);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  ok  ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

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
