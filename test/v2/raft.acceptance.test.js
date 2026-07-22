/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { default: createInstance } = require('../../lib/sam-instance')
const { checker } = require('../../lib/sam-checker')
const { SamSchemaError, SamShapeError } = require('../../lib/sam-strict')

/**
 * End-to-end acceptance: the etcd/Raft leader-election spec (single-node
 * view, 3-node cluster) written in the v2 strict profile. Each failure class
 * from the SysMoBench study is asserted to be a construction-time or
 * first-fire failure instead of a silent defect.
 */
const leaderElection = (name, overrides = {}) => {
  const instance = createInstance({
    strict: true, hasAsyncActions: false, instanceName: name
  })
  const control = instance({
    initialState: {
      role: 'follower', term: 0, votedFor: null, votesGranted: 0
    },
    component: {
      modelShape: {
        role: { type: 'string' },
        term: { type: 'number' },
        votedFor: { type: 'string', nullable: true },
        votesGranted: { type: 'number' }
      },
      actions: {
        ElectionTimeout: {
          action: () => ({ timeout: true }),
          schema: { timeout: { type: 'boolean', required: true } },
          domain: [[]]
        },
        VoteGranted: {
          action: from => ({ from }),
          schema: { from: { type: 'string', required: true } },
          domain: ['n2', 'n3']
        },
        Heartbeat: {
          action: (term, leader) => ({ term, leader }),
          schema: {
            term: { type: 'number', required: true },
            leader: { type: 'string', required: true }
          },
          domain: [[0, 'n2'], [2, 'n2']]
        },
        ...(overrides.actions ?? {})
      },
      acceptors: {
        ElectionTimeout: model => (proposal, { reject, next }) => {
          if (model.role === 'leader') {
            return reject('leaders do not time out')
          }
          // committing path assigns every declared variable — no framing needed
          next.role = 'candidate'
          next.term = model.term + 1 // #25: increment reads the pre-state term
          next.votedFor = 'n1'
          next.votesGranted = 1
          return undefined
        },
        VoteGranted: model => (proposal, { reject, next, unchanged }) => {
          if (model.role !== 'candidate') {
            return reject('votes only count while campaigning')
          }
          // read-your-writes: threshold tests the newly tallied count, not pre-state
          const votesGranted = model.votesGranted + 1
          next.votesGranted = votesGranted
          unchanged('term', 'votedFor')
          if (votesGranted >= 2) {
            next.role = 'leader'
          } else {
            unchanged('role')
          }
          return undefined
        },
        Heartbeat: model => (proposal, { reject, next }) => {
          if (proposal.term < model.term) {
            return reject('stale term')
          }
          // stepping down assigns every declared variable — no framing needed
          next.role = 'follower'
          next.term = proposal.term
          next.votedFor = null
          next.votesGranted = 0
          return undefined
        },
        ...(overrides.acceptors ?? {})
      }
    }
  })
  return { instance, intents: control.intents }
}

describe('v2 — Raft leader election acceptance (strict profile end-to-end)', () => {
  it('should elect a leader through the declared happy path', () => {
    const { instance, intents } = leaderElection('raftHappy')
    intents.ElectionTimeout()
    intents.VoteGranted('n2')
    expect(instance({}).getState()).to.deep.equal({
      role: 'leader', term: 1, votedFor: 'n1', votesGranted: 2
    })
  })

  it('should pass validate(): every obligation is declared', () => {
    const { instance } = leaderElection('raftValidate')
    expect(instance({}).validate()).to.deep.equal([])
  })

  it('failure class 1 — dropped payload throws on first fire, not a silent no-op machine', () => {
    // the Haiku collapse: a zero-argument action creator that drops its payload
    const { intents } = leaderElection('raftDroppedPayload', {
      actions: {
        VoteGranted: {
          action: () => ({}),
          schema: { from: { type: 'string', required: true } },
          domain: ['n2', 'n3']
        }
      }
    })
    expect(() => intents.VoteGranted('n2')).to.throw(SamSchemaError, /from/)
  })

  it('failure class 2 — hidden bookkeeping state throws instead of breaking replay', () => {
    // the Sonnet defect: private vote tallies outside the declared shape
    const { intents } = leaderElection('raftHiddenState', {
      acceptors: {
        VoteGranted: model => ({ from }, { next }) => {
          next._votes = { [from]: true }
        }
      }
    })
    intents.ElectionTimeout()
    expect(() => intents.VoteGranted('n2')).to.throw(SamShapeError, /_votes/)
  })

  it('failure class 3 — rejection is distinguishable from oversight', () => {
    const { instance, intents } = leaderElection('raftEnabledness')
    intents.ElectionTimeout()
    intents.VoteGranted('n2') // now leader, term 1

    intents.Heartbeat(0, 'n2') // stale
    const rejected = instance({}).lastStep()
    expect(rejected.classification).to.equal('rejected')
    expect(rejected.rejections).to.deep.equal([{ intent: 'Heartbeat', reason: 'stale term' }])

    intents.Heartbeat(2, 'n2') // legitimate: step down
    expect(instance({}).lastStep().classification).to.equal('mutated')
    expect(instance({}).state('role')).to.equal('follower')
  })

  it('failure class 4 — action binding is structural, not a discriminator convention', () => {
    const { instance } = leaderElection('raftBinding')
    const manifest = instance({}).manifest()
    expect(manifest.acceptors.keyed).to.have.members(['ElectionTimeout', 'VoteGranted', 'Heartbeat'])
    expect(manifest.acceptors.broadcast).to.equal(0)
    // a keyed acceptor cannot be registered against a nonexistent action
    expect(() => leaderElection('raftMisbound', {
      acceptors: { ElectionTimeut: () => () => null } // typo
    })).to.throw(/ElectionTimeut/)
  })

  it('failure class 5 — explorable with zero harness-side configuration', () => {
    const { instance } = leaderElection('raftExplore')
    const initialState = {
      role: 'follower', term: 0, votedFor: null, votesGranted: 0
    }
    const elected = []
    const unsafe = []
    checker({
      instance,
      initialState,
      reset: init => instance({}).setState(init),
      liveness: state => state.role === 'leader',
      safety: state => state.role === 'leader' && state.votesGranted < 2,
      options: { depthMax: 2 }
    }, behavior => elected.push(behavior), behavior => unsafe.push(behavior))

    expect(elected.length, 'leader election is reachable').to.be.greaterThan(0)
    expect(unsafe.length, 'no minority leader is reachable').to.equal(0)
  })

  it('replay pinning: setState(getState()) restores any explored state', () => {
    const { instance, intents } = leaderElection('raftReplay')
    intents.ElectionTimeout()
    const pinned = instance({}).getState()
    intents.VoteGranted('n2')
    intents.Heartbeat(5, 'n3')
    instance({}).setState(pinned)
    expect(instance({}).getState()).to.deep.equal(pinned)
    // and the machine continues correctly from the pinned state
    intents.VoteGranted('n3')
    expect(instance({}).state('role')).to.equal('leader')
  })
})
