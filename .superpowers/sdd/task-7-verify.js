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
