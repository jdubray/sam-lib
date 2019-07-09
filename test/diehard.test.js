// This code is implementing the dieharder TLA+ specification
// https://github.com/tlaplus/Examples/blob/master/specifications/DieHard/DieHarder.pdf

/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { api, createInstance } = require('../dist/SAM')

const { utils: { E, or } } = require('../dist/SAM')

const { checker } = require('../dist/SAM')

const dieHarder = createInstance({ hasAsyncActions: false, instanceName: 'dieharder' })

const {
  addInitialState, addComponent, setRender
} = api(dieHarder)

let checkerIntents = []

describe('SAM examples: dieharder', () => {
  it('should check the model and find a solution', () => {
    // addTimeTraveler()

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
        ({ jugs, capacity, n }) => ({ fill }) => {
          if (E(fill) && fill < n && fill >= 0) {
            jugs[fill] = capacity[fill]
          }
        },
        ({ jugs, n }) => ({ empty }) => {
          if (E(empty) && empty < n && empty >= 0) {
            jugs[empty] = 0
          }
        },
        ({ jugs, capacity, n }) => ({ jug2jug }) => {
          if (E(jug2jug)) {
            const { j1, j2 } = jug2jug
            if (j1 !== j2) {
              if (E(j1) && j1 < n && j1 >= 0
                    && E(j2) && j2 < n && j2 >= 0) {
                const maxAllowed = capacity[j2] - jugs[j2]
                const transfer = Math.min(maxAllowed, jugs[j1])
                jugs[j1] -= transfer
                jugs[j2] += transfer
              }
            }
          }
        }
      ]
    })

    let step = 0
    setRender(({ goal, jugs = [] }) => {
      const goalReached = jugs.map(content => content === goal).reduce(or, false)
      // console.log(`Goal: ${goal} [${jugs.map(content => content).join(', ')}]`)
      // console.log( goalReached ? 'Goal reached!!!' : '')
      if (step === 5) expect(goalReached).to.be.true
      step++
    })

    const [
      jug2jug,
      empty,
      fill
    ] = intents

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

    // Solution
    // fill(1)
    // jug2jug(1, 0)
    // empty(0)
    // jug2jug(1, 0)
    // fill(1)
    // jug2jug(1, 0)

    const results = checker({
      instance: dieHarder,
      initialState: { jugs: [0, 0] },
      intents: checkerIntents,
      reset: () => {
        empty(0)
        empty(1)
      },
      liveness: ({ goal, jugs = [] }) => jugs.map(content => content === goal).reduce(or, false),
      safety: ({ jugs = [], capacity = [] }) => jugs.map((content, index) => content > capacity[index]).reduce(or, false),
      options: { depthMax: 6, noDuplicateAction: true, doNotStartWith: ['empty', 'jug2jug'] }
    }, (behavior) => {
      // console.log(`\nThe model checker found this behavior to reach the liveness condition:\n${behavior.join('\n')}\n`)
    }, (err) => {
      // console.log('The model checker detected a safety condition: ', err)
    })

    expect(results.length).to.equal(2)
  }).timeout(60000)
})
