# sam-pattern library

The [SAM pattern](http://sam.js.org) is a new software engineering pattern based on [TLA+](https://en.wikipedia.org/wiki/TLA%2B). SAM (State-Action-Model) helps manage and reason about the application state. SAM's founding principle is that State Mutation must be a first class citizen of the programming model.

SAM is generally implemented at a singleton, managing the application state. The application logic can be componentized.

The sam-pattern library is implemented following SAM's own principles. The library offers two APIs: a message oriented API and an action-oriented API.

```javascript
import { SAM } from 'sam-pattern'

const intents = SAM({
    initialState: {
        counter: 0
    },
    component: { 
        actions: [
            () => ({ incBy: 1})
        ],
        acceptors: [
            model => proposal => model.counter += incBy || 1
        ]
    },
    render: (state) => console.log(state)
})

const [inc] = intents

inc()
```

A code sample is available [here](https://codepen.io/sam-pattern/pen/qzYQgd)