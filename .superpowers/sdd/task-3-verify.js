// Task 3 verification: settle greedy hill-climb toward target fringe density
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
vm.runInContext('randomSeed(99); ui.settle = 2; state.masterSeed = 99; rollSources(); settle(); globalThis.__d1 = JSON.stringify(state.sources);', sandbox);
vm.runInContext('randomSeed(99); state.masterSeed = 99; rollSources(); settle(); globalThis.__d2 = JSON.stringify(state.sources);', sandbox);
check('settle deterministic', sandbox.__d1 === sandbox.__d2);

// full regenerate at Full settle stays deterministic end-to-end
vm.runInContext('ui.settle = 2; state.masterSeed = 31; regenerate(false); globalThis.__g1 = state.field[9999];', sandbox);
vm.runInContext('state.masterSeed = 31; regenerate(false); globalThis.__g2 = state.field[9999];', sandbox);
check('regenerate determinism with settle', sandbox.__g1 === sandbox.__g2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
