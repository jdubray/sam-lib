/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */

// SAM v2 strict profile (issue #25): explicit next-state (prime) semantics.
//
// FAILING-FIRST (TDD, per V2-PLAN principle #4): the #25 contract is not yet
// implemented. These tests pin the intended behavior and are expected to fail
// until Phase 5.5 lands. They assert on `err.name` rather than importing the
// (not-yet-exported) SamFrameError, so they fail on behavior, not on a missing
// symbol.
//
// Contract under test:
//   - Strict acceptor signature: Name: model => (proposal, { reject, next, unchanged }) =>
//   - `model` is the deep-frozen pre-state (unprimed); writes to it throw.
//   - Writes go to the `next` draft (primed), shape-checked like #21, committed atomically.
//   - Explicit frame is the strict default: every modelShape variable must be assigned
//     in `next` or named via unchanged(...), checked once at commit over the UNION of the
//     acceptors that ran; an unaccounted variable throws SamFrameError.
//   - Double-prime (two acceptors assigning the same variable in one step) throws SamFrameError.
//   - The whole contract is STRICT-MODE ONLY; default mode keeps in-place mutation.

const { expect } = require('chai')

const { default: createInstance } = require('../../lib/sam-instance')

/**
 * Builds a strict next-state instance from a caller-supplied acceptor map.
 * modelShape is a small Raft-ish state: role, term, votedFor, audit.
 * @param {string} name - instance name
 * @param {Object} acceptors - keyed acceptor map (next-state signature)
 * @returns {{ instance: function, intents: Object }}
 */
const strictNextStateInstance = (name, acceptors) => {
  const instance = createInstance({ strict: true, instanceName: name })
  const { intents } = instance({
    initialState: {
      role: 'follower', term: 5, votedFor: null, audit: 0
    },
    component: {
      modelShape: {
        role: { type: 'string' },
        term: { type: 'number' },
        votedFor: { type: 'string', nullable: true },
        audit: { type: 'number' }
      },
      actions: {
        Bump: {
          action: node => ({ node }),
          schema: { node: { type: 'string', required: true } }
        }
      },
      acceptors
    }
  })
  return { instance, intents }
}

describe('v2 — explicit next-state (prime) semantics (#25)', () => {
  describe('package exports', () => {
    it('should export SamFrameError from the package root (2.1.1 regression)', () => {
      // 2.1.0 shipped without this export — users could catch by err.name but
      // not instanceof; pin the root surface alongside the other strict errors
      const root = require('../../index').default
      expect(root.SamFrameError).to.be.a('function')
      expect(root.SamShapeError).to.be.a('function')
      expect(root.SamSchemaError).to.be.a('function')
      expect(root.SamValidationError).to.be.a('function')
    })
  })

  describe('prime separation', () => {
    it('should read the pre-state value even after the same variable is primed (read-your-writes)', async () => {
      // next.votedFor derives from model.term AFTER next.term was assigned;
      // in TLA+ terms votedFor' = term (OLD), not term' (NEW). In-place mutation
      // could not express this correctly — model.term would already be 6.
      const { instance, intents } = strictNextStateInstance('v2ns-ryw', {
        Bump: model => (proposal, { next, unchanged }) => {
          next.term = model.term + 1        // term' = 6
          next.votedFor = String(model.term) // votedFor' = OLD term = "5"
          unchanged('role', 'audit')
        }
      })
      await intents.Bump('n1')
      expect(instance({}).state('term')).to.equal(6)
      expect(instance({}).state('votedFor')).to.equal('5') // pre-state term, not 6
    })

    it('should commit next atomically and leave framed variables at their pre-state', async () => {
      const { instance, intents } = strictNextStateInstance('v2ns-commit', {
        Bump: model => (proposal, { next, unchanged }) => {
          next.role = 'candidate'
          unchanged('term', 'votedFor', 'audit')
        }
      })
      await intents.Bump('n1')
      expect(instance({}).state('role')).to.equal('candidate')
      expect(instance({}).state('term')).to.equal(5)   // unchanged
      // state('votedFor') can't represent null (its exists-check returns the
      // model); read the snapshot instead
      expect(instance({}).getState().votedFor).to.equal(null)
    })
  })

  describe('frozen pre-state', () => {
    it('should throw SamShapeError when an acceptor writes the frozen model', async () => {
      const { intents } = strictNextStateInstance('v2ns-frozen', {
        Bump: model => () => {
          model.role = 'candidate' // must go through next
        }
      })
      try {
        await intents.Bump('n1')
        expect.fail('expected SamShapeError writing frozen model')
      } catch (err) {
        expect(err.name).to.equal('SamShapeError')
      }
    })
  })

  describe('draft shape enforcement (parity with #21)', () => {
    it('should throw SamShapeError on an undeclared next key', async () => {
      const { intents } = strictNextStateInstance('v2ns-undeclared', {
        Bump: model => (proposal, { next }) => {
          next.bogus = 1
        }
      })
      try {
        await intents.Bump('n1')
        expect.fail('expected SamShapeError for undeclared next key')
      } catch (err) {
        expect(err.name).to.equal('SamShapeError')
        expect(err.message).to.include('bogus')
      }
    })

    it('should throw SamShapeError on a type mismatch written to next', async () => {
      const { intents } = strictNextStateInstance('v2ns-mistype', {
        Bump: model => (proposal, { next }) => {
          next.term = 'not-a-number'
        }
      })
      try {
        await intents.Bump('n1')
        expect.fail('expected SamShapeError for next type mismatch')
      } catch (err) {
        expect(err.name).to.equal('SamShapeError')
        expect(err.message).to.include('term')
      }
    })
  })

  describe('explicit frame — the strict default', () => {
    it('should throw SamFrameError when a shape variable is neither assigned nor framed', async () => {
      const { intents } = strictNextStateInstance('v2ns-unframed', {
        Bump: model => (proposal, { next }) => {
          next.term = model.term + 1
          // role, votedFor, audit: neither assigned nor unchanged() → error
        }
      })
      try {
        await intents.Bump('n1')
        expect.fail('expected SamFrameError for unframed variable')
      } catch (err) {
        expect(err.name).to.equal('SamFrameError')
      }
    })

    it('should accept unchanged() naming the untouched variables', async () => {
      const { instance, intents } = strictNextStateInstance('v2ns-framed', {
        Bump: model => (proposal, { next, unchanged }) => {
          next.term = model.term + 1
          unchanged('role', 'votedFor', 'audit')
        }
      })
      await intents.Bump('n1')
      expect(instance({}).state('term')).to.equal(6)
    })

    it("should accept unchanged('*') for a genuinely read-only step", async () => {
      const { instance, intents } = strictNextStateInstance('v2ns-star', {
        Bump: model => (proposal, { unchanged }) => {
          unchanged('*')
        }
      })
      await intents.Bump('n1')
      // guard against a false green: a read-only step leaves pre-state values
      // whether the frame worked OR the acceptor threw. Assert no error was
      // recorded, so this can only pass once unchanged('*') is real.
      expect(instance({}).hasError).to.equal(false)
      expect(instance({}).state('term')).to.equal(5)
      expect(instance({}).state('role')).to.equal('follower')
    })
  })

  describe('per-step framing over the acceptor union', () => {
    it('should complete the frame across keyed + broadcast acceptors', async () => {
      // keyed assigns role/term (+frames votedFor); broadcast assigns audit.
      // Neither is individually complete — the UNION is. No SamFrameError.
      const { instance, intents } = strictNextStateInstance('v2ns-union', {
        Bump: model => (proposal, { next, unchanged }) => {
          next.role = 'candidate'
          next.term = model.term + 1
          unchanged('votedFor')
          // NOTE: does NOT frame audit — the broadcast owns it
        },
        '*': model => (proposal, { next }) => {
          next.audit = model.audit + 1
        }
      })
      await intents.Bump('n1')
      expect(instance({}).state('role')).to.equal('candidate')
      expect(instance({}).state('term')).to.equal(6)
      expect(instance({}).state('audit')).to.equal(1)
    })

    it('should throw SamFrameError on a double-prime (two acceptors assign the same variable)', async () => {
      const { intents } = strictNextStateInstance('v2ns-double', {
        Bump: model => (proposal, { next, unchanged }) => {
          next.role = 'candidate'
          next.term = model.term + 1
          unchanged('votedFor', 'audit')
        },
        '*': model => (proposal, { next }) => {
          next.role = 'leader' // conflicts with the keyed acceptor's role'
        }
      })
      try {
        await intents.Bump('n1')
        expect.fail('expected SamFrameError for double-prime')
      } catch (err) {
        expect(err.name).to.equal('SamFrameError')
      }
    })
  })

  describe('step log', () => {
    it('should expose the primed set and the frame on lastStep()', async () => {
      const { instance, intents } = strictNextStateInstance('v2ns-laststep', {
        Bump: model => (proposal, { next, unchanged }) => {
          next.term = model.term + 1
          unchanged('role', 'votedFor', 'audit')
        }
      })
      await intents.Bump('n1')
      const step = instance({}).lastStep()
      expect(Object.keys(step.primed)).to.include('term')
      expect(step.primed.term).to.deep.equal({ from: 5, to: 6 })
      expect(step.unchanged).to.include.members(['role', 'votedFor', 'audit'])
    })
  })

  describe('manifest frame view (#25 tooling)', () => {
    it('should report each acceptor\'s accumulated prime set and frame from execution', async () => {
      const { instance, intents } = strictNextStateInstance('v2ns-manifest', {
        Bump: model => (proposal, { next, unchanged }) => {
          next.role = 'candidate'
          next.term = model.term + 1
          unchanged('votedFor')
        },
        '*': model => (proposal, { next }) => {
          next.audit = model.audit + 1
        }
      })
      // before exploration the accumulators are empty (structure learned from runs)
      expect(instance({}).manifest().acceptors.frames.Bump.primes).to.deep.equal([])
      await intents.Bump('n1')
      const { frames } = instance({}).manifest().acceptors
      expect(frames.Bump.primes).to.include.members(['role', 'term'])
      expect(frames.Bump.unchanged).to.deep.equal(['votedFor'])
      expect(frames.Bump.unchangedAll).to.equal(false)
      // broadcast acceptor reports under '*'
      expect(frames['*'].primes).to.deep.equal(['audit'])
    })

    it("should record unchangedAll when an acceptor frames with unchanged('*')", async () => {
      const { instance, intents } = strictNextStateInstance('v2ns-manifest-star', {
        Bump: model => (proposal, { next, unchanged }) => {
          next.term = model.term + 1
          unchanged('*')
        }
      })
      await intents.Bump('n1')
      const { frames } = instance({}).manifest().acceptors
      expect(frames.Bump.primes).to.deep.equal(['term'])
      expect(frames.Bump.unchangedAll).to.equal(true)
    })

    it('should keep prime attribution when an async acceptor writes after an await', async () => {
      // review fix #2: next/unchanged are bound to the acceptor id at
      // registration (not a shared mutable current-id), so a write after an
      // await still attributes to the right acceptor
      const instance = createInstance({ strict: true, instanceName: 'v2ns-async', synchronize: true })
      const { intents } = instance({
        initialState: { a: 0, b: 0 },
        component: {
          modelShape: { a: { type: 'number' }, b: { type: 'number' } },
          actions: {
            Go: { action: () => ({ go: true }), schema: {}, domain: [{}] }
          },
          acceptors: {
            Go: model => async (proposal, { next, unchanged }) => {
              await new Promise(resolve => setTimeout(resolve, 5))
              next.a = model.a + 1
              unchanged('b')
            }
          }
        }
      })
      intents.Go()
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(instance({}).getState()).to.deep.equal({ a: 1, b: 0 })
      const { frames } = instance({}).manifest().acceptors
      expect(frames.Go.primes).to.deep.equal(['a'])
      expect(frames.Go.unchanged).to.deep.equal(['b'])
      instance({}).dispose()
    })
  })

  describe('frame diagnostics (review fixes #3/#5)', () => {
    it('should throw SamFrameError naming the intent when no acceptor constrains the step', async () => {
      // an intent with no acceptor at all: the empty frame is the
      // unhandled-intent signature and the error says so
      const instance = createInstance({ strict: true, instanceName: 'v2ns-orphan', devWarnings: false })
      const { intents } = instance({
        initialState: { a: 0 },
        component: {
          modelShape: { a: { type: 'number' } },
          actions: { Orphan: { action: () => ({ x: 1 }), schema: {}, domain: [{}] } },
          acceptors: {}
        }
      })
      try {
        await intents.Orphan()
        expect.fail('expected SamFrameError for orphan intent')
      } catch (err) {
        expect(err.name).to.equal('SamFrameError')
        expect(err.message).to.include("intent 'Orphan'")
        expect(err.unhandledIntent).to.equal('Orphan')
      }
    })

    it('should throw SamFrameError on unchanged() with an unknown variable name', async () => {
      const { intents } = strictNextStateInstance('v2ns-typo', {
        Bump: model => (proposal, { next, unchanged }) => {
          next.role = 'candidate'
          next.term = model.term + 1
          next.votedFor = 'n1'
          next.audit = model.audit + 1
          unchanged('bogusVariable') // typo — must not be silently accepted
        }
      })
      try {
        await intents.Bump('n1')
        expect.fail('expected SamFrameError for unknown unchanged() name')
      } catch (err) {
        expect(err.name).to.equal('SamFrameError')
        expect(err.message).to.include('bogusVariable')
      }
    })
  })

  describe('async acceptors on non-synchronized instances (2.1.2 regression)', () => {
    it('should throw SamFrameError instead of silently discarding post-await writes', async () => {
      // without the guard, next.term written after the await lands in a draft
      // the next step discards — the silent-loss class #25 exists to kill
      const { intents } = strictNextStateInstance('v2ns-async-nosync', {
        Bump: model => async (proposal, { next, unchanged }) => {
          await new Promise(resolve => setTimeout(resolve, 5))
          next.term = model.term + 1
          unchanged('*')
        }
      })
      try {
        await intents.Bump('n1')
        expect.fail('expected SamFrameError for async acceptor on non-synchronized instance')
      } catch (err) {
        expect(err.name).to.equal('SamFrameError')
        expect(err.asyncAcceptor).to.equal(true)
        expect(err.message).to.include('synchronize')
      }
    })

    it('should not throw in default mode (v1 behavior preserved, warn-only)', async () => {
      const instance = createInstance({ instanceName: 'v2ns-async-default' })
      const { intents } = instance({
        initialState: { count: 0 },
        component: {
          actions: [() => ({ tick: true })],
          acceptors: [
            model => async () => { model.count += 1 } // completes before returning
          ]
        }
      })
      await intents[0]() // must not throw
      expect(instance({}).state('count')).to.equal(1)
    })
  })

  describe('strict-mode only', () => {
    it('should NOT provide next/unchanged and should NOT freeze the model in default mode', async () => {
      const seen = {}
      const instance = createInstance({ instanceName: 'v2ns-default' }) // no strict
      const { intents } = instance({
        initialState: { count: 0 },
        component: {
          actions: [() => ({ tick: true })],
          acceptors: [
            model => (proposal, stepApi) => {
              seen.hasNext = stepApi != null && 'next' in stepApi
              seen.hasUnchanged = stepApi != null && 'unchanged' in stepApi
              model.count += 1 // in-place mutation must still work (model not frozen)
            }
          ]
        }
      })
      await intents[0]()
      expect(seen.hasNext).to.equal(false)
      expect(seen.hasUnchanged).to.equal(false)
      expect(instance({}).state('count')).to.equal(1)
    })

    it('should NOT enforce the frame (no SamFrameError) in default mode', async () => {
      const instance = createInstance({ instanceName: 'v2ns-default-frame' })
      const { intents } = instance({
        initialState: { a: 0, b: 0 },
        component: {
          actions: [() => ({ tick: true })],
          acceptors: [
            model => () => {
              model.a += 1 // b left untouched — legal in default mode, no frame check
            }
          ]
        }
      })
      await intents[0]() // must not throw
      expect(instance({}).state('a')).to.equal(1)
      expect(instance({}).state('b')).to.equal(0)
    })
  })
})
