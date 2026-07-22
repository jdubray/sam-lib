# sam-fsm Compatibility Pass — sam-lib 2.0.0-alpha.0

Date: 2026-07-12 · sam-fsm master (`267c3ad`) tested against the `v2` branch build.

## Verdict: drop-in compatible (default mode)

The full sam-fsm test suite was run against three sam-pattern versions with identical results — **48 passing, 3 failing** in every case:

| sam-pattern | passing | failing |
|---|---|---|
| 1.6.0 (sam-fsm's installed baseline) | 48 | 3 |
| 1.6.1 (latest published) | 48 | 3 |
| **2.0.0-alpha.0 (v2 branch)** | **48** | **3** |

The 3 failures are pre-existing on sam-fsm master and independent of the sam-lib version. v2 introduces **zero regressions**. sam-fsm's test node_modules were restored to the lockfile state afterward.

### The 3 pre-existing sam-fsm failures (not v2's)

All three look like test-expectation drift from the 1.0.0 "guard condition robustness" changes, not runtime defects:

1. `FSM tests › should enforce transitions and return an error for an invalid transition` — the error message now names the *previous* state (`for state: TOCKED`, per `lib/fsm.js` smr, which validates the action against `previousState`), while the test still expects the *current* state (`TICKED`).
2. `FSM extended tests › stateMachineReactor › should set an error for an unexpected action given a known previous state` — same message/state drift.
3. `FSM extended tests › nap generation › should fire a nap when state and condition match` — boolean expectation inverted vs. current nap return convention.

These should be fixed in the sam-fsm repo (test updates, most likely).

## Strict-profile smoke test

An fsm-generated component (deterministic clock, `enforceAllowedTransitions`, `blockUnexpectedActions`) was mounted on a `createInstance({ strict: true })` instance:

- **Works** with a two-line shape declaration:
  ```js
  modelShape: {
    pc:   { type: 'string' },
    pc_1: { type: 'string', nullable: true, internal: true }
  }
  ```
  Transitions run, `getState()` snapshots exclude `pc_1`, and `lastStep()` reports fsm steps correctly (`intent: 'TOCK', mutations: ['pc_1','pc'], classification: 'mutated'` — labeled v1 actions carry their names into step records).
- **Without the declaration**, the first transition throws `SamShapeError` on `pc_1` — sam-fsm's previous-state bookkeeping is, by v2's own definition, hidden state. Correct behavior, but it means strict adoption requires the shape lines above (sam-fsm v2 should emit them, see below).

## Work items for sam-fsm v2

1. **Emit a `modelShape` fragment.** `fsm()` already knows `pc`, `pc_1`, and the component name — it should return a `modelShape` (with `pc_1` marked `internal`) that callers spread into their component, the way they already spread `clock.acceptors`.
2. **Named intent registration.** fsm actions are registered v1 array-style, so `validate()` fails with "no named intents registered" on an otherwise-working strict instance. `fsm()` should offer its actions as a named map with schemas derived from the transition alphabet — it already has the action names.
3. **Domains from the transition system.** The fsm's action alphabet plus representative payloads is exactly an input-domain manifest; `fsm()` can generate `domain` entries so a strict fsm spec is checker-explorable with zero configuration.
4. **Gating is invisible to enabledness observability.** `blockUnexpectedActions` gates invalid intents via `allowedActions`, so a blocked intent never presents — no step, no rejection, indistinguishable from not firing. sam-fsm v2 should (optionally) route blocked actions through `reject(reason)` instead, so exploration harnesses can classify them (`unexpected action X for state: Y` as a rejection reason).
5. **Fix the 3 stale test expectations** on sam-fsm master (independent of v2).

## 2.1.0 next-state pass (2026-07-22)

sam-lib 2.1.0's #25 next-state contract (frozen pre-state, `next` draft, explicit frame) broke sam-fsm's strict-profile integration: the deterministic acceptor wrote `pc`/`pc_1` in place (SamShapeError on the frozen model), and the invalid-transition `__error` path framed nothing (SamFrameError, empty frame). Default mode was unaffected (58/58 green throughout).

Fixed in sam-fsm 2.1.0 (`lib/fsm.js`, `stateMachineAcceptors`):

- writes go through `stepApi.next` when present (`writeTarget`), falling back to in-place on v1/default instances — reads always come from `model` (pre-state);
- the target state is captured before writing (with a draft, `model` still holds the pre-state after the write — the old code re-read `model[pc]` to get the new state);
- `frameOwnVars`: the fsm speaks for its own variables — on any step where it does not assign `pc`/`pc_1` (a foreign machine's action, or an invalid transition kept in the `__error` slot) it declares them `unchanged`, so multi-machine strict instances frame cleanly. It deliberately never frames `'*'`, which would vacuously satisfy the frame for user variables. Component-scoped machines write component-local state outside the instance `modelShape` — no framing there.

Non-deterministic (user-supplied per-state) acceptors are the caller's migration responsibility, like any strict acceptor (see `docs/MIGRATION.md` v2.1).

Result: sam-fsm 63/63 against sam-pattern 2.1.0, including a multi-machine strict test.
