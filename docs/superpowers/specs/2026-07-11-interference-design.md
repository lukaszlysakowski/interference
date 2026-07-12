# Interference — Design Spec (2026-07-11)

## Concept

**Interference — a field tuned into legibility.** Several coherent wave sources (a rolled
mix of radial ripples and linear sine gratings) superpose into one scalar field. The field
is invisible until we extract curves from it: the page is ink iso-contours of the sum, and
where two wave families nearly align, contour spacing beats against itself — dense fringe
here, open water there. That beat *is* the moiré; it is not drawn, it emerges from line
geometry. One red curve family: the nodal set (level 0), where waves cancel — the
physically-true interference signature, threading through the ink fringe.

Before plotting, the field **tunes itself**: from a random roll, sources drift phase and
position under a greedy hill-climb that maximizes a legibility metric (fringe density near
a target — neither empty nor mushed). Autonomous, deterministic, no rating UI — the
post-Core-Samples philosophy. Plan view, square 2170×2170. Reads as watered silk,
ripple-tank photographs, holographic fringe.

Decisions made during brainstorming (user-approved):
- **What plots:** iso-contours of the summed field (moiré emerges from contour beat).
- **Sources:** mixed radial ripples + linear gratings (widest compositional range).
- **Red:** the nodal set (level 0, zero-crossings).
- **Autonomy:** settle toward legibility via greedy hill-climb (no rating system).
- **Format:** square 2170×2170, matching Fold and Watershed.
- **Scope:** full family maker, local git repo first; GitHub publish only when asked.

## Page & livery

- Canvas 2170×2170 (`CS = 2170`), `PAD = round(CS·0.04)` (= 87).
- Paper `#F7E6D4`, ink `#1A1613`, red `#A93B2A` (the nodal set is the ONLY red).
- Border rectangle at PAD; signature bottom-left inside border:
  `Interference · seed N · <K> sources · <M> levels  YYYY-MM-DD HH:MM`.
- House idiom: single `index.html` + `index.js`, vendored `p5.min.js`, no build step.
- Sidebar CSS copied from Watershed/Fold (a11y floor: `--muted #969082`,
  `.ctrl min-height 24px`; Lighthouse a11y 100 — never regress). Container div id
  `canvas-container` (Fold CSS targets it).

## Engine

### Sources

A plan-level roll (from `masterSeed`) picks `K` = 3–6 sources (Sources control:
random/3/4/5/6). Each source is one of:

- **radial:** `A·sin(k·r + φ)`, `r = hypot(x−sx, y−sy)`, source point `(sx, sy)` within
  the drawable square (may sit slightly outside for off-page centers).
- **linear:** `A·sin(k·(x·cosθ + y·sinθ) + φ)`, plane wave at angle `θ`.

Per-source rolls: type (biased by the Mix control: Radial → mostly radial, Linear →
mostly linear, Balanced → ~50/50), `A` in [0.6, 1.4] (mild spread so one source can
dominate), `k` in a band giving ~8–40 wavelengths across the page, `φ` in [0, 2π),
plus `(sx, sy)` for radial or `θ` for linear.

`field(x, y) = Σ sourceᵢ(x, y)` — pure superposition, order-independent, deterministic.

All rolls at plan level; `Math.random` ONLY at seed choice + `randomizeAll`. Everything
downstream of `randomSeed(masterSeed)` is pure. Settle deltas are seeded per step.

### Grid

Sample the settled field on an N×N grid (N = 320/400/480 via Detail, default 400)
spanning `PAD..CS−PAD` both axes, row-major `idx = y·N + x`, sampled at page point
`PAD + (x+0.5)·cell`. Stored as `Float64Array`.

### Settle (greedy hill-climb)

- **Metric — fringe density.** Sample the field on a cheap `SETTLE_N`² grid (≈ 80²).
  Estimate the fraction of the page a contour family would cross: compute the field range
  on the cheap grid, derive the contour interval for the current level count `M`, and for
  each cheap cell count it as "crossed" if the field span across the cell (max−min of its
  4 corners) ≥ interval. `density = crossed / totalCells`. Score `= −|density − TARGET|`
  (`TARGET ≈ 0.42`, tuned in implementation).
- **Steps.** Settle control: Off = 0, Light ≈ 30, Full ≈ 80 steps. Each step perturbs
  every source's `φ` by a seeded small delta and its position (`sx,sy` for radial) or
  `θ` (linear) by a seeded small delta; recompute metric on the cheap grid; keep the
  perturbation if score improved, else revert. Deterministic given seed (step `s` uses a
  seeded RNG `masterSeed + s·1013`).
- After settling, the full N² field and all contours are computed **once**.

### Contours (marching squares — Watershed's engine, ported)

- **Ink contours:** `M` evenly-spaced NON-ZERO levels between the field's 5th and 95th
  percentiles (Density control: Sparse/Medium/Dense → M = 5/9/14). A level that lands
  within a small epsilon of 0 is nudged off 0 so it never coincides with the nodal pass.
- **Red nodal set:** marching squares at level exactly 0 — its own pass.
- Chaikin smoothing ×2 (endpoints preserved), same as Watershed's divide.
- Chaining via the ported `chainSegments(segs, keyFn)` with a float key.

## Rendering & export

Draw order (back → front): paper → ink contours → red nodal set → border → signature.

SVG pen passes via family `svgPass(label, color, weight, paths)` — M/L-only paths:

| Pass       | Color | Weight |
|------------|-------|--------|
| Border     | ink   | 0.9    |
| Contours   | ink   | 0.5    |
| Nodes      | red   | 1.0    |
| Signature  | ink   | 0.9    |

- Canvas/SVG parity: identical geometry arrays feed both renderers.
- Wobble (Style control, default OFF): seeded from `pts[0].x·0.01+50` in BOTH renderers.
- Exports: SVG, PNG, PNG 4x (8680²) via `exportPNG(scale)` pixelDensity re-render
  (ported from Watershed/Fold).

## Maker UI

Family sidebar (cycleCtrl / CONTROL_DEFS / setupControls / randomizeAll):

- **Field:** Sources (random/3/4/5/6) · Mix (Radial/Balanced/Linear) · Detail (320/400/480)
- **Fringe:** Density (Sparse/Medium/Dense, default Medium) · Settle (Off/Light/Full,
  default Light)
- **Style:** Wobble (On/Off, default Off)
- Buttons: randomize / refresh / svg / png / png 4x.
- Click canvas = new seed, same params. Randomize = reroll aesthetic controls + new seed
  (Detail and Wobble left as set, per family convention). Refresh = new seed, same params.
- No rating/learning system.

## Testing

Node harness: `.superpowers/sdd/p5-stub.js` (seeded splitmix32) + `vm.runInContext` of the
real `index.js` with localStorage/fetch/document/confirm shims (ported from
watershed/.superpowers/sdd/). Per-task verify scripts assert at minimum:

1. Sources & field: superposition is order-independent and matches sum of individual
   sources (< 1e-9); rollSources deterministic per seed; Mix control biases type counts;
   Sources control sets K.
2. Settle: metric is monotone non-decreasing across accepted steps (score after ≥ score
   before for every kept step); settle is seed-deterministic (same seed → same settled
   sources); Off = 0 steps leaves sources at their rolled values.
3. Contours: marching-squares paths closed or border-terminated; ink level count = M for
   the Density setting; no ink level coincides with 0.
4. Nodal set: red pass contains only level-0 crossings (every red vertex has |field| below
   a small tolerance on the sampled field); nodal set empty iff field never crosses 0.
5. Determinism: same seed twice → deep-equal contours + nodes arrays.
6. Export: SVG contains exactly the 4 passes, M/L-only path data, red appears only in the
   Nodes pass; signature format correct.
7. Multi-seed soak at N=400: 5 seeds produce non-empty contour sets within a time bound.

Build process: subagent-driven development with the timeout-resilience protocol in the
ledger (incremental commits, early report files, controller-inline fallback with
attribution, fresh independent final review — the Fold/Watershed protocol).

## Infrastructure

- New git repo at `/Users/lukasz/genuary-2026/sketches/interference`.
- Launch config `interference`: `npx serve <dir> --listen 3463`, port 3463, added to
  `/Users/lukasz/claude/self-redaction/.claude/launch.json`.
- Read-only sources (never modify): `~/genuary-2026/sketches/watershed/*` (contour kit +
  harness + CSS lineage), `~/genuary-2026/sketches/fold/*`.
- GitHub publish deferred until the user asks.

## Lineage

Wave superposition + iso-contour extraction — the moiré/interference-pattern tradition
(ripple tanks, Chladni figures, holographic fringe) rendered as pen lines. Sibling of the
autonomous-system pieces: [[second-reading-project]] (self-regulation without a rating UI)
and the shared contour engine from [[watershed-project]]. Family: palimpsest, core-samples,
second-reading, fold, watershed, field-script.
