/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { default: createInstance } = require('../../lib/sam-instance')
const { SamSchemaError, validateProposal } = require('../../lib/sam-strict')

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

describe('v2 — named intents with payload schemas (#20)', () => {
  describe('validateProposal', () => {
    it('should return no violations for a valid proposal', () => {
      const schema = { node: { type: 'string', required: true }, term: { type: 'number' } }
      expect(validateProposal(schema, { node: 'n1', term: 2 })).to.deep.equal([])
    })

    it('should report a missing required field', () => {
      const schema = { node: { type: 'string', required: true } }
      const violations = validateProposal(schema, {})
      expect(violations).to.have.lengthOf(1)
      expect(violations[0]).to.include('node')
    })

    it('should report a type mismatch', () => {
      const schema = { term: { type: 'number' } }
      const violations = validateProposal(schema, { term: 'two' })
      expect(violations).to.have.lengthOf(1)
      expect(violations[0]).to.include('term')
    })

    it('should distinguish arrays from objects', () => {
      const schema = { entries: { type: 'array' }, meta: { type: 'object' } }
      expect(validateProposal(schema, { entries: [], meta: {} })).to.deep.equal([])
      expect(validateProposal(schema, { entries: {}, meta: [] })).to.have.lengthOf(2)
    })

    it('should allow null only when the field is nullable', () => {
      const schema = {
        votedFor: { type: 'string', nullable: true },
        node: { type: 'string' }
      }
      expect(validateProposal(schema, { votedFor: null })).to.deep.equal([])
      expect(validateProposal(schema, { node: null })).to.have.lengthOf(1)
    })

    it('should ignore optional fields that are absent and undeclared fields', () => {
      const schema = { node: { type: 'string' } }
      expect(validateProposal(schema, { somethingElse: 42 })).to.deep.equal([])
    })
  })

  describe('named intent registration', () => {
    it('should return intents keyed by name and present proposals to acceptors', async () => {
      const instance = createInstance({ instanceName: 'v2named' })
      const { intents } = instance({
        initialState: { name: '', resets: 0 },
        component: {
          actions: {
            SetName: {
              action: name => ({ name }),
              schema: { name: { type: 'string', required: true } }
            },
            Reset: () => ({ reset: true })
          },
          acceptors: [
            model => ({ name, reset }) => {
              if (name != null) {
                model.name = name
              }
              if (reset) {
                model.name = ''
                model.resets += 1
              }
            }
          ]
        }
      })

      expect(intents).to.be.an('object')
      expect(intents.SetName).to.be.a('function')
      expect(intents.SetName.__actionName).to.equal('SetName')
      expect(intents.Reset).to.be.a('function')

      await intents.SetName('sam')
      expect(instance({}).state('name')).to.equal('sam')

      await intents.Reset()
      expect(instance({}).state('name')).to.equal('')
      expect(instance({}).state('resets')).to.equal(1)
    })

    it('should keep the v1 array form working on a strict instance', async () => {
      const instance = createInstance({ instanceName: 'v2array', strict: true })
      const { intents } = instance({
        initialState: { ticked: false },
        component: {
          actions: [() => ({ tick: true })],
          acceptors: [
            model => ({ tick }) => {
              if (tick) {
                model.ticked = true
              }
            }
          ]
        }
      })

      expect(Array.isArray(intents)).to.be.true
      await intents[0]()
      expect(instance({}).state('ticked')).to.be.true
    })
  })

  describe('strict mode — schema enforcement', () => {
    it('should throw SamSchemaError when a required field is missing and skip acceptors', async () => {
      const instance = createInstance({ instanceName: 'v2strict', strict: true })
      let accepted = false
      const { intents } = instance({
        initialState: {},
        component: {
          actions: {
            // The Haiku failure class: a zero-argument action creator that drops its payload
            ElectionTimeout: {
              action: () => ({}),
              schema: { node: { type: 'string', required: true } }
            }
          },
          acceptors: [
            () => ({ node }) => {
              if (node != null) {
                accepted = true
              }
            }
          ]
        }
      })

      try {
        await intents.ElectionTimeout('n1')
        expect.fail('expected SamSchemaError')
      } catch (err) {
        expect(err.name).to.equal('SamSchemaError')
        expect(err.message).to.include('ElectionTimeout')
        expect(err.message).to.include('node')
      }
      expect(accepted).to.be.false
    })

    it('should throw SamSchemaError on a type mismatch', async () => {
      const instance = createInstance({ instanceName: 'v2strictType', strict: true })
      const { intents } = instance({
        initialState: {},
        component: {
          actions: {
            SetTerm: {
              action: term => ({ term }),
              schema: { term: { type: 'number', required: true } }
            }
          },
          acceptors: [() => () => null]
        }
      })

      try {
        await intents.SetTerm('two')
        expect.fail('expected SamSchemaError')
      } catch (err) {
        expect(err).to.be.instanceOf(SamSchemaError)
        expect(err.violations).to.have.lengthOf(1)
      }
    })

    it('should accept a proposal that satisfies the schema', async () => {
      const instance = createInstance({ instanceName: 'v2strictOk', strict: true })
      const { intents } = instance({
        initialState: { term: 0 },
        component: {
          actions: {
            SetTerm: {
              action: term => ({ term }),
              schema: { term: { type: 'number', required: true } }
            }
          },
          acceptors: [
            model => ({ term }) => {
              if (term != null) {
                model.term = term
              }
            }
          ]
        }
      })

      await intents.SetTerm(3)
      expect(instance({}).state('term')).to.equal(3)
    })
  })

  describe('default mode — schema warnings', () => {
    it('should warn but still present the proposal', async () => {
      const instance = createInstance({ instanceName: 'v2warn' })
      let presented = false
      const { intents } = instance({
        initialState: {},
        component: {
          actions: {
            SetNode: {
              action: () => ({}),
              schema: { node: { type: 'string', required: true } }
            }
          },
          acceptors: [
            model => () => {
              presented = true
              model.presentedAt = (model.presentedAt ?? 0) + 1
            }
          ]
        }
      })

      const warn = stubWarn()
      try {
        await intents.SetNode('n1')
      } finally {
        warn.restore()
      }
      expect(presented).to.be.true
      expect(warn.messages.join(' ')).to.include('node')
    })
  })

  describe('never-enabled heuristic', () => {
    it('should warn when an intent repeatedly fires without mutating the model', async () => {
      const instance = createInstance({ instanceName: 'v2noop', strict: true })
      const { intents } = instance({
        initialState: { role: 'follower' },
        component: {
          actions: {
            BecomeLeader: () => ({ role: 'leader' })
          },
          acceptors: [
            // guard never satisfied: silent no-op machine
            model => ({ role }) => {
              if (role != null && model.role === 'candidate') {
                model.role = role
              }
            }
          ]
        }
      })

      const warn = stubWarn()
      try {
        await intents.BecomeLeader()
        await intents.BecomeLeader()
        await intents.BecomeLeader()
      } finally {
        warn.restore()
      }
      const output = warn.messages.join(' ')
      expect(output).to.include('BecomeLeader')
      expect(output).to.include('possibly never enabled')
    })

    it('should not warn when the model is mutated', async () => {
      const instance = createInstance({ instanceName: 'v2mutates', strict: true })
      const { intents } = instance({
        initialState: { count: 0 },
        component: {
          actions: {
            Increment: () => ({ increment: 1 })
          },
          acceptors: [
            model => ({ increment }) => {
              if (increment != null) {
                model.count += increment
              }
            }
          ]
        }
      })

      const warn = stubWarn()
      try {
        await intents.Increment()
        await intents.Increment()
        await intents.Increment()
      } finally {
        warn.restore()
      }
      expect(warn.messages.join(' ')).to.not.include('possibly never enabled')
    })
  })
})
