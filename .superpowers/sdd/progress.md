# Interference — SDD Progress Ledger

## Timeout-resilience protocol (binding)
- Implementers: commit incrementally after each step; create task-N-report.md at task START and update as you go.
- Controller: a tiny result or "session limit" text = limit-killed subagent. Do NOT re-dispatch until reset; salvage from git + working tree first.
- Fallback: CONTROLLER INLINE with explicit ledger attribution.
- Final review: fresh independent subagent (most capable model), zero deference to inline work.

## Task log
Task 1: complete (commits c6f21de..4bf6977, verify 6/6, review clean incl browser load; canvas-container id correct, no Watershed bug recurrence; CSS byte-identical to Watershed)
Task 2: complete (commits 9176622..f88abb5, verify 8/8, review clean; verbatim transcription). Launch config interference:3463 added by controller.
Task 3: complete (commits 0413117..42feb29, verify 6/6, review clean; index.js verbatim). Verify determinism test added randomSeed() before direct rollSources() calls — legit test-isolation (settle uses only seededRng; production regenerate calls randomSeed). Threshold kept at 5/8 (8/8 actual).
Task 4: complete (commits 9a4744a..cac56a4, verify 6/6, review clean). DEVIATION (validated as strictly safer): chain key fkey changed .toFixed(3)→.toFixed(6) to fix 3 chains failing closure; shared MS vertices are bit-identical so higher precision can't un-merge them, while toFixed(3) risked FALSE merges in dense/high-freq fields. NOTE for final review: Watershed uses toFixed(3) in the same ported code — candidate back-port if it ever shows spurious junctions, but not urgent.
