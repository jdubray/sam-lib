# Migrating to the v2 Strict Profile

sam-lib 2.0 is **fully backward compatible**: every v1 API works unchanged. The strict profile is opt-in — you adopt it by passing `strict: true` and converting your component declarations step by step. Each step below is mechanical, independently shippable, and turns one class of silent defect into a construction-time or first-fire failure.

The steps mirror GitHub issues [#20](https://github.com/jdubray/sam-lib/issues/20)–[#24](https://github.com/jdubray/sam-lib/issues/24), distilled from the SysMoBench SAM/TLA+ study.

## Step 0 — opt in

```js
const instance = createInstance({ strict: true })
```

Strict mode changes nothing until you declare things; from then on, violated declarations throw (`SamSchemaError`, `SamShapeError`, `SamValidationError`) instead of no-oping. In default mode the same declarations produce `console.warn` instead.

## Step 1 — name your intents, declare payload schemas (#20)

v1 (positional, untyped):

```js
const [timeout, vote] = instance({
  component: {
    actions: [
      () => ({ timeout: true }),
      from => ({ from })
    ]
  }
}).intents
```

v2 (named, typed):

```js
const { intents } = instance({
  component: {
    actions: {
      ElectionTimeout: () => ({ timeout: true }),          // shorthand
      VoteGranted: {                                        // full form
        action: from => ({ from }),
        schema: { from: { type: 'string', required: true } }
      }
    }
  }
})
intents.VoteGranted('n2')
```

Schema field spec: `{ type, required, nullable }` with `type` one of `string | number | boolean | object | array | function`. A proposal missing a required field or with a wrong type throws on fire — the dropped-payload wiring bug can no longer produce a valid, silently no-oping machine. An intent that fires 3 times (option `neverEnabledThreshold`) without mutating the model warns "possibly never enabled".

## Step 2 — declare the model shape (#21)

```js
component: {
  modelShape: {
    role:     { type: 'string' },
    term:     { type: 'number' },
    votedFor: { type: 'string', nullable: true },
    double:   { type: 'number', derived: true },   // computed by reactors
    tally:    { type: 'object', internal: true }    // excluded from snapshots
  },
  ...
}
```

In strict mode the model handed to acceptors/reactors/naps is sealed: writing an undeclared key (`model._votes = ...`) or an ill-typed value throws `SamShapeError`. `getState()` returns a deep snapshot of exactly the declared non-internal keys; `setState(snapshot)` restores it — the `setState(getState())` round-trip is total, so replay pinning works by construction. Retire any hand-rolled sanitize/replacer idiom.

## Step 3 — reject instead of falling through (#22)

Acceptors receive a second argument `{ reject }`:

```js
acceptors: {
  ElectionTimeout: model => (proposal, { reject }) => {
    if (model.role === 'leader') return reject('leaders do not time out')
    model.role = 'candidate'
    model.term += 1
  }
}
```

`instance({}).lastStep()` returns `{ intent, mutations, writes, rejections, classification }` where classification is `mutated | rejected | identity-by-mutation | unhandled` — every no-op step is mechanically explainable. Strict mode warns on `unhandled` (intent fired, nothing mutated, nothing rejected). Subscribe a harness with `instance({ stepListener: step => ... })`.

The v1 rejection idiom is unified into the same vocabulary (since 2.0.0-alpha.3): an acceptor that records `model.__error` during a non-mutating step classifies as `rejected` with the error text as `rejections[0].reason` — consumers of `lastStep()` need no version-specific branching. A step that writes `__error` *and* mutates classifies `mutated` (the error stays readable in the slot); `unhandled` means exactly one thing: the intent fired and the machine neither mutated, nor rejected, nor recorded an error.

## Step 4 — key acceptors by action (#23)

v1 broadcast acceptors (every acceptor sees every proposal) still work, but the keyed form makes the framework do the binding — acceptor bodies contain only guards and mutations, and the switch-over-action-types monolith is inexpressible:

```js
acceptors: {
  ElectionTimeout: model => (proposal, { reject }) => { ... },  // only its proposals
  VoteGranted:     model => (proposal, { reject }) => { ... },
  '*':             model => proposal => { ... }                  // explicit cross-cutting
}
```

Strict mode throws at registration if a key matches no registered intent (declare actions in the same or an earlier component). `instance({}).manifest()` reports the acceptor↔action bindings structurally.

## Step 5 — declare input domains (#24)

```js
actions: {
  VoteGranted: {
    action: from => ({ from }),
    schema: { from: { type: 'string', required: true } },
    domain: ['n2', 'n3']            // representative intent arguments
  },
  Heartbeat: {
    action: (term, leader) => ({ term, leader }),
    schema: { term: { type: 'number', required: true }, leader: { type: 'string', required: true } },
    domain: [[0, 'n2'], [2, 'n2']]  // array entry = spread as arguments
  },
  Tick: { action: () => ({ tick: true }), schema: { ... }, domain: [[]] }  // no-arg intent
}
```

Domain entries: an **array** spreads as the intent's arguments; anything else is passed as the single argument; a **function** is a generator evaluated at exploration time. Payload-object entries are schema-validated at declaration.

The checker now needs zero harness-side configuration:

```js
checker({
  instance,
  initialState,
  reset: init => instance({}).setState(init),
  liveness: state => state.role === 'leader',
  safety: state => state.role === 'leader' && state.votesGranted < 2,
  options: { depthMax: 3 }
}, onLiveness, onViolation)
```

## Step 6 — validate

```js
instance({}).validate()
```

Returns `[]` when every obligation is declared; in strict mode it throws `SamValidationError` listing intents without schemas or domains and a missing `modelShape` — SAM's analog of TLC refusing to run without `CONSTANTS`.

## Tooling surface

External tools (explorers, transpilers, linters) read everything off the instance:

| Accessor | Returns |
|---|---|
| `manifest()` | `{ intents: { name: { schema, domain } }, acceptors: { keyed, broadcast }, modelShape }` |
| `namedIntents()` | the named intent functions |
| `getState()` / `setState(s)` | total snapshot round-trip over the declared shape |
| `lastStep()` | `{ intent, mutations, writes, rejections, classification }` |
| `validate()` | undeclared obligations (throws in strict mode) |
| `instance({ stepListener })` | per-step callback for replay/exploration harnesses |

## Mutation style: prefer top-level replacement

The strict-mode write tracker is **shallow**: it sees writes to the model's declared keys, not in-place mutations nested inside them. Both styles work, but they differ in observability:

```js
// precise: lastStep().mutations === ['nodes'] — key-attributed
model.nodes = { ...model.nodes, [k]: { ...model.nodes[k], term: t } }

// detected, not attributed: lastStep() reports mutated with deep: true,
// mutations: [] — a snapshot comparison catches the change (since 2.0.0-alpha.1)
model.nodes[k].term = t
```

In-place nested mutations are never misreported as "unhandled proposal" (a false warning fixed in alpha.1, found by the SysMoBench S2 reference spec), but tools that consume per-key mutation lists — diff views, selective re-render, transpilers — only see the replacement style. Prefer top-level replacement in strict specs; treat `deep: true` steps as "something inside a declared key changed".

## Behavior changes in 2.0 (all modes)

One intentional fix: in non-synchronized instances, acceptors are now invoked synchronously, so an exception thrown inside an acceptor is caught and routed to the `__error` slot (as originally documented) instead of becoming an unhandled promise rejection. Strict-profile errors (`SamSchemaError`, `SamShapeError`) propagate to the intent caller rather than landing in `__error`.

## v2.1 — explicit next-state (prime) semantics (#25)

**Breaking for strict-profile specs that declare a `modelShape`** (default mode and strict-without-shape are untouched). 2.1 makes the acceptor a genuine TLA+-style next-state relation: `model` is the frozen pre-state (unprimed, `x`), and writes go to a `next` draft (primed, `x'`) that commits atomically after all acceptors run. See `docs/ISSUE-25-next-state.md` for the full design.

Mechanical migration for each strict acceptor:

```js
// 2.0                                        // 2.1
Name: model => (proposal, { reject }) => {    Name: model => (proposal, { reject, next, unchanged }) => {
  if (bad) return reject('why')                 if (bad) return reject('why')          // reject paths: unchanged (no framing)
  model.role = 'candidate'                      next.role = 'candidate'
  model.term += 1                               next.term = model.term + 1             // RHS reads the PRE-state
  model.log.push(entry)                         next.log = [...model.log, entry]       // assign variables whole
}                                             }
```

The rules:

1. **Writes go to `next`; reads of `model` are always pre-state.** `next.votedFor = tallyFor(model.term)` unambiguously uses the old term — statement order can no longer change a transition's meaning.
2. **Explicit frame.** Every non-`derived` `modelShape` variable must be assigned in `next` or named via `unchanged('a', 'b')` (or `unchanged('*')`) each step, across all acceptors that ran — else `SamFrameError` at commit. Unknown names in `unchanged()` throw. Rejected steps do not commit and need no framing.
3. **One writer per variable per step.** Two acceptors assigning the same variable throws `SamFrameError` (double-prime).
4. **Reactors are unchanged** — they still write `model.<derived>` directly, after commit.
5. An intent no acceptor constrains throws `SamFrameError` (`unhandledIntent` set) instead of only warning.

New observability: `lastStep()` adds `primed` (`{ var: { from, to } }`) and `unchanged`; `manifest().acceptors.frames` reports each acceptor's accumulated prime/frame sets for transpilers (UNCHANGED-clause recovery).
