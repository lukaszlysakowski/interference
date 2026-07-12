// Task 5 verification: full-pipeline control effects (integration check)
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
