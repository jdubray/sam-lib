# sam-pattern library

The [SAM pattern](http://sam.js.org) is a new software engineering pattern based on [TLA+](https://en.wikipedia.org/wiki/TLA%2B). SAM (State-Action-Model) helps manage and reason about the application state. SAM's founding principle is that State Mutation must be a first class citizen of the programming model.

SAM is generally implemented as a singleton and a single state tree. The application logic can be componentized. Components implement actions, acceptors and reactors.

The `sam-pattern` library is implemented following SAM's own principles. 

## installation

### Node.js
The library is available on [npm](https://www.npmjs.com/package/sam-pattern). To install it, type:

```sh
$ npm install --save sam-pattern
```

```
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

```
<script src="./node_modules/sam-pattern/dist/SAM.js"></script>

// or

<script src="https://unpkg.com/sam-pattern"></script>
```
The library's name is `tp` (as in temporal programming)
```
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

A code sample is available [here](https://codepen.io/sam-pattern/pen/qzYQgd)

## Library

### Constructors
`SAM`               : global SAM instance 
`createInstance`    : creates a SAM instance
`api`               : `api(samInstance)` will return the actions that control `samInstance`. When no instance is provided, it returns the global instance actions.

### API to the Global SAM instance
`addInitialState`   : adds the model's initial state 
`addComponent`      : adds one of many components (Actions, Acceptors, Reactors). Returns intents from actions
`addAcceptors`      : adds a list of acceptors to the SAM instance
`addReactors`       : adds a list of reactors to the SAM instance
`addNAPs`           : adds a list of next-action-predicates to the SAM instance. When a predicate returns `true`, the rendering is suspended until the next-action is completed
`getIntents`        : returns a list of intents, given a list of actions. Intents wrap actions with the call to the present method
`setRender`         : sets the render method

`step`              : a simple action that executes a SAM step without changing the application state

### Utils
`first`             : returns the first element of its argument (array)
`match`             : Given an array of booleans and an array object, it returns the first object which corresponding boolean value is true
`on`                : a helper function which takes an object `o` and a function `f` as arguments and calls `f(o)` if the object exists. `on` calls can be chained. This function to chain a series of acceptors
`oneOf`             : same as `on` but will stop after the first value that is found to exist

## Notes

## Copyright and license
Code and documentation copyright 2019 Jean-Jacques Dubray. Code released under the ISC license. Docs released under Creative Commons.