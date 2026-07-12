### Task 6: Export — SVG pen passes + PNG

**Files:**
- Modify: `index.js` (replace `exportSVG`/`exportPNG` stubs; add `polyToPath`, `svgPass`, `buildSVG`)
- Test: `.superpowers/sdd/task-6-verify.js`

**Interfaces:**
- Consumes: `state.contours/nodes`, `wobblePts`, `signatureText`.
- Produces: `buildSVG() → string` (4 passes: Border, Contours, Nodes, Signature; M/L-only paths; red only in Nodes); `exportSVG()` downloads it; `exportPNG(scale)` re-renders at pixelDensity and saves (`scale` 1 or 4).

- [ ] **Step 1: Implement**

```javascript
function polyToPath(pts) {
    const w = wobblePts(pts);
    let d = `M ${w[0].x.toFixed(2)} ${w[0].y.toFixed(2)}`;
    for (let i = 1; i < w.length; i++) d += ` L ${w[i].x.toFixed(2)} ${w[i].y.toFixed(2)}`;
    return d;
}

function svgPass(label, color, weight, paths) {
    if (!paths.length) return '';
    let s = `  <g id="${label}" inkscape:groupmode="layer" inkscape:label="${label}" ` +
        `stroke="${color}" stroke-width="${weight}" fill="none" ` +
        `stroke-linecap="round" stroke-linejoin="round">\n`;
    for (const d of paths) s += `    <path d="${d}"/>\n`;
    s += '  </g>\n';
    return s;
}

function buildSVG() {
    const contourPaths = state.contours.map(polyToPath);
    const nodePaths = state.nodes.map(polyToPath);
    const borderPath = `M ${PAD} ${PAD} L ${CS - PAD} ${PAD} L ${CS - PAD} ${CS - PAD} ` +
        `L ${PAD} ${CS - PAD} L ${PAD} ${PAD}`;
    let s = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ` +
        `width="${CS}" height="${CS}" viewBox="0 0 ${CS} ${CS}">\n`;
    s += `  <rect width="${CS}" height="${CS}" fill="${PAPER}"/>\n`;
    s += svgPass('Border', INK, 0.9, [borderPath]);
    s += svgPass('Contours', INK, 0.5, contourPaths);
    s += svgPass('Nodes', RED, 1.0, nodePaths);
    s += `  <g id="Signature" inkscape:groupmode="layer" inkscape:label="Signature">\n` +
        `    <text x="${PAD}" y="${CS - PAD + 44}" font-family="monospace" font-size="26" ` +
        `fill="${INK}">${signatureText()}</text>\n  </g>\n`;
    s += '</svg>\n';
    return s;
}

function exportSVG() {
    const blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `interference-seed${state.masterSeed}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportPNG(scale) {
    pixelDensity(scale);
    renderAll();
    saveCanvas(`interference-seed${state.masterSeed}-${scale}x`, 'png');
    pixelDensity(1);
    renderAll();
}
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-6-verify.js` (boilerplate through `check`, then):

```javascript
vm.runInContext('ui.settle = 1; ui.density = 1; ui.detail = 0; ui.wobble = 0; state.masterSeed = 4242; regenerate(false);', sandbox);
const svg = vm.runInContext('buildSVG()', sandbox);

const labels = ['Border', 'Contours', 'Nodes', 'Signature'];
for (const l of labels) check(`pass present: ${l}`, svg.includes(`inkscape:label="${l}"`));
check('exactly 4 layer groups', (svg.match(/inkscape:groupmode="layer"/g) || []).length === 4);

// red only in the Nodes pass
const groups = svg.split('<g ').slice(1);
let redOK = true;
for (const g of groups) if (g.includes('#A93B2A') && !g.startsWith('id="Nodes"')) redOK = false;
check('red only in Nodes', redOK);

// M/L-only path data
const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
check('paths exist', ds.length > 10, `${ds.length}`);
check('M/L-only paths', ds.every(d => /^M( -?\d+(\.\d+)?){2}( L( -?\d+(\.\d+)?){2})+$/.test(d.replace(/ +/g, ' '))));

check('viewBox correct', svg.includes('viewBox="0 0 2170 2170"'));
check('signature in svg', /Interference · seed 4242 · \d+ sources · \d+ levels/.test(svg));

// wobble parity/determinism
vm.runInContext('ui.wobble = 1;', sandbox);
const w1 = vm.runInContext('buildSVG()', sandbox);
const w2 = vm.runInContext('buildSVG()', sandbox);
check('wobble deterministic across builds', w1 === w2);
check('wobble changes geometry', w1 !== svg);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-6-verify.js`
Expected: `11 passed, 0 failed`

Note: the p5-stub already exposes `randomSeed/random` (used by `wobblePts`). If `saveCanvas`/`pixelDensity` are missing from the stub, add no-ops to the SANDBOX object in the verify script, not to the stub file.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 6: SVG pen passes + PNG/PNG-4x export"
```

---

