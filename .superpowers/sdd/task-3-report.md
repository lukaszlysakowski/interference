# Task 3: Settle — Greedy Hill-Climb Toward Target Fringe Density

**Status:** ✅ Complete

## Timeline

- **Step 1: Implement constants & functions** ✅
  - Added SETTLE_N=80, TARGET_DENSITY=0.42, fringeDensity(), settleScore(), settle()
  
- **Step 2: Create verify script** ✅
  - Created .superpowers/sdd/task-3-verify.js with 6 checks
  
- **Step 3: Run verify** ✅
  - Result: 6 passed, 0 failed
  
- **Step 4: Commit** ✅
  - Hash: `0413117`

## Decisions

- Kept brief's threshold `improved >= 5` (not loosened to 3); test passed, algorithm validated
- Added `randomSeed()` calls to determinism test (not in brief) to reset p5 RNG state between runs

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
