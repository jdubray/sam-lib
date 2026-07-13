/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { default: createInstance } = require('../../lib/sam-instance')
const { SamShapeError } = require('../../lib/sam-strict')

const raftShape = {
  role: { type: 'string' },
  term: { type: 'number' },
  votedFor: { type: 'string', nullable: true },
  tally: { type: 'object', internal: true }
}

/**
 * Builds a strict instance declaring the raft-like model shape.
 * @param {string} name - instance name
 * @returns {{ instance: function, intents: Object }}
 */
const strictRaftInstance = (name) => {
  const instance = createInstance({ strict: true, instanceName: name })
  const { intents } = instance({
    initialState: {
      role: 'follower', term: 0, votedFor: null, tally: {}
    },
    component: {
      modelShape: raftShape,
      actions: {
        RequestVote: node => ({ node }),
        SetTerm: term => ({ term }),
        HideState: () => ({ hide: true }),
        BadTerm: () => ({ badTerm: 'two' })
      },
      acceptors: [
        model => ({
          node, term, hide, badTerm
        }) => {
          if (node != null) {
            model.votedFor = node
          }
          if (term != null) {
            model.term = term
          }
          if (hide) {
            // The Sonnet failure class: hidden bookkeeping state
            model._votes = { n1: true }
          }
          if (badTerm != null) {
            model.term = badTerm
          }
        }
      ]
    }
  })
  return { instance, intents }
}

describe('v2 — declared, sealed model shape (#21)', () => {
  describe('strict mode — sealing', () => {
    it('should throw SamShapeError when an acceptor writes an undeclared key', async () => {
      const { intents } = strictRaftInstance('v2seal')
      try {
        await intents.HideState()
        expect.fail('expected SamShapeError')
      } catch (err) {
        expect(err.name).to.equal('SamShapeError')
        expect(err.message).to.include('_votes')
      }
    })

    it('should allow writes to declared keys', async () => {
      const { instance, intents } = strictRaftInstance('v2sealOk')
      await intents.RequestVote('n1')
      await intents.SetTerm(2)
      expect(instance({}).state('votedFor')).to.equal('n1')
      expect(instance({}).state('term')).to.equal(2)
    })

    it('should throw SamShapeError on a type mismatch for a declared key', async () => {
      const { intents } = strictRaftInstance('v2sealType')
      try {
        await intents.BadTerm()
        expect.fail('expected SamShapeError')
      } catch (err) {
        expect(err.name).to.equal('SamShapeError')
        expect(err.message).to.include('term')
      }
    })

    it('should throw at shape registration when the initial state has undeclared keys', () => {
      const instance = createInstance({ strict: true, instanceName: 'v2sealInit' })
      expect(() => instance({
        initialState: { role: 'follower', _sneaky: true },
        component: {
          modelShape: { role: { type: 'string' } },
          actions: { Noop: () => ({}) },
          acceptors: [() => () => null]
        }
      })).to.throw(SamShapeError, /_sneaky/)
    })

    it('should allow reactors to write declared derived keys', async () => {
      const instance = createInstance({ strict: true, instanceName: 'v2derived' })
      const { intents } = instance({
        initialState: { count: 0 },
        component: {
          modelShape: {
            count: { type: 'number' },
            double: { type: 'number', derived: true }
          },
          actions: { Increment: () => ({ increment: 1 }) },
          acceptors: [
            model => ({ increment }) => {
              if (increment != null) {
                model.count += increment
              }
            }
          ],
          reactors: [
            model => () => {
              model.double = model.count * 2
            }
          ]
        }
      })
      await intents.Increment()
      expect(instance({}).state('double')).to.equal(2)
    })
  })

  describe('getState / setState', () => {
    it('should snapshot exactly the declared non-internal keys', async () => {
      const { instance, intents } = strictRaftInstance('v2snap')
      await intents.RequestVote('n1')
      const snapshot = instance({}).getState()
      expect(snapshot).to.deep.equal({ role: 'follower', term: 0, votedFor: 'n1' })
      expect(snapshot).to.not.have.property('tally')
    })

    it('should restore observable state: setState(getState()) round-trip is total', async () => {
      const { instance, intents } = strictRaftInstance('v2roundtrip')
      await intents.RequestVote('n1')
      await intents.SetTerm(3)
      const pinned = instance({}).getState()

      await intents.RequestVote('n2')
      await intents.SetTerm(7)
      expect(instance({}).state('votedFor')).to.equal('n2')

      instance({}).setState(pinned)
      expect(instance({}).getState()).to.deep.equal(pinned)
      expect(instance({}).state('votedFor')).to.equal('n1')
      expect(instance({}).state('term')).to.equal(3)
    })

    it('should return an independent copy, not a live reference', async () => {
      const { instance, intents } = strictRaftInstance('v2copy')
      const snapshot = instance({}).getState()
      snapshot.role = 'tampered'
      expect(instance({}).state('role')).to.equal('follower')
      await intents.SetTerm(5)
      expect(snapshot.term).to.equal(0)
    })

    it('should throw SamShapeError when setState receives undeclared keys in strict mode', () => {
      const { instance } = strictRaftInstance('v2setUndeclared')
      expect(() => instance({}).setState({ role: 'leader', _votes: {} }))
        .to.throw(SamShapeError, /_votes/)
    })

    it('should fall back to all observable keys when no shape is declared', async () => {
      const instance = createInstance({ instanceName: 'v2noshape' })
      const { intents } = instance({
        initialState: { count: 0 },
        component: {
          actions: { Increment: () => ({ increment: 1 }) },
          acceptors: [
            model => ({ increment }) => {
              if (increment != null) {
                model.count += increment
              }
            }
          ]
        }
      })
      await intents.Increment()
      const snapshot = instance({}).getState()
      expect(snapshot.count).to.equal(1)
      expect(Object.keys(snapshot).some(k => k.startsWith('__'))).to.be.false
    })
  })

  describe('mutation tracking', () => {
    it('should report which declared keys changed during the last step', async () => {
      const { instance, intents } = strictRaftInstance('v2mutations')
      await intents.RequestVote('n1')
      expect(instance({}).lastStep().mutations).to.include('votedFor')
      await intents.SetTerm(4)
      const { mutations } = instance({}).lastStep()
      expect(mutations).to.include('term')
      expect(mutations).to.not.include('votedFor')
    })

    it('should report no mutations for a rejected/no-op step', async () => {
      const { instance, intents } = strictRaftInstance('v2noopStep')
      await intents.SetTerm(0)
      expect(instance({}).lastStep().mutations).to.deep.equal([])
    })
  })

  describe('default mode — v1 behavior preserved', () => {
    it('should not seal the model when strict is off, even with a declared shape', async () => {
      const instance = createInstance({ instanceName: 'v2unsealed' })
      const { intents } = instance({
        initialState: { role: 'follower' },
        component: {
          modelShape: { role: { type: 'string' } },
          actions: { HideState: () => ({ hide: true }) },
          acceptors: [
            model => ({ hide }) => {
              if (hide) {
                model._votes = { n1: true }
              }
            }
          ]
        }
      })
      await intents.HideState()
      expect(instance({}).state('_votes')).to.deep.equal({ n1: true })
    })
  })
})
