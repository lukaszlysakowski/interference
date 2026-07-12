# Task 3: Settle — Greedy Hill-Climb Toward Target Fringe Density

**Status:** In progress

## Timeline

- **Step 1: Implement constants & functions** — In progress
  - Add SETTLE_N, TARGET_DENSITY, fringeDensity, settleScore, settle
  
- **Step 2: Create verify script** — Pending
  - .superpowers/sdd/task-3-verify.js
  
- **Step 3: Run verify** — Pending
  - Expected: 6 passed, 0 failed
  
- **Step 4: Commit** — Pending

## Decisions

(none yet)

## Verify Output

```
  ok  Settle Off: sources unchanged
  ok  fringeDensity in [0,1]
  ok  settle improves-or-holds score
  ok  settle improves on most seeds
  ok  settle deterministic
  ok  regenerate determinism with settle

6 passed, 0 failed
```

## Verify Notes

- **Settle improves on most seeds**: Passed with threshold >= 5/8. Perturbation scales are appropriate.
  
- **Determinism fix**: Verify script required explicit `randomSeed()` calls before `rollSources()` in determinism test because p5 RNG state carries over from improves test. Added `randomSeed(99)` before each call to ensure identical starting conditions.
