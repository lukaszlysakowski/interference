# Interference — Generative Plotter Art

## Project
A p5.js maker: coherent wave sources (radial ripples + linear gratings) superpose into a scalar field that self-tunes toward legible fringe density, rendered as ink iso-contours with a red level-0 nodal set. "A field tuned into legibility." Moiré emerges from the beat between contour families — pure line geometry, no shading. Public repo: https://github.com/lukaszlysakowski/interference — live maker: https://lukaszlysakowski.github.io/interference/

## The pipeline (the load-bearing part)
- `rollSources` → `settle` → `buildGrid` → `buildContours` → `renderAll`. Ordering is the state contract: `settle` mutates `state.sources` in place, `buildGrid` samples the settled sources.
- **Sources:** radial `A·sin(k·r + φ)` (r = distance from `(sx,sy)`) or linear `A·sin(k·(x·cosθ + y·sinθ) + φ)`. `fieldAt = Σ sourceAt` — pure superposition, order-independent. Mix control biases the radial/linear roll.
- **Settle (greedy hill-climb):** an 80² cheap grid estimates fringe density (fraction of cells whose 4-corner span exceeds the contour interval); each step perturbs source phases/positions by a seeded delta and keeps it only if the score improves toward TARGET_DENSITY (0.42). Off/Light/Full = 0/30/80 steps. The backup/revert is NON-ALIASING — fresh source clones each step.
- **Contours:** marching squares (ported from Watershed). M ink levels between the field's 5th–95th percentiles (Density = 5/9/14); any ink level within eps (2% of range) of 0 is nudged off it so it never collides with the nodal pass. RED nodal set = marching squares at level exactly 0.

## Determinism contract
`Math.random` ONLY at seed choice + `randomizeAll`. `rollSources` runs after `randomSeed(masterSeed)`; `settle` uses `seededRng(masterSeed + s*1013)` (mulberry32, independent of p5's RNG); `wobblePts` reseeds from `pts[0].x*0.01+50` and feeds BOTH `drawPoly` and `polyToPath` (canvas/SVG parity).

## Chain-key precision (improvement over Watershed's kit)
`marchLevel` chains segments with key `toFixed(6)`, NOT Watershed's `toFixed(3)`. Shared marching-squares vertices on a cell edge are computed bit-identically (same corner values, same level → same interpolation), so higher precision can't un-merge a real join; `toFixed(3)` risked FALSE merges of distinct nearby vertices in dense/high-frequency fields (spurious junctions breaking clean chains). Candidate back-port to Watershed if it ever shows the same artifact.

## Aesthetic note
Balanced/Linear mix reads as watered silk / straight moiré; Radial mix gives concentric "stones in a pond" interference. The red nodal set is the ripple-tank / Chladni-plate silence. If the field never crosses 0, `state.nodes` is empty (handled).

## Data-model gotchas
- Grid row-major `idx = y*N + x`; sample at page point `PAD+(x+0.5)*cell`.
- `state.field` built from the SETTLED sources; contour percentiles sort a `Float64Array.from(field)` copy (never mutate state.field).
- Container div id is `canvas-container` (Fold/Watershed CSS targets it).

## Lineage
- Wave superposition + iso-contour extraction — the moiré / ripple-tank / Chladni-figure / holographic-fringe tradition rendered as pen lines.
- One of the "abstract evolution of Field Script, no manual feedback loop" trio with [second-reading](https://github.com/lukaszlysakowski/second-reading) (self-regulation without a rating UI) and Drift (unbuilt). Shared contour engine from [watershed](https://github.com/lukaszlysakowski/watershed).
- Siblings: [palimpsest](https://github.com/lukaszlysakowski/palimpsest) (CSS/a11y source), [core-samples](https://github.com/lukaszlysakowski/core-samples), [fold](https://github.com/lukaszlysakowski/fold), [field-script](https://github.com/lukaszlysakowski/field-script)
- Design history + per-task review trail: `docs/superpowers/` and `.superpowers/sdd/progress.md`

## Architecture
- `index.html` / `index.js` — single maker, no build step, p5 vendored; static serve (launch config `interference`, npx serve port 3463)

## Palette & A11y
Square 2170×2170. Paper #F7E6D4, ink #1A1613, nodal red #A93B2A (only red on the page). Sidebar CSS from Watershed/Fold (WCAG-tuned: --muted #969082, .ctrl min-height 24px) — Lighthouse a11y 100; don't regress.

## Controls
Field (Sources random/3/4/5/6 / Mix Radial–Balanced–Linear / Detail grid 320–400–480) · Fringe (Density Sparse–Medium–Dense / Settle Off–Light–Full) · Style (Wobble, default Off) · randomize / refresh / svg / png / png 4x · click canvas = new seed. randomize rerolls Sources/Mix/Density/Settle (leaves Detail + Wobble). SVG pen passes: Border / Contours / Nodes (red) / Signature.
