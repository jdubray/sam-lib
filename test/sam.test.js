/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const {
  SAM, first, api, createInstance, doNotRender, utils: { E }
} = require('../dist/SAM')

const SAMtest = createInstance({ instanceName: 'SAMTest' })

const {
  hasNext, setRender
} = api(SAMtest)

let tick = () => ({})

describe('SAM tests', () => {
  before(() => {
    tick = first(SAMtest({
      component: {
        actions: [
          () => ({ test: true })
        ]
      }
    }).intents)
  })

  describe('loop', () => {
    it('should create an intent', () => {
      SAMtest({
        initialState: {
          counter: 10,
          status: 'ready',
          color: 'blue'
        }
      })

      expect(tick).to.exist
    })

    it('should add an acceptor and some private state', () => {
      SAMtest({
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

    it('should add a private component with an empty localState', () => {
      SAMtest({
        component: {
          name: 'testerWithNoInitialState',
          acceptors: [
            localState => ({ test }) => {
              if (test) {
                localState.color = 'purple'
              }
            }
          ]
        },
        render: (state) => {
          const localState = state.localState('testerWithNoInitialState')
          expect(state.status).to.equal('ready')
          expect(localState.color).to.equal('purple')
          expect(state.color).to.be.equal('blue')
          expect(localState.parent.color).to.be.equal('blue')
        }
      })

      tick()
    })

    it('should add to the application state', () => {
      SAMtest({
        initialState: {
          warnings: []
        },
        render: state => expect(state.warnings).to.exist
      })

      tick()
    })

    it('should support asynchronous actions', () => {
      const { intents } = SAMtest({
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

    it('should roll back when a safety condition is detected', (done) => {
      const SafeSAM = createInstance()
      const { intents } = SafeSAM({
        initialState: {
          counter: 10,
          status: 'ready'
        },
        history: [],
        component: {
          actions: [
            () => ({ incBy: 1 }),
            () => setTimeout(() => ({ incBy: 1 }), 1000)
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
          safety: [
            {
              expression: model => model.counter > 10,
              name: 'Counter value is dangerously high'
            }
          ],
          options: {
            ignoreOutdatedProposals: true
          }
        },
        logger: {
          error: (err) => {
            expect(err.name).to.equal('Counter value is dangerously high')
          }
        },
        render: (state) => {
          // the model should have rolled back
          expect(state.counter).to.equal(10)
        }
      })

      const [inc, incLater] = intents

      incLater()
      inc()
      setTimeout(done, 1500)
    })

    it('should debounce', async (done) => {
      const SAMDebouceTest = createInstance({ instanceName: 'debouncer' })

      expect(SAMDebouceTest).to.not.equal(SAM)

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
          options: { debounce: 100 }
        },

        render: state => expect(state.counter).to.be.lessThan(3)
      })

      const [inc] = intents

      setTimeout(inc, 0)
      setTimeout(inc, 10)
      setTimeout(inc, 20)
      setTimeout(inc, 30)

      setTimeout(inc, 5000)

      done()
    })

    it('should handle action exceptions', () => {
      const SAMErroreTest = createInstance({ instanceName: 'error' })

      expect(SAMErroreTest).to.not.equal(SAM)

      const { intents } = SAMErroreTest({
        initialState: {
          counter: 0
        },

        component: {
          actions: [
            () => {
              throw new Error('Baam!')
            }
          ],
          acceptors: [
            model => (proposal) => {
              model.counter += proposal.incBy || 1
            }
          ]
        },

        render: (state) => {
          expect(state.hasError()).to.be.true
          expect(state.errorMessage()).to.be.equal('Baam!')
        }
      })

      const [inc] = intents

      inc()
    })

    it('should handle action exceptions and retry 3 times', () => {
      const SAMERetryTest = createInstance({ instanceName: 'retry' })

      expect(SAMERetryTest).to.not.equal(SAM)

      let retryCounter = 0

      const { intents } = SAMERetryTest({
        initialState: {
          counter: 0
        },

        component: {
          actions: [
            () => {
              if (retryCounter < 2) {
                retryCounter++
                throw new Error('Baam!')
              }
              return ({ incBy: 1 })
            }
          ],
          acceptors: [
            model => (proposal) => {
              model.counter += proposal.incBy || 1
            }
          ],
          options: {
            retry: {
              retryMax: 3,
              retryDelay: 50
            }
          }
        },

        render: (state) => {
          if (retryCounter < 2) {
            expect(state.hasError()).to.be.true
            expect(state.errorMessage()).to.be.equal('Baam!')
            state.clearError()
            expect(state.hasError()).to.be.false
          } else {
            expect(state.counter).to.equal(1)
          }
        }
      })

      const [inc] = intents

      // We call the intent once,
      // the SAM instance will retry 3 times
      inc()
    })

    it('should accept a limited set of actions', () => {
      const SAMAllowedActionTest = createInstance({ instanceName: 'allowed' })

      expect(SAMAllowedActionTest).to.not.equal(SAM)

      const { intents } = SAMAllowedActionTest({

        initialState: {
          counter: 0
        },

        component: {
          actions: [
            () => ({ incBy1: 1 }),
            () => ({ incBy2: 1 })
          ],
          acceptors: [
            model => ({ incBy1, incBy2 }) => {
              if (E(incBy1) || E(incBy2)) {
                model.counter += (incBy1 || 0) + (incBy2 || 0)
              }
            }
          ]
        },

        render: state => expect(state.counter).to.be.lessThan(4)
      })
      const [incBy1, incBy2] = intents
      SAMAllowedActionTest({ allow: { actions: [incBy2] } })
      incBy1()
      incBy2()
      incBy1()

      setRender(state => expect(state.counter).to.be.equal(1))
    })

    it('should accept skip rendering', () => {
      const SAMSkipRenderingTest = createInstance({ instanceName: 'allowed', hasAsyncActions: false })

      expect(SAMSkipRenderingTest).to.not.equal(SAM)

      let renderCounter = 0

      const { intents } = SAMSkipRenderingTest({

        initialState: {
          counter: 0
        },

        component: {
          actions: [
            () => ({ incBy1: 1 }),
            () => ({ incBy2: 1 })
          ],
          acceptors: [
            model => ({ incBy1, incBy2 }) => {
              if (E(incBy1) || E(incBy2)) {
                model.counter += (incBy1 || 0) + (incBy2 || 0)
              }

              // Do not render for that step
              if (E(incBy2)) {
                model.doNotRender()
              }
            }
          ],
          naps: [
            doNotRender
          ]
        },

        render: () => {
          renderCounter++
        }
      })
      const [incBy1, incBy2] = intents
      incBy1()
      incBy2()
      incBy1()

      expect(renderCounter).to.be.equal(2)
    })

    it('should run the synchronize the present method', (done) => {
      let SAMSynchronizeTest = createInstance({ instanceName: 'allowed', synchronize: true })

      expect(SAMSynchronizeTest).to.not.equal(SAM)

      let renderCounter = 0
      const timestamp = []

      const { intents } = SAMSynchronizeTest({

        initialState: {
          counter: 0
        },

        component: {
          actions: [
            () => ({ incBy1: 1 }),
            () => ({ incBy2: 1 })
          ],
          acceptors: [
            model => async ({ incBy1, incBy2 }) => {
              if (E(incBy1)) {
                model.counter += (incBy1 || 0) + (incBy2 || 0)
              }

              // simulates an async acceptor with a slow 100ms reponse time
              if (E(incBy2)) {
                await new Promise(r => setTimeout(r, 100))
                model.counter += incBy2
              }
            }
          ],
          naps: [
            doNotRender
          ]
        },

        render: () => {
          renderCounter++
          timestamp.push(new Date().getTime())
          if (renderCounter === 4) {
            expect(timestamp[1] - timestamp[0]).to.be.greaterThan(80)
            expect(timestamp[2] - timestamp[1]).to.be.lessThan(30)
            SAMSynchronizeTest({ clearInterval: true })
            done()
          }
        }
      })
      const [incBy1, incBy2] = intents
      incBy1()
      setTimeout(() => incBy2(), 0)
      setTimeout(() => incBy1(), 0)
      setTimeout(() => incBy1(), 0)
      expect(renderCounter).to.be.equal(0)
    }).timeout(5000)
  })

  describe('timetraveler', () => {
    it('should add traveler with two records of prior history', () => {
      SAMtest({
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
      SAMtest({
        travel: {
          next: true
        },
        render: state => expect(state.counter).to.equal(10)
      })

      SAMtest({
        travel: {
          next: true
        },
        render: state => expect(state.counter).to.equal(11)
      })
    })

    it('should travel back in time', () => {
      const SAMTravelerTest = createInstance({ instanceName: 'traveler' })

      expect(SAMTravelerTest).to.not.equal(SAM)

      const { intents } = SAMTravelerTest({
        history: [],

        initialState: {
          counter: 0
        },

        component: {
          actions: [
            () => ({ incByX: 1 })
          ],
          acceptors: [
            model => ({ incByX }) => {
              if (E(incByX)) {
                model.counter += incByX || 1
              }
            }
          ]
        },

        render: state => expect(state.counter).to.be.lessThan(4)
      })
      const [inc] = intents

      inc()
      inc()
      inc()

      setRender(state => expect(state.counter).to.be.equal(0))

      SAMTravelerTest({ travel: { index: 0 } })
    })
  })
})
