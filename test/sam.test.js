/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const {
  SAM, first, api, utils: {
    O
  }
} = require('../dist/sam')

const {
  hasNext, addInitialState, addComponent, setRender, travel, addTimeTraveler
} = api()

let tick = () => ({})

describe('SAM tests', () => {
  before(() => {
    tick = first(SAM({
      component: {
        actions: [
          () => ({ test: true })
        ]
      }
    }).intents)
  })

  describe('loop', () => {
    it('should create an intent', () => {
      SAM({
        initialState: {
          counter: 10,
          status: 'ready',
          color: 'blue'
        }
      })

      expect(tick).to.exist
    })

    it('should add an acceptor and some private state', () => {
      SAM({
        component: {
          name: 'tester',
          localState: {
            color: 'blue'
          },
          acceptors: [
            localState => ({ test }) => {
              if (test) {
                localState.color = 'purple'
              }
            }
          ]
        },
        render: (state) => {
          const localState = state.localState('tester')
          expect(state.status).to.equal('ready')
          expect(localState.color).to.equal('purple')
          expect(state.color).to.be.equal('blue')
          expect(localState.parent.color).to.be.equal('blue')
        }
      })

      tick()
    })

    it('should add to the application state', () => {
      SAM({
        initialState: {
          warnings: []
        },
        render: state => expect(state.warnings).to.exist
      })

      tick()
    })

    it('should support asynchronous actions', () => {
      const { intents } = SAM({
        initialState: {
          counter: 10,
          status: 'ready'
        },
        component: {
          actions: [
            () => new Promise(r => setTimeout(r, 1000)).then(() => ({ test: true }))
          ],
          acceptors: [
            model => ({ test }) => {
              if (test) {
                model.status = 'testing'
              }
            }
          ]
        },
        render: (state) => {
          expect(state.status).to.equal('testing')
        }
      })

      const [test] = intents

      test()
    })
  })

  describe('timetraveler', () => {
    it('should add traveler with two records of prior history', () => {
      SAM({
        history: [{
          counter: 10,
          status: 'ready'
        }, {
          counter: 11,
          status: 'traveled'
        }
        ]
      })

      expect(hasNext()).to.be.true
    })

    it('should move to the next state', () => {
      SAM({
        travel: {
          next: true
        },
        render: state => expect(state.counter).to.equal(10)
      })

      SAM({
        travel: {
          next: true
        },
        render: state => expect(state.counter).to.equal(11)
      })
    })

    it('should travel back in time', () => {
      addTimeTraveler([])

      addInitialState({
        counter: 0
      })

      const { intents } = addComponent({
        actions: [
          () => ({ incBy: 1 })
        ],
        acceptors: [
          model => (proposal) => {
            model.counter += proposal.incBy || 1
          }
        ]
      })

      setRender(state => expect(state.counter).to.be.lessThan(4))

      const [inc] = intents

      inc()
      inc()
      inc()

      setRender(state => expect(state.counter).to.be.equal(0))

      travel(0)
    })
  })
})
