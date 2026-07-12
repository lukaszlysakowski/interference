// Task 2 verification: wave sources + field superposition + grid sampling
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
