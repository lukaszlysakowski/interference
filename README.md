# Interference

> *[Second Reading](https://github.com/lukaszlysakowski/second-reading) rereads itself, **Interference tunes itself**, [Drift](https://github.com/lukaszlysakowski/drift) remembers itself — and [Attrition](https://github.com/lukaszlysakowski/attrition) forgets itself.*

Overlapping coherent wave sources — radial ripples and linear gratings — superpose into
one scalar field. The page is the field's iso-contours: where two wave families nearly
align, contour spacing beats against itself and moiré emerges purely from line geometry.
One red curve family: the nodal set (level 0), where the waves cancel — the ripple-tank
dark bands, the Chladni silence.

Before plotting, the field tunes itself: from a random roll, sources drift phase and
position under a greedy hill-climb that maximizes a legibility metric (fringe density near
a target — neither empty nor mushed). No rating loop; the piece settles on its own.

**Live maker:** https://lukaszlysakowski.github.io/interference/

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
