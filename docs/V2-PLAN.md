# sam-lib v2 — Implementation Plan (Strict Profile)

**Branch:** `v2` · **Target version:** `2.0.0` (published as `@cognitive-fab/sam-pattern@2.0.0`, npm tag `next` until stable)

## Motivation

Three studies comparing SAM and TLA+ (most recently *"Load-Bearing for Verification, Not for Robustness"*, `sysmobench`) validated SAM's core design — the acceptor/mutation guard–effect separation and the single synchronized step are exactly what make specs explorable, transpilable to TLA+, determinism-checkable, and locally repairable. But the studies also priced four places where the pattern relies on **convention** where it should rely on **construction**, and every observed failure class maps to one of them. v2 moves those obligations from documentation into the library, as an **opt-in strict profile** so existing v1 applications run untouched.

The requirements are filed as issues [#20](https://github.com/jdubray/sam-lib/issues/20)–[#24](https://github.com/jdubray/sam-lib/issues/24). The study's failure table is the acceptance suite:

| Observed failure | Root cause in v1 | v2 fix | Issue |
|---|---|---|---|
| Silent no-op machines (5/5 Haiku: action creators dropped payloads, all acceptors early-returned; survived repair rounds) | Positional intent destructuring + untyped proposals | Named intents + payload schemas | #20 |
| Hidden bookkeeping state (`_votes`, `_voteState`): broke replay pinning, transpilation, repair | Model is an open JS object | Declared, sealed model shape (SAM's `VARIABLES`) | #21 |
| Rejection indistinguishable from oversight; triage was detective work | Guards fail by silent fall-through | First-class `reject(reason)` — observable enabledness | #22 |
| Switch-dispatch monolith acceptor (bare `next()` smuggled into the ceremony) | Every acceptor sees every proposal | Per-action (keyed) acceptor registration | #23 |
| `checkerIntents` had to be bolted onto the harness, yet was essential to exploration and transpilation | No native input-domain concept | Per-intent domain manifest (SAM's `CONSTANTS`) | #24 |

## Design principles

1. **Strict is opt-in.** `createInstance({ strict: true })`. Default behavior is v1-compatible; strict mode turns conventions into thrown exceptions (per project preference: exceptions, not error codes). The strict profile is the recommended target for LLM-generated specs and any spec meant to be verified.
2. **Construction over convention.** Anything the pattern requires must be either impossible to get wrong or a loud failure on first use — never a silent no-op.
3. **Every declared obligation is mechanically checkable.** The explorer, transpiler, replayer, and determinism checker must be able to read intents, schemas, model shape, domains, and rejection traces off the instance with zero side-channel configuration.
4. **TDD.** Each phase lands as failing tests first (mocha, `test/v2/*.test.js`), then implementation. The five failure classes above each get a regression test that reproduces the study's defect and asserts the strict-mode throw/warning.

## API sketch (strawman — refine per phase)

```js
const instance = createInstance({ strict: true })

instance({
  initialState: { role: 'follower', term: 0, votedFor: null },

  component: {
    // #21 — declared observable state (SAM's VARIABLES)
    modelShape: {
      role:     { type: 'string' },
      term:     { type: 'number' },
      votedFor: { type: 'string', nullable: true },
      tally:    { type: 'object', internal: true }   // visible to tooling, excluded from snapshots
    },

    // #20 — named intents with payload schemas; #24 — declared input domains
    actions: {
      ElectionTimeout: {
        action: ({ node }) => ({ node }),
        schema: { node: { type: 'string', required: true } },
        domain: [{ node: 'n1' }, { node: 'n2' }, { node: 'n3' }]
      }
    },

    // #23 — keyed acceptors: framework binds proposal to action, bodies are guard + mutation only
    acceptors: {
      ElectionTimeout: model => (proposal, { reject }) => {
        if (model.role === 'leader') return reject('leaders do not time out')  // #22
        model.role = 'candidate'
        model.term += 1
      },
      '*': model => proposal => { /* explicitly-marked cross-cutting acceptor */ }
    }
  }
})

const { intents } = instance({})
intents.ElectionTimeout({ node: 'n1' })   // by name — positional destructuring retired in strict mode
```

Strict-mode guarantees:
- Proposal missing a required schema field → **throws** at the pattern layer (`SamSchemaError`).
- Writing an undeclared model key in an acceptor → **throws** (`SamShapeError`); sealed via `Object.seal`/Proxy.
- `getState()` derives from `modelShape` (retires the hand-rolled `__`-prefix sanitize idiom in `sam-instance.js`); `setState(getState())` round-trip is total over the declared shape.
- Per-step rejection log: `instance.lastStep()` → `{ intent, mutated, rejections: [{ intent, reason }] }`. A step where an intent fired, nothing mutated, and nothing rejected is classifiable as **unhandled** (dev-mode warning: "possibly never enabled").
- `instance.validate()` fails if any intent lacks a schema or domain (strict mode).
- `instance.manifest()` exposes `{ intents, schemas, domains, modelShape }` for external tools (explorer, transpiler, linter).

## Phases

Dependency order: #20 is the foundation (names are what acceptors key on and domains attach to); #21 and #22 are independent of each other; #23 and #24 build on #20.

### Phase 0 — Scaffolding (this commit)
- `v2` branch, this plan, version bump to `2.0.0-alpha.0`.
- `test/v2/` directory; CI script runs both suites (v1 suite must stay green throughout — backward-compat gate).
- `lib/sam-strict.js` module skeleton + `strict` option plumbed through `createInstance`.

### Phase 1 — Named intents + payload schemas (#20)
- `component.actions` accepts an object map (name → `{ action, schema }`); array form still works in default mode.
- `intents` returned as an object keyed by name (keep array iterability for v1 callers in default mode).
- Schema validation of the proposal *after* the action runs, before acceptors: missing required field throws `SamSchemaError` in strict mode, `console.warn` in default mode.
- Never-enabled heuristic: dev-mode warning when an intent has fired N times (default 3) with zero model mutations and zero rejections.
- **Regression test:** a zero-argument action creator that drops its payload → first fire throws (strict) / warns loudly (default). This is the Haiku failure class.

### Phase 2 — Declared, sealed model shape (#21)
- `component.modelShape`: declared keys with `{ type, nullable?, derived?, internal? }`.
- Strict mode wraps the model in a Proxy: writes to undeclared keys throw `SamShapeError` (framework-internal `__` keys whitelisted).
- `getState()` / `setState()` generated from the shape: snapshots contain exactly declared non-internal keys; round-trip is total. Replay pinning works by construction.
- Mutation tracking (which declared keys changed this step) — feeds Phase 3's "nothing mutated" signal and the behavior log.
- **Regression test:** acceptor writes `model._votes` → throws. `setState(getState())` restores full observable state. This is the Sonnet hidden-state class.

### Phase 3 — First-class `reject(reason)` (#22)
- Second argument to acceptors: `{ reject }`. `reject(reason)` records `{ intent, reason }` in a per-step rejection log (cleared each step), distinct from the `__error` slot and from silent fall-through.
- `instance.lastStep()` and a `stepListener` hook expose `{ intent, mutated, rejections }` so a replay/exploration harness can mechanically classify every no-op step as `rejected(reason) | unhandled | identity-by-mutation`.
- Strict mode flags fired-intent + no-mutation + no-rejection steps as "unhandled proposal".
- **Regression test:** the three no-op classes are distinguishable from the step log alone.

### Phase 4 — Per-action acceptor registration (#23)
- `component.acceptors` accepts an object map keyed by intent name; the framework performs the binding, so acceptor bodies contain only guards and mutations — the switch-dispatch monolith becomes inexpressible in keyed form.
- Broadcast acceptors remain available under the explicit `'*'` key.
- Keyed acceptors receive only their action's (schema-validated) proposal; tools recover action-binding from structure, not flag conventions.
- **Regression test:** tooling (`instance.manifest()`) reports the acceptor↔action binding without parsing acceptor bodies.

### Phase 5 — Input-domain manifest (#24)
- Per-intent `domain`: enumerated representative payloads or a generator function, declared alongside the schema.
- `checker` consumes domains directly from the instance — retires the harness-side `checkerIntents` bolt-on; `checker({ instance, ... })` needs no `intents` values array when domains are declared.
- `instance.validate()` in strict mode fails on intents without domains.
- **Regression test:** a strict spec is checker-explorable with zero harness-side configuration; domain payloads are schema-validated at declaration time.

### Phase 6 — Integration, docs, release
- End-to-end acceptance: rewrite one study spec (etcd/Raft leader election) in the strict profile under `test/v2/raft.acceptance.test.js`; assert each of the five failure classes is now a construction-time or first-fire failure.
- `README` v2 section + `docs/MIGRATION.md` (v1 → strict profile, mechanical steps).
- Coordinate `sam-fsm` and `react-sam-provider` compatibility notes (separate repos, follow-up work).
- Publish `2.0.0-alpha` → `2.0.0` under the `next` → `latest` tags.

## Non-goals for 2.0
- No TypeScript rewrite (JSDoc types only, per project documentation preference); a `.d.ts` can follow in 2.1.
- No changes to the reactive loop semantics (present/acceptors/reactors/naps order is untouched — it is the validated part).
- The SAM→TLA+ transpiler and explorer stay in `sysmobench`; v2 only guarantees they can run off `instance.manifest()`.

## Risks
- **Proxy sealing vs. performance:** the model Proxy is strict-mode only; default mode keeps the bare object. Benchmark with `dieharder.js` before release.
- **Dual API surface (array vs. named):** default mode must keep the v1 array form working bit-for-bit; the v1 test suite is the gate.
- **`getState` semantics change:** deriving from `modelShape` changes what snapshots contain for components that relied on ad-hoc keys — strict-mode only, documented in MIGRATION.
