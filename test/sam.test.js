/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { SAM, first, api } = require('../dist/sam')

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
          status: 'ready'
        }
      })

      expect(tick).to.exist
    })

    it('should add an acceptor', () => {
      SAM({
        component: {
          acceptors: [
            model => ({ test }) => {
              if (test) {
                model.status = 'testing'
              }
            }
          ]
        },
        render: state => expect(state.status).to.equal('testing')
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
  })

  describe('timetraveler', () => {
    it('should add traveler', () => {
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
