# A Temporal Programming Library

Traditional programming models (OOP, FP, RP, FRP...) offer few temporal logic constructs, if any. Yet temporal aspects appear throughout our code — not just on the client, but on the server too.

This library is an implementation of the [SAM pattern](http://sam.js.org), a software engineering pattern based on the semantics of [TLA+](https://en.wikipedia.org/wiki/TLA%2B) (the Temporal Logic of Actions). SAM (State-Action-Model) offers a systematic approach to managing and reasoning about application state from a temporal perspective. SAM's founding principle is that **state mutation must be a first-class citizen** of the programming model, and as such mutations must occur in a well-defined, synchronized step. SAM defines a step as:

```
     _______________________... event ..._________________________
    |                                                             |
    |        ___________Model___________                          |
    v       |       (synchronized)      |                         |
  Action -> | Acceptor(s) -> Reactor(s) | -> Next-Action and|or Render
    ^       |___________________________|        |              State
    |                                            |
    |____________________________________________|
```

An action is initiated by the SAM client/consumer of the state representation. An action computes a **proposal** to mutate the application state. The proposal is presented to the model, which accepts, partially accepts, or rejects it (acceptors are units of mutation — functions of proposals). Once the application state has mutated, **reactors** compute the resulting application state. Reactors are invariant mutations: functions of the state that are independent of proposals. Factoring your code as actions, acceptors, and reactors leads to cleaner, more compact, and easier-to-maintain code.

SAM is generally implemented as a singleton with a single state tree, but that is not a requirement. SAM instances can work cooperatively, especially in a parent/child relationship (to manage a specific but ephemeral aspect of your application, e.g. a form or wizard).

The library supports a simple **component model** to modularize application logic. Components implement any combination of actions, acceptors, and reactors and can operate on their local state or the shared instance state tree.

Actions are converted into **intents** at setup time. Intents are invoked by the client/consumer in response to events. SAM supports asynchronous actions natively. Intents have built-in capabilities such as automatic retries, ordering, and debouncing. Intents can be gated and only applied to the model when allowed (see `allowedActions` below).

SAM's [structure is so precise](https://dzone.com/articles/the-three-approximations-you-should-never-use-when) that the library comes with a [model checker](#model-checker) capable of verifying your code by exploring all possible combinations of intents and values, validating that liveness conditions will be reached and that no [safety condition](#safety-conditions) will be triggered.

The [sam-fsm library](https://www.npmjs.com/package/sam-fsm) is an add-on that simplifies the definition of finite state machines. One or more FSMs can run in the same SAM instance and coexist with standard SAM actions, acceptors, and reactors.

The `sam-pattern` library is implemented following SAM's own principles.

The pattern was first introduced in June 2015 as [STAR](https://github.com/jdubray/sam-samples/tree/master/star-java) and then in its [final form](https://www.infoq.com/articles/no-more-mvc-frameworks/) in February 2016.

## v2 — the Strict Profile

Version 2.0 introduces an opt-in **strict profile** (`createInstance({ strict: true })`) that moves SAM's conventions into enforced construction, making specifications mechanically checkable — explorable, transpilable (e.g. to TLA+), replayable, and locally repairable:

- **Named intents with payload schemas** — a proposal missing a required field throws on first fire instead of producing a silent no-op machine ([#20](https://github.com/jdubray/sam-lib/issues/20))
- **Declared, sealed model shape** (SAM's `VARIABLES`) — hidden bookkeeping state (`model._votes`) is a `SamShapeError`; `getState()`/`setState()` round-trip totally over the declared shape ([#21](https://github.com/jdubray/sam-lib/issues/21))
- **First-class `reject(reason)`** — every no-op step is classifiable as `rejected | unhandled | identity-by-mutation` via `lastStep()` ([#22](https://github.com/jdubray/sam-lib/issues/22))
- **Per-action acceptor registration** — the framework binds acceptors to actions; the switch-dispatch monolith is inexpressible ([#23](https://github.com/jdubray/sam-lib/issues/23))
- **Per-intent input domains** (SAM's `CONSTANTS`) — the model checker explores a declared spec with zero harness-side configuration; `validate()` reports undeclared obligations ([#24](https://github.com/jdubray/sam-lib/issues/24))
- **Explicit next-state (prime) semantics** *(2.1)* — acceptors are TLA+-style next-state relations: `model` is the frozen pre-state (unprimed `x`), writes go to the `next` draft (primed `x'`), and every declared variable must be assigned or named `unchanged(...)` each step — else `SamFrameError` ([docs/ISSUE-25-next-state.md](docs/ISSUE-25-next-state.md))

The strict acceptor form (2.1, active under `strict: true` + a declared `modelShape`):

```javascript
acceptors: {
  ElectionTimeout: model => (proposal, { reject, next, unchanged }) => {
    if (model.role === 'leader') return reject('leaders do not time out')
    next.role = 'candidate'
    next.term = model.term + 1            // the right-hand side reads the PRE-state
    unchanged('votedFor', 'log')          // explicit frame — SAM's UNCHANGED
  }
}
```

Writing `model.x` in a strict acceptor throws (`SamShapeError`): reads are always pre-state, so statement order cannot change a transition's meaning. Two acceptors assigning the same variable in one step throw (double-prime), and acceptors must be synchronous unless the instance is created with `synchronize: true`. `lastStep()` exposes the step's `primed`/`unchanged` sets, and `manifest().acceptors.frames` reports each acceptor's prime/frame sets for external tools (e.g. `UNCHANGED <<...>>` recovery in a SAM→TLA+ transpiler).

All v1 (default-mode) APIs work unchanged — the code samples below use default mode. **Strict specs written for 2.0 must migrate their acceptors to the `next`/`unchanged` form** — see [docs/MIGRATION.md](docs/MIGRATION.md) (v2.1 section) for the mechanical steps, and [docs/V2-PLAN.md](docs/V2-PLAN.md) for the design rationale (distilled from a three-study comparison of SAM and TLA+).

## Code Samples

TODOMVC

- [vanilla.js](https://github.com/jdubray/sam-samples/tree/master/todomvc-app)
- [lit-html](https://github.com/jdubray/sam-samples/tree/master/todomvc-app-lit-html)
- [react](https://github.com/jdubray/sam-samples/tree/master/todomvc-app-react)
- [vue](https://github.com/jdubray/sam-samples/tree/master/todomvc-app-vue)
- [angular](https://github.com/jdubray/sam-samples/tree/master/todomvc-app-angular)

RealWorld
- [uce](https://github.com/imnutz/rw-ce) (via @imnutz)

Rocket Launcher
- [vanilla.js](https://codepen.io/sam-pattern/pen/XWNGNBy) with `sam-fsm` library

Please check the unit tests for additional use cases.

## Table of Contents
- [Installation](#installation)
  - [Node.js](#nodejs)
  - [Browsers](#browsers)
  - [Getting started](#getting-started)
- [Library](#library)
  - [Constructors](#constructors)
  - [API to the Global SAM Instance](#api-to-the-global-sam-instance)
  - [Time Travel](#time-travel)
  - [Model Checker](#model-checker)
  - [Utils](#utils)
  - [Exception Handling](#exception-handling)
- [Code Samples](#code-samples-1)
  - [Synchronized Mutation](#synchronized-mutation)
  - [Safety Conditions](#safety-conditions)
  - [Asynchronous Actions](#asynchronous-actions)
  - [Components with Local State](#components-with-local-state)
  - [Time Traveler](#time-traveler)
  - [Debounce](#debounce)
  - [Model Checker](#model-checker-1)
- [Support](#support)
- [Change Log](#change-log)
- [Copyright and License](#copyright-and-license)

## Installation

### Node.js
The library is available on [npm](https://www.npmjs.com/package/sam-pattern). To install it, type:

```sh
$ npm install --save sam-pattern
```

```javascript
const { api, createInstance } = require('sam-pattern')

// API to the global SAM instance
const {
  addInitialState, addComponent, setRender
} = api()

// Create a new SAM instance
const child = api(createInstance())
```

### Browsers
Install via npm and reference the pre-built bundle:

```html
<script src="./node_modules/sam-pattern/dist/SAM.js"></script>
```

The library's global name is `tp` (temporal programming):

```javascript
const { SAM, addInitialState, addComponent, setRender } = tp
```

### Getting Started

SAM requires an initial state, one or more components, and a render method called after each step.

```javascript
import { addInitialState, addComponent, setRender } from 'sam-pattern'

addInitialState({
  counter: 0
})

const { intents } = addComponent({
  actions: [
    () => ({ incBy: 1 }),
    ['LABELED_ACTION', () => ({ incBy: 2 })]
  ],
  acceptors: [
    model => proposal => { model.counter += proposal.incBy || 1 }
  ]
})

setRender((state) => console.log(state.counter))

const [inc, incBy2] = intents

inc()    // -> 1
incBy2() // -> 3
```

You can also explore the [Rocket Launcher CodePen](https://codepen.io/sam-pattern/pen/qzYQgd).

## Library

### Constructors
- `SAM`            — the global SAM instance
- `createInstance` — creates a new SAM instance
- `api`            — `api(instance)` returns the API methods that control `instance`. When called with no argument, returns the global instance API.

### API to the Global SAM Instance
- `addInitialState`     — adds to the model's initial state (or updates current state when called later)
- `addComponent`        — adds a component (Actions, Acceptors, Reactors). Returns `{ intents }` from the component's actions
- `addAcceptors`        — adds a list of acceptors (executed in the order defined)
- `addReactors`         — adds a list of reactors
- `addNAPs`             — adds a list of next-action predicates. When a predicate returns `true`, rendering is suspended until the next action completes
- `getIntents`          — returns a list of intents from a list of actions
- `setRender`           — sets the render method
- `addHandler`          — adds an event handler to the SAM loop (as an alternative to render)
- `allowedActions`      — returns the allowed actions for the next step. Disallowed actions fail silently
- `allow`               — adds an array of actions to the allowed-actions set
- `clearAllowedActions` — clears all allowed actions
- `step`                — a no-op action that advances the SAM step without mutating state
- `doNotRender`         — a NAP that suppresses rendering for one step

**Events** — the library also exposes a lightweight event emitter:
- `events.on(event, handler)` — subscribe to a named event
- `events.off(event, handler)` — unsubscribe
- `events.emit(event, payload)` — publish an event

**Component options** (passed in the `options` key of a component spec):
- `ignoreOutdatedProposals` — when `true`, rejects proposals that arrive out of order (async actions only)
- `debounce` — debounce all intents in the component by this many ms (async actions only)
- `retry` — `{ delay, max }`: retry on unhandled exception up to `max` times, every `delay` ms

Actions can be labeled by wrapping them in a two-element array:

```javascript
const actions = [
  () => ({ incBy: 1 }),
  ['LABELED_ACTION', () => ({ incBy: 2 })]
]
```

Labels are used to specify allowed actions for a given state. See the [sam-fsm](https://www.npmjs.com/package/sam-fsm) library for examples.

### Time Travel
SAM supports time travel — returning to a prior snapshot of the model:
- `addTimeTraveler` — initializes the time traveler with an optional array of prior snapshots
- `travel`          — returns to the nth snapshot
- `hasNext`         — `true` if there is a snapshot after the current position
- `next`            — advances to the next snapshot
- `last`            — jumps to the most recent snapshot

### Model Checker
The library includes a model checker that detects liveness and safety conditions by exploring all permutations of intents. Arguments to `checker`:
- `instance`  — the SAM instance to check
- `intents`   — array of `{ intent, name, values }` descriptors (values are the permutation inputs)
- `reset`     — function called after each iteration to restore the model to a known baseline
- `liveness`  — `(state) => boolean` — expected condition that should be reachable
- `safety`    — `(state) => boolean` — invariant that must never be violated
- `options`   — `{ depthMax, noDuplicateAction, doNotStartWith, format }` to constrain the search space
- `success`   — callback invoked for each liveness condition detected
- `err`       — callback invoked for each safety violation detected

### Utils
- `first`  — returns the first element of an array
- `match`  — given an array of booleans and a parallel array of values, returns the first value whose boolean is `true`
- `on`     — calls `f(o)` if `o` exists; returns a chainable object. Used to chain acceptors
- `oneOf`  — same as `on` but stops at the first match

### Exception Handling

SAM catches all uncaught exceptions in actions, acceptors, reactors, and NAPs. The state object exposes:
- `hasError()`    — `true` if an exception occurred
- `error()`       — the raw Error object
- `errorMessage()` — the error message string
- `clearError()`  — clears the exception

When a component specifies `options: { retry: { max: 3, delay: 100 } }`, all its actions are automatically retried up to three times with a 100 ms delay.

```javascript
setRender((state) => {
  if (state.hasError()) {
    console.log(state.errorMessage())
    state.clearError()
  }
})
```

## Code Samples

### Synchronized Mutation

In its pure form SAM does not support asynchronous acceptors — all model mutations must be synchronous. Downstream API calls should be made from a next-action predicate (NAP) that presents the result back to the model.

SAM also supports a **synchronized** mode that queues action proposals while another is being processed, removing the need for that boilerplate when sequential UX is acceptable:

```javascript
let SyncSAM = createInstance({ instanceName: 'sync\'ed', synchronize: true })

// Clear the internal proposal queue when needed
SyncSAM({ clearInterval: true })
```

### Safety Conditions

Safety conditions (invariants) are checked after each step. When one is triggered, SAM rolls back to the most recent valid snapshot (requires time travel enabled) and notifies the client.

```javascript
const SafeSAM = createInstance()
const { intents } = SafeSAM({
  initialState: {
    counter: 10,
    status: 'ready'
  },
  history: [],
  component: {
    actions: [
      () => ({ incBy: 1 })
    ],
    acceptors: [
      model => ({ incBy }) => {
        if (incBy) model.counter += incBy
      }
    ],
    reactors: [
      model => () => {
        if (model.counter > 10) model.status = 'error'
      }
    ],
    safety: [
      {
        expression: model => model.counter > 10,
        name: 'Counter value is dangerously high'
      }
    ]
  },
  logger: {
    error: (err) => {
      console.log(err.name) // -> Counter value is dangerously high
    }
  },
  render: (state) => {
    console.log(state.counter) // -> 10 (rolled back)
  }
})

const [inc] = intents
inc() // triggers the safety condition; model rolls back to 10
```

### Asynchronous Actions

SAM supports and welcomes asynchronous actions. When `ignoreOutdatedProposals: true` is set, proposals that arrive after a more recent one has been processed are discarded — useful for implementing cancellation of long-running requests.

```javascript
const { intents } = SAM({
  initialState: {
    counter: 10,
    status: 'ready'
  },
  component: {
    actions: [
      () => new Promise(r => setTimeout(r, 1000)).then(() => ({ test: true })),
      () => ({ incBy: 1 }),
      () => new Promise(r => setTimeout(() => r({ incBy: 1 }), 500))
    ],
    acceptors: [
      model => ({ test }) => {
        if (test) model.status = 'testing'
      },
      model => ({ incBy }) => {
        if (incBy) model.counter += incBy
      }
    ],
    options: {
      ignoreOutdatedProposals: true
    }
  },
  render: (state) => {
    console.log(state.status)
    console.log(state.counter)
  }
})

const [test, inc, incLater] = intents
incLater() // proposal arrives late — ignored
inc()      // -> status: ready, counter: 11
test()     // -> status: testing, counter: 11
```

### Components with Local State

A named component operates on its own local state tree (initialized via `localState`). Acceptors and reactors can access the shared SAM instance state via `localState.parent`.

```javascript
const [tick] = SAM({
  initialState: {
    counter: 10,
    status: 'ready',
    color: 'blue'
  },
  component: {
    name: 'local',
    localState: {
      color: 'blue'
    },
    actions: [
      () => ({ test: true })
    ],
    acceptors: [
      localState => ({ test }) => {
        if (test) localState.color = 'purple'
      }
    ]
  },
  render: (state) => {
    console.log(state.status)                           // -> ready
    console.log(state.localState('local').color)        // -> purple
    console.log(state.color)                            // -> blue
    console.log(state.localState('local').parent.color) // -> blue
  }
}).intents

tick()
```

### Time Traveler

```javascript
addTimeTraveler([])

addInitialState({ counter: 0 })

const { intents } = addComponent({
  actions: [() => ({ incBy: 1 })],
  acceptors: [
    model => proposal => {
      model.counter += proposal.incBy || 1
    }
  ]
})

setRender(state => console.log(state.counter))

const [inc] = intents

inc()       // -> 1
inc()       // -> 2
inc()       // -> 3

travel(0)   // -> 0 (back to initial)
next()      // -> 1
if (hasNext()) {
  next()    // -> 2
}
last()      // -> 3
```

### Debounce

```javascript
const { intents } = SAM({
  initialState: { counter: 0 },
  component: {
    actions: [
      () => ({ incBy: 1 })
    ],
    acceptors: [
      model => proposal => {
        model.counter += proposal.incBy || 1
      }
    ],
    options: { debounce: 100 }
  },
  render: state => console.log(state.counter) // -> 1 (once, after 130ms)
})

const [inc] = intents

// Rapid-fire events — only the last one within 100ms fires
setTimeout(inc, 0)
setTimeout(inc, 10)
setTimeout(inc, 20)
setTimeout(inc, 30)
```

### Model Checker

The model checker explores all behaviors up to a given depth to detect liveness and safety conditions. This is Dr. Lamport's Die Hard example:

```javascript
// Implements the DieHarder TLA+ specification:
// https://github.com/tlaplus/Examples/blob/master/specifications/DieHard/DieHarder.pdf

const { api, createInstance, checker, utils: { E, or } } = require('sam-pattern')

const dieHarder = createInstance({ hasAsyncActions: false, instanceName: 'dieharder' })
const { addInitialState, addComponent, setRender } = api(dieHarder)

addInitialState({
  n: 2,
  jugs: [0, 0],
  capacity: [3, 5],
  goal: 4
})

const { intents } = addComponent({
  actions: [
    (j1, j2) => ({ jug2jug: { j1, j2 }, __name: 'jug2jug' }),
    j => ({ empty: j, __name: 'empty' }),
    j => ({ fill: j, __name: 'fill' })
  ],
  acceptors: [
    state => ({ fill }) => {
      if (E(fill) && fill < state.n && fill >= 0) {
        state.jugs[fill] = state.capacity[fill]
      }
    },
    state => ({ empty }) => {
      if (E(empty) && empty < state.n && empty >= 0) {
        state.jugs[empty] = 0
      }
    },
    state => ({ jug2jug }) => {
      if (E(jug2jug)) {
        const { j1, j2 } = jug2jug
        if (j1 !== j2 && E(j1) && j1 < state.n && j1 >= 0
                       && E(j2) && j2 < state.n && j2 >= 0) {
          const maxAllowed = state.capacity[j2] - state.jugs[j2]
          const transfer = Math.min(maxAllowed, state.jugs[j1])
          state.jugs[j1] -= transfer
          state.jugs[j2] += transfer
        }
      }
    }
  ]
})

setRender((state) => {
  const { goal, jugs = [] } = state
  const goalReached = jugs.map(content => content === goal).reduce(or, false)
  console.log(`Goal: ${goal} [${jugs.join(', ')}]`)
  if (goalReached) console.log('Goal reached!!!')
})

const [jug2jug, empty, fill] = intents

checker({
  instance: dieHarder,
  intents: [
    { intent: fill,    name: 'fill',    values: [[0], [1]] },
    { intent: empty,   name: 'empty',   values: [[0], [1]] },
    { intent: jug2jug, name: 'jug2jug', values: [[0, 1], [1, 0]] }
  ],
  reset: () => { empty(0); empty(1) },
  liveness: ({ goal, jugs = [] }) => jugs.map(c => c === goal).reduce(or, false),
  safety:   ({ jugs = [], capacity = [] }) => jugs.map((c, i) => c > capacity[i]).reduce(or, false),
  options: {
    depthMax: 6,
    noDuplicateAction: true,
    doNotStartWith: ['empty', 'jug2jug'],
    format: (actionName, proposal, model) => {
      const act = `${actionName}(${JSON.stringify(proposal.fill ?? proposal.jug2jug ?? proposal.empty ?? 0)})`
      return `${act.padEnd(30, ' ')}==> ${JSON.stringify(model.jugs)} (goal: ${model.goal})`
    }
  }
}, (behavior) => {
  console.log(`\nBehavior to reach liveness condition:\n${behavior.join('\n')}\n`)
}, (err) => {
  console.log('Safety condition detected:', err)
})

// Expected output:
// fill(1)                       ==> [0,5] (goal: 4)
// jug2jug({"j1":1,"j2":0})      ==> [3,2] (goal: 4)
// empty(0)                      ==> [0,2] (goal: 4)
// jug2jug({"j1":1,"j2":0})      ==> [2,0] (goal: 4)
// fill(1)                       ==> [2,5] (goal: 4)
// jug2jug({"j1":1,"j2":0})      ==> [3,4] (goal: 4)
```

## Support

Please post your questions and comments on the [SAM-pattern forum](https://gitter.im/jdubray/sam).

## Change Log
- 1.6.0  Fixes destructive `clone()` in model and time-travel (component state no longer destroyed on render/snapshot); fixes `log()` (correct `__logger` property, lazy invocation, `warning` typo, wrong `error`/`fatal` args); fixes out-of-order proposal detection (timestamp never advanced); removes spurious `format` argument from `apply()`; fixes intent memory leak in `addComponent`; adds `retry` option (`retryMax`, `retryDelay`) to `addComponent` for automatic action retry
- 1.5.10 Adds `stateMachineId` action parameter to support composite state machines (`sam-fsm`)
- 1.5.9  Adds `disallowedActions` to support composite state machines (`sam-fsm`)
- 1.5.8  Adds optional action labels usable to specify allowed actions
- 1.5.5  Fixes a defect in `sam-fsm` guarded transitions
- 1.5.2  Minifies the bundle (~10 kB)
- 1.5.1  Augments `allowedActions` to support action labels
- 1.4.9  Adds reference to the `sam-fsm` library
- 1.4.6  Adds access to state representation as an alternative rendering mechanism
- 1.4.4  Adds event handlers (`addHandler`) as an alternative rendering mechanism; exposes `events` emitter
- 1.4.3  Adds links to TODOMVC code samples
- 1.4.1  Changes `setRender` to accept a single function (or a two-element array)
- 1.4.0  Adds synchronized mode (`createInstance({ synchronize: true })`)
- 1.3.10 Adds the ability to skip rendering for a step (`doNotRender`)
- 1.3.9  Adds allowed-actions gating
- 1.3.7  Adds exception handling
- 1.3.6  Adds debounce mode
- 1.3.5  Adds `ignoreOutdatedProposals` option for async actions
- workspace Patched `dist/SAM.js` to expose `addHandler`, `permutations`, `apply`, `Model`, and `events` exports (Rollup 1.16.4 / acorn 6 cannot parse `??` / `?.` operators introduced post-1.5.10)

## Copyright and License
Code and documentation copyright 2019 Jean-Jacques Dubray. Code released under the [ISC license](https://opensource.org/licenses/ISC). Docs released under Creative Commons.
