/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { default: createInstance } = require('../../lib/sam-instance')

/**
 * Builds a strict instance with keyed acceptors and an invocation probe.
 * @param {string} name - instance name
 * @returns {{ instance: function, intents: Object, calls: Object }}
 */
const keyedInstance = (name) => {
  const calls = { ElectionTimeout: 0, AppendEntries: 0, broadcast: 0 }
  const instance = createInstance({ strict: true, instanceName: name })
  const { intents } = instance({
    initialState: {
      role: 'follower', term: 0, lastAction: '', steps: 0
    },
    component: {
      modelShape: {
        role: { type: 'string' },
        term: { type: 'number' },
        lastAction: { type: 'string' },
        steps: { type: 'number', derived: true }
      },
      actions: {
        ElectionTimeout: {
          action: node => ({ node }),
          schema: { node: { type: 'string', required: true } }
        },
        AppendEntries: {
          action: term => ({ term }),
          schema: { term: { type: 'number', required: true } }
        }
      },
      acceptors: {
        ElectionTimeout: model => (proposal, { reject }) => {
          calls.ElectionTimeout += 1
          if (model.role === 'leader') {
            return reject('leaders do not time out')
          }
          model.role = 'candidate'
          model.lastAction = `timeout:${proposal.node}`
          return undefined
        },
        AppendEntries: model => (proposal) => {
          calls.AppendEntries += 1
          model.term = proposal.term
          model.lastAction = 'append'
        },
        '*': model => () => {
          calls.broadcast += 1
          model.steps += 1
        }
      }
    }
  })
  return { instance, intents, calls }
}

describe('v2 — per-action acceptor registration (#23)', () => {
  describe('keyed dispatch', () => {
    it('should invoke a keyed acceptor only for its own action', async () => {
      const { instance, intents, calls } = keyedInstance('v2keyed')

      await intents.ElectionTimeout('n1')
      expect(calls.ElectionTimeout).to.equal(1)
      expect(calls.AppendEntries).to.equal(0)
      expect(instance({}).state('role')).to.equal('candidate')
      expect(instance({}).state('lastAction')).to.equal('timeout:n1')

      await intents.AppendEntries(4)
      expect(calls.ElectionTimeout).to.equal(1)
      expect(calls.AppendEntries).to.equal(1)
      expect(instance({}).state('term')).to.equal(4)
    })

    it('should invoke a broadcast (*) acceptor for every proposal', async () => {
      const { instance, intents, calls } = keyedInstance('v2broadcast')
      await intents.ElectionTimeout('n1')
      await intents.AppendEntries(2)
      expect(calls.broadcast).to.equal(2)
      expect(instance({}).state('steps')).to.equal(2)
    })

    it('should support reject inside keyed acceptors', async () => {
      const { instance, intents } = keyedInstance('v2keyedReject')
      // drive to candidate then hand-pin to leader through setState
      instance({}).setState({ role: 'leader' })
      await intents.ElectionTimeout('n1')
      const step = instance({}).lastStep()
      expect(step.rejections).to.deep.equal([
        { intent: 'ElectionTimeout', reason: 'leaders do not time out' }
      ])
      expect(instance({}).state('role')).to.equal('leader')
    })
  })

  describe('strict mode — binding validation', () => {
    it('should throw at registration when a keyed acceptor references an unknown intent', () => {
      const instance = createInstance({ strict: true, instanceName: 'v2keyedUnknown' })
      expect(() => instance({
        initialState: { count: 0 },
        component: {
          modelShape: { count: { type: 'number' } },
          actions: { Increment: () => ({ increment: 1 }) },
          acceptors: {
            Incrment: model => ({ increment }) => { // typo: misbinding
              model.count += increment
            }
          }
        }
      })).to.throw(/Incrment/)
    })
  })

  describe('manifest', () => {
    it('should report intents, schemas, domains, acceptor bindings and model shape', () => {
      const instance = createInstance({ strict: true, instanceName: 'v2manifest' })
      instance({
        initialState: { count: 0 },
        component: {
          modelShape: { count: { type: 'number' } },
          actions: {
            Increment: {
              action: by => ({ by }),
              schema: { by: { type: 'number', required: true } },
              domain: [{ by: 1 }, { by: 5 }]
            },
            Reset: () => ({ reset: true })
          },
          acceptors: {
            Increment: model => ({ by }) => {
              model.count += by
            },
            '*': () => () => null
          }
        }
      })

      const manifest = instance({}).manifest()
      expect(manifest.intents.Increment.schema).to.deep.equal({ by: { type: 'number', required: true } })
      expect(manifest.intents.Increment.domain).to.deep.equal([{ by: 1 }, { by: 5 }])
      expect(manifest.intents.Reset).to.exist
      expect(manifest.acceptors.keyed).to.deep.equal(['Increment'])
      expect(manifest.acceptors.broadcast).to.equal(1)
      expect(manifest.modelShape).to.deep.equal({ count: { type: 'number' } })
    })
  })

  describe('v1 compatibility', () => {
    it('should keep array acceptors working (counted as broadcast)', async () => {
      const instance = createInstance({ instanceName: 'v2keyedV1' })
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
      expect(instance({}).manifest().acceptors.broadcast).to.equal(1)
    })
  })
})
