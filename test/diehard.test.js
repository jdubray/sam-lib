// This code is implementing the dieharder TLA+ specification
// https://github.com/tlaplus/Examples/blob/master/specifications/DieHard/DieHarder.pdf

/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { utils: { E, or } } = require('../dist/SAM')

const {
  api, createInstance
} = require('../dist/SAM')

const {
  addInitialState, addComponent, setRender
} = api(createInstance())

let tick = () => ({})

describe('SAM examples: dieharder', () => {
  it('should initialize the jugs and the goal', () => {
    addInitialState({
      n: 2,
      jugs: [0, 0],
      capacity: [3, 5],
      goal: 4
    })
  })

  it('should add the juggler component', () => {
    const { intents } = addComponent({
      actions: [
        (j1, j2) => ({
          jug2jug: { j1, j2 }
        }),
        j => ({ empty: j }),
        j => ({ fill: j })
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
            if (E(j1) && j1 < n && j1 >= 0
                && E(j2) && j2 < n && j2 >= 0) {
              const maxAllowed = capacity[j2] - jugs[j2]
              const transfer = Math.min(maxAllowed, jugs[j1])
              jugs[j1] -= transfer
              jugs[j2] += transfer
            }
          }
        }
      ]
    })

    let step = 0
    setRender(({ goal, jugs }) => {
      const goalReached = jugs.map(content => content === goal).reduce(or)
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

    fill(1)
    jug2jug(1, 0)
    empty(0)
    jug2jug(1, 0)
    fill(1)
    jug2jug(1, 0)
  })
})
