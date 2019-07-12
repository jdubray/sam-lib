# sam-pattern library

The [SAM pattern](http://sam.js.org) is a software engineering pattern based on the semantics of [TLA+](https://en.wikipedia.org/wiki/TLA%2B). SAM (State-Action-Model) helps manage and reason about the application state from a temporal perspective. SAM's founding principle is that State Mutation must be a first class citizen of the programming model and as such mutations must occur in a well defined synchronized step. SAM defines a step as: Action -> Acceptor(s) -> Reactor(s) -> Next-Action and|or render. 

SAM is generally implemented as a singleton and a single state tree, but that's not a requirement. The application logic can be componentized. Components implement actions, acceptors and reactors and can either operate of a local state or the instance state tree. Actions are converted to intents by the SAM pattern. Intents are invoked by the client/consumer of the SAM instance (which could be another SAM instance). SAM supports asynchronous actions.

The `sam-pattern` library is implemented following SAM's own principles. 

## installation

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
You can also use it within the browser; install via npm and use the sam.js file found within the download. For example:

```html
<script src="./node_modules/sam-pattern/dist/SAM.js"></script>

// or

<script src="https://unpkg.com/sam-pattern"></script>
```
The library's name is `tp` (as in temporal programming)
```javascript
// API to the global SAM instance
const { addInitialState, addComponent, setRender } = tp

```

### Getting started

SAM requires an initial state, one or more components and a render method that will be called after each step.

```javascript
import { addInitialState, addComponent, setRender } from 'sam-pattern'

addInitialState({
  counter: 0
})

const { intents } = addComponent({ 
  actions: [
    () => ({ incBy: 1 })
  ],
  acceptors: [
    model => proposal => model.counter += proposal.incBy || 1
  ]
})

setRender((state) => console.log(state.counter))

const [inc] = intents

// Apply the inc action
inc() 
```

### Code Samples
[Rocket Launcher](https://codepen.io/sam-pattern/pen/qzYQgd)

[ToDoMVC](https://github.com/jdubray/sam-samples/tree/master/todomvc-app)

## Library

### Constructors
- `SAM`               : global SAM instance 
- `createInstance`    : creates a SAM instance
- `api`               : `api(samInstance)` will return the actions that control `samInstance`. When no instance is provided, it returns the global instance actions.

### API to the Global SAM instance
- `addInitialState`   : adds to the model's initial state (or simply state when called at a later time) 
- `addComponent`      : adds one of many components (Actions, Acceptors, Reactors). Returns intents from actions
- `addAcceptors`      : adds a list of acceptors to the SAM instance (acceptors are executed in the order in which they are defined)
- `addReactors`       : adds a list of reactors to the SAM instance
- `addNAPs`           : adds a list of next-action-predicates to the SAM instance. When a predicate returns `true`, the rendering is suspended until the next-action is completed
- `getIntents`        : returns a list of intents, given a list of actions. Intents wrap actions with the call to the present method
- `setRender`         : sets the render method

- `step`              : a simple action that executes a SAM step without changing the application state

A component specification includes options:
- `ignoreOutdatedProposals` when true, the model's will reject all action proposals that out of order. In the event that a proposal comes after another more recent one was processed, it will be rejected. Note: this option is only available for asynchronous actions.
- `debounce` when providing a value greater than 0, all intents of the corresponding component will be debounced by that amount in ms. Note: this option is only available for asynchronous actions.
- `retry` { `delay`, `max` } when specified, it will retry invoking an intent in case of an unhandled exception up to `max` times and after `delay` ms.

### Time Travel
SAM's implementation is capable of time traveling (return to a prior state of the model)
- `addTimetraveler`   : adds a time traveler instance. The method takes an optional array of snapshots which allows you to initialize the SAM instance's history
- `travel`            : returns to the nth snapshot of the model's history
- `hasNext`           : returns true you have have reached the end of time
- `next`              : returns the next snapshot of the model
- `last`              : returns the last snapshot of history

### Model Checker
The library includes a model checker capable of computing the behavior leading to a liveness or safety conditon (see example below). The `checker` method arguments are:
- `instance`          : The SAM instance used for checking 
- `intents`           : Model checker intents - `intent`: the SAM intent, `name`: its name, `values`: an array of all possible permutations for the intent arguments } 
- `reset`             : A function that is called after each iteration to return the model to the proper state, 
- `liveness`          : a function that takes the application state as an input and returns a liveness condition (exected condition to be reached by some behavior) 
- `safety`            : a function that takes the application state as an input and returns a safety condition (unexpected occurence of a state)
- `options`           : checker options that restrict the search space - `depthMax`: how many steps in a behavior, `noDuplicateAction`: whether the model supports duplicate actions (in general it's true) , `doNotStartWith`: an array of intent names that should not be used to start a behavior
- `success`           : a callback for every liveness condition detected
- `err`               : a callback for every safety condition detected

### Utils
- `first`             : returns the first element of its argument (array)
- `match`             : Given an array of booleans and an array object, it returns the first object which corresponding boolean value is true
- `on`                : a helper function which takes an object `o` and a function `f` as arguments and calls `f(o)` if the object exists. `on` calls can be chained. This function to chain a series of acceptors
- `oneOf`             : same as `on` but will stop after the first value that is found to exist

## Exception Handling

SAM handles all uncaught action, acceptor, reactor and nap exceptions. The application model and state representation expose four methods to check for exceptions:
- `hasError`  
- `error`
- `errorMessage`
- `clearError`

When a component has been defined with the options: `{ retry: { max: 3, delay: 100}}` all its actions will be retried up to `3` times every `100`ms.

```javascript
render: (state) => {
  if (state.hasError()) {
    console.log(state.errorMessage())
    state.clearError()
  } 
}
```

## Code samples

### Safety Conditions

Temporal programming (and TLA+) supports invariants which can be checked after each step as Safety conditions (an invalid state). When a Safety Condition is detected, SAM will roll back the application state to the latest valid snapshot of the model (if history is turned on) and notify the client of the corresponding exception.

```javascript
// Create a local SAM instance (different from the Global one)
const SafeSAM = createInstance()
const { intents } = SafeSAM({
    // set initial state
    initialState: {
        counter: 10,
        status: 'ready'
    },
    // use time timetravel to enable rollback
    history: [],
    component: {
        // Standard counter component
        actions: [
            () => ({ incBy: 1 })
        ],
        acceptors: [
            model => ({ incBy }) => {
                if (incBy) {
                    model.counter += incBy
                }
            }
        ],
        reactors: [
            model => () => {
                if (model.counter > 10) {
                    model.status = 'error'
                }
            }
        ],
        // Safety condition, when true, will roll back to the
        // latest safe version of the application state
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
        // the model should have rolled back
        console.log(state.counter) // -> 10
    }
})

const [inc] = intents

// Increment counter from 10 to 11
// to trigger the safety condition
inc()
```

### Asynchronous actions
SAM supports and welcomes the use of asynchronous actions. It can also operate in a mode where it ignores `outdated proposals` (proposals that come out of order, when compared to the intent's invocation). This is useful to implement the "cancellations" of long running asynchronous requests. A cancel is equivalent to a synchronous action invoked to simply advance the step counter and ignore the initial request's proposal when it comes.

```javascript
const { intents } = SAM({
    initialState: {
        counter: 10,
        status: 'ready'
    },
    component: {
        actions: [
            () => new Promise(r => setTimeout(r, 1000)).then(() => ({ test: true }))
            () => ({ incBy: 1 })
            () => setTimeout(() => ({ incBy: 1 }), 500)
        ],
        acceptors: [
          model => ({ test }) => {
              if (test) {
                  model.status = 'testing'
              }
          },
          model => ({ incBy }) => {
            if (incBy) {
                model.counter += incBy
            }
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
incLater()  // this action is ignored, proposal is outdated
inc()       // -> 11, this action cancels the effects of the previous action
test()      // -> testing, 11
```

### Components with Local State

A named component operates on their local state (which can be initialized via the `localState` property). The component's acceptors and reactors can access the state tree of the SAM instance via the `parent` property.   

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
                if (test) {
                    localState.color = 'purple'
                }
            }
        ]
    },
    render: (state) => {
        console.log(state.status)                               // -> ready
        console.log(state.localState('local').color)            // -> purple
        console.log(state.color)                                // -> blue
        console.log(state.localState('local').parent.color)     // -> purple
        
    }
}).intents

tick()    
```

### Time Traveler

```javascript
// Add a time traveler to the global SAM instance 
// with no prior history
addTimeTraveler([])

addInitialState({
    counter: 0
})

const { intents } = addComponent({
    actions: [() => ({ incBy: 1 })],
    acceptors: [
        model => (proposal) => {
            model.counter += proposal.incBy || 1
        }
    ]
})

setRender(state => console.log(state.counter))

const [inc] = intents

inc()       // --> 1
inc()       // --> 2
inc()       // --> 3

// Reset the model to its
// original state
travel(0)   // --> 0
next()      // --> 1
if (hasNext()) {
    next()  // --> 2
}
last()      // --> 3
```

### Debounce

```javascript
  const { intents } = SAMDebouceTest({
    initialState: {
      counter: 0
    },

    component: {
      actions: [
        () => ({ incBy: 1, debounceTest: true })
      ],
      acceptors: [
        model => (proposal) => {
          model.counter += proposal.incBy || 1
        }
      ],
      // Debounce for 100ms
      options: { debounce: 100 }
    },

    render: state => console.log(state.counter) // -> 1
  })

  const [inc] = intents

  // Simulate a series of events trying 
  // to increment the counter
  setTimeout(inc, 0)
  setTimeout(inc, 10)
  setTimeout(inc, 20)
  setTimeout(inc, 30)
```


### Model Checker

The library a model checker capable of detecting liveness and safety conditions. For instance, this is an implementation of Dr. Lamport's Die Hard example:

```javascript
// This code is implementing the dieharder TLA+ specification
// https://github.com/tlaplus/Examples/blob/master/specifications/DieHard/DieHarder.pdf

/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */

const { api, createInstance } = require('sam-pattern')

const { utils: { E, or } } = require('sam-pattern')

const { checker } = require('sam-pattern')

const dieHarder = createInstance({ hasAsyncActions: false, instanceName: 'dieharder' })

const {
  addInitialState, addComponent, setRender
} = api(dieHarder)

let checkerIntents = []

addInitialState({
  n: 2,
  jugs: [0, 0],
  capacity: [3, 5],
  goal: 4
})

const { intents } = addComponent({
  actions: [
    (j1, j2) => ({
      jug2jug: { j1, j2 }, __name: 'jug2jug'
    }),
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
        if (j1 !== j2) {
          if (E(j1) && j1 < state.n && j1 >= 0
                    && E(j2) && j2 < state.n && j2 >= 0) {
            const maxAllowed = state.capacity[j2] - state.jugs[j2]
            const transfer = Math.min(maxAllowed, state.jugs[j1])
            state.jugs[j1] -= transfer
            state.jugs[j2] += transfer
          }
        }
      }
    }
  ]
})

setRender((state) => {
  const { goal, jugs = [] } = state
  const goalReached = jugs.map(content => content === goal).reduce(or, false)
  console.log(`Goal: ${goal} [${jugs.map(content => content).join(', ')}]`)
  console.log( goalReached ? 'Goal reached!!!' : '')
})

const [
  jug2jug,
  empty,
  fill
] = intents

// fill(1)
// jug2jug(1, 0)
// empty(0)
// jug2jug(1, 0)
// fill(1)
// jug2jug(1, 0)

checkerIntents = [{
  intent: fill,
  name: 'fill',
  values: [
    [0],
    [1]
  ]
}, {
  intent: empty,
  name: 'empty',
  values: [
    [0],
    [1]
  ]
}, {
  intent: jug2jug,
  name: 'jug2jug',
  values: [
    [0, 1],
    [1, 0]
  ]
}
]

checker({
  instance: dieHarder,
  intents: checkerIntents,
  reset: () => {
    empty(0)
    empty(1)
  },
  liveness: ({ goal, jugs = [] }) => jugs.map(content => content === goal).reduce(or, false),
  safety: ({ jugs = [], capacity = [] }) => jugs.map((content, index) => content > capacity[index]).reduce(or, false),
  options: {
    depthMax: 6,
    noDuplicateAction: true,
    doNotStartWith: ['empty', 'jug2jug'],
    format: (actionName, proposal, model) => {
        const act = `${actionName}(${JSON.stringify(proposal.fill || proposal.jug2jug || proposal.empty || 0)})`
        return `${act.padEnd(30, ' ')}==> ${JSON.stringify(model.jugs)} (goal: ${model.goal})`
    }
  }
}, (behavior) => {
  console.log(`\nthe model checker found this behavior to reach the liveness condition:\n${behavior.join('\n')}\n`)
}, (err) => {
  console.log('The model checker detected a safety condition: ', err)
})

// Expected output
// The model checker found this behavior to reach the liveness condition:
// fill(1)                       ==> [0,5] (goal: 4)
// jug2jug({"j1":1,"j2":0})      ==> [3,2] (goal: 4)
// empty(0)                      ==> [0,2] (goal: 4)
// jug2jug({"j1":1,"j2":0})      ==> [2,0] (goal: 4)
// fill(1)                       ==> [2,5] (goal: 4)
// jug2jug({"j1":1,"j2":0})      ==> [3,4] (goal: 4)


// The model checker found this behavior to reach the liveness condition:
// fill(1)                       ==> [0,5] (goal: 4)
// jug2jug({"j1":1,"j2":0})      ==> [3,2] (goal: 4)
// empty(0)                      ==> [0,2] (goal: 4)
// jug2jug({"j1":1,"j2":0})      ==> [2,0] (goal: 4)
// fill(1)                       ==> [2,5] (goal: 4)
// jug2jug({"j1":1,"j2":0})      ==> [3,4] (goal: 4)
// empty(0)                      ==> [0,4] (goal: 4)
```

## Change Log

1.3.7 adds exception handling
1.3.6 adds a debounce mode
1.3.5 adds a new component option to skip processing outdated proposals

## Copyright and license
Code and documentation copyright 2019 Jean-Jacques Dubray. Code released under the ISC license. Docs released under Creative Commons.