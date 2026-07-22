/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { default: createInstance } = require('../../lib/sam-instance')

/**
 * Captures console.warn output for the duration of a test.
 * @returns {{ messages: string[], restore: function(): void }}
 */
const stubWarn = () => {
  const messages = []
  const original = console.warn
  console.warn = (...args) => messages.push(args.join(' '))
  return { messages, restore: () => { console.warn = original } }
}

/**
 * Builds a strict instance with one guarded intent per no-op class.
 * @param {string} name - instance name
 * @returns {{ instance: function, intents: Object }}
 */
const guardedInstance = (name) => {
  const instance = createInstance({ strict: true, instanceName: name })
  const { intents } = instance({
    initialState: { role: 'leader', term: 1 },
    component: {
      modelShape: {
        role: { type: 'string' },
        term: { type: 'number' }
      },
      actions: {
        ElectionTimeout: () => ({ timeout: true }),
        SetTerm: term => ({ term }),
        Unhandled: () => ({ unhandled: true })
      },
      acceptors: [
        (model) => ({ timeout, term }, { reject, next, unchanged }) => {
          if (timeout) {
            if (model.role === 'leader') {
              return reject('leaders do not time out')
            }
            next.role = 'candidate'
            next.term = model.term + 1
          }
          if (term != null) {
            next.term = term
          }
          unchanged('*')
          return undefined
        }
        // note: no acceptor handles the Unhandled intent
      ]
    }
  })
  return { instance, intents }
}

describe('v2 — first-class reject(reason): observable enabledness (#22)', () => {
  describe('rejection log', () => {
    it('should record the intent and reason when an acceptor rejects', async () => {
      const { instance, intents } = guardedInstance('v2reject')
      await intents.ElectionTimeout()
      const step = instance({}).lastStep()
      expect(step.classification).to.equal('rejected')
      expect(step.rejections).to.deep.equal([
        { intent: 'ElectionTimeout', reason: 'leaders do not time out' }
      ])
      expect(instance({}).state('role')).to.equal('leader')
      expect(instance({}).state('term')).to.equal(1)
    })

    it('should clear the rejection log at each step', async () => {
      const { instance, intents } = guardedInstance('v2rejectClear')
      await intents.ElectionTimeout()
      expect(instance({}).lastStep().rejections).to.have.lengthOf(1)
      await intents.SetTerm(5)
      const step = instance({}).lastStep()
      expect(step.rejections).to.deep.equal([])
      expect(step.classification).to.equal('mutated')
    })
  })

  describe('no-op step classification', () => {
    it('should classify a mutating step as mutated and record the intent', async () => {
      const { instance, intents } = guardedInstance('v2classMutated')
      await intents.SetTerm(9)
      const step = instance({}).lastStep()
      expect(step.intent).to.equal('SetTerm')
      expect(step.classification).to.equal('mutated')
      expect(step.mutations).to.include('term')
    })

    it('should classify a same-value write as identity-by-mutation', async () => {
      const { instance, intents } = guardedInstance('v2classIdentity')
      await intents.SetTerm(1) // term is already 1
      const step = instance({}).lastStep()
      expect(step.classification).to.equal('identity-by-mutation')
      expect(step.mutations).to.deep.equal([])
      expect(step.writes).to.include('term')
    })

    it('should classify a fired intent with no write and no rejection as unhandled and warn', async () => {
      const { instance, intents } = guardedInstance('v2classUnhandled')
      const warn = stubWarn()
      try {
        await intents.Unhandled()
      } finally {
        warn.restore()
      }
      const step = instance({}).lastStep()
      expect(step.classification).to.equal('unhandled')
      expect(warn.messages.join(' ')).to.include('unhandled proposal')
      expect(warn.messages.join(' ')).to.include('Unhandled')
    })
  })

  describe('stepListener', () => {
    it('should invoke the listener with the step record after each step', async () => {
      const steps = []
      const instance = createInstance({ strict: true, instanceName: 'v2listener' })
      const { intents } = instance({
        initialState: { count: 0 },
        stepListener: step => steps.push(step),
        component: {
          modelShape: { count: { type: 'number' } },
          actions: {
            Increment: () => ({ increment: 1 }),
            Guarded: () => ({ guarded: true })
          },
          acceptors: [
            model => ({ increment, guarded }, { reject, next, unchanged }) => {
              if (increment != null) {
                next.count = model.count + increment
              }
              if (guarded) {
                return reject('always off')
              }
              unchanged('*')
              return undefined
            }
          ]
        }
      })

      await intents.Increment()
      await intents.Guarded()

      expect(steps).to.have.lengthOf(2)
      expect(steps[0].intent).to.equal('Increment')
      expect(steps[0].classification).to.equal('mutated')
      expect(steps[1].intent).to.equal('Guarded')
      expect(steps[1].classification).to.equal('rejected')
    })
  })

  describe('interplay with the never-enabled heuristic', () => {
    it('should not warn "possibly never enabled" for explained (rejected) no-ops', async () => {
      const { intents } = guardedInstance('v2rejectNoNoopWarn')
      const warn = stubWarn()
      try {
        await intents.ElectionTimeout()
        await intents.ElectionTimeout()
        await intents.ElectionTimeout()
        await intents.ElectionTimeout()
      } finally {
        warn.restore()
      }
      expect(warn.messages.join(' ')).to.not.include('possibly never enabled')
    })
  })

  describe('deep (in-place) mutations', () => {
    // SysMoBench S2 finding: mutating model.nodes[k].field in place changes
    // state but is invisible to the shallow write tracker — it must classify
    // as mutated (deep), not as a false "unhandled proposal"
    it('should classify an in-place nested mutation as mutated, not unhandled', async () => {
      const instance = createInstance({ strict: true, instanceName: 'v2deep' })
      const { intents } = instance({
        initialState: { nodes: { n1: { term: 0 }, n2: { term: 0 } } },
        component: {
          modelShape: { nodes: { type: 'object' } },
          actions: {
            BumpTerm: {
              action: node => ({ node }),
              schema: { node: { type: 'string', required: true } }
            }
          },
          acceptors: {
            BumpTerm: model => ({ node }, { unchanged }) => {
              model.nodes[node].term += 1 // in-place: no top-level write
              unchanged('*') // #25: frame the shape; the deep write stays in place
            }
          }
        }
      })

      const warn = stubWarn()
      try {
        await intents.BumpTerm('n1')
      } finally {
        warn.restore()
      }
      const step = instance({}).lastStep()
      expect(step.classification).to.equal('mutated')
      expect(step.deep).to.be.true
      expect(step.mutations).to.deep.equal([])
      expect(warn.messages.join(' ')).to.not.include('unhandled proposal')
      expect(instance({}).getState().nodes.n1.term).to.equal(1)
    })

    it('should still classify a true no-op as unhandled', async () => {
      const instance = createInstance({ strict: true, instanceName: 'v2deepNoop' })
      const { intents } = instance({
        initialState: { nodes: { n1: { term: 0 } } },
        component: {
          modelShape: { nodes: { type: 'object' } },
          actions: { Noop: () => ({ noop: true }) },
          acceptors: { Noop: () => (proposal, { unchanged }) => { unchanged('*'); return null } }
        }
      })
      const warn = stubWarn()
      try {
        await intents.Noop()
      } finally {
        warn.restore()
      }
      expect(instance({}).lastStep().classification).to.equal('unhandled')
      expect(instance({}).lastStep().deep).to.not.be.true
      expect(warn.messages.join(' ')).to.include('unhandled proposal')
    })
  })

  describe('v1 compatibility', () => {
    it('should leave single-argument acceptors untouched', async () => {
      const instance = createInstance({ instanceName: 'v2rejectV1' })
      const { intents } = instance({
        initialState: { count: 0 },
        component: {
          actions: [() => ({ increment: 1 })],
          acceptors: [
            model => ({ increment }) => {
              if (increment != null) {
                model.count += increment
              }
            }
          ]
        }
      })
      await intents[0]()
      expect(instance({}).state('count')).to.equal(1)
    })
  })
})
