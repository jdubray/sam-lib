/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { default: createInstance } = require('../../lib/sam-instance')
const { checker } = require('../../lib/sam-checker')
const { SamValidationError, SamSchemaError } = require('../../lib/sam-strict')

/**
 * Builds a fully-declared strict counter instance (shape, schemas, domains).
 * hasAsyncActions is off so the checker can explore synchronously.
 * @param {string} name - instance name
 * @returns {function} the SAM instance
 */
const fullyDeclaredCounter = (name) => {
  const instance = createInstance({ strict: true, hasAsyncActions: false, instanceName: name })
  instance({
    initialState: { count: 0 },
    component: {
      modelShape: { count: { type: 'number' } },
      actions: {
        Increment: {
          action: by => ({ by }),
          schema: { by: { type: 'number', required: true } },
          domain: [1, 2]
        },
        Reset: {
          action: () => ({ reset: true }),
          schema: { reset: { type: 'boolean' } },
          domain: [[]]
        }
      },
      acceptors: {
        Increment: model => ({ by }) => {
          model.count += by
        },
        Reset: model => () => {
          model.count = 0
        }
      }
    }
  })
  return instance
}

describe('v2 — per-intent input-domain manifest (#24)', () => {
  describe('validate()', () => {
    it('should pass a fully-declared strict spec', () => {
      const instance = fullyDeclaredCounter('v2validateOk')
      expect(instance({}).validate()).to.deep.equal([])
    })

    it('should throw SamValidationError in strict mode when intents lack domains or schemas', () => {
      const instance = createInstance({ strict: true, instanceName: 'v2validateMissing' })
      instance({
        initialState: { count: 0 },
        component: {
          modelShape: { count: { type: 'number' } },
          actions: { Increment: () => ({ increment: 1 }) }, // no schema, no domain
          acceptors: {
            Increment: model => ({ increment }) => {
              model.count += increment
            }
          }
        }
      })
      try {
        instance({}).validate()
        expect.fail('expected SamValidationError')
      } catch (err) {
        expect(err).to.be.instanceOf(SamValidationError)
        expect(err.problems.join(' ')).to.include('schema')
        expect(err.problems.join(' ')).to.include('domain')
        expect(err.problems.join(' ')).to.include('Increment')
      }
    })

    it('should report a missing modelShape', () => {
      const instance = createInstance({ instanceName: 'v2validateNoShape' })
      instance({
        initialState: { count: 0 },
        component: {
          actions: {
            Increment: {
              action: by => ({ by }),
              schema: { by: { type: 'number', required: true } },
              domain: [1]
            }
          },
          acceptors: [model => ({ by }) => { if (by != null) { model.count += by } }]
        }
      })
      // default mode: returns problems instead of throwing
      const problems = instance({}).validate()
      expect(problems.join(' ')).to.include('modelShape')
    })
  })

  describe('declaration-time domain validation', () => {
    it('should reject payload-object domain entries that violate the schema', () => {
      const instance = createInstance({ strict: true, instanceName: 'v2domainBad' })
      expect(() => instance({
        initialState: { node: '' },
        component: {
          modelShape: { node: { type: 'string' } },
          actions: {
            SetNode: {
              action: payload => payload,
              schema: { node: { type: 'string', required: true } },
              domain: [{ node: 42 }] // type violation, caught at declaration
            }
          },
          acceptors: [model => ({ node }) => { if (node != null) { model.node = node } }]
        }
      })).to.throw(SamSchemaError, /node/)
    })
  })

  describe('checker consumes domains from the instance', () => {
    it('should explore a strict spec with zero harness-side intent configuration', () => {
      const instance = fullyDeclaredCounter('v2checkerDomains')
      const found = []
      checker({
        instance,
        initialState: { count: 0 },
        reset: init => instance({}).setState(init),
        liveness: state => state.count === 3,
        options: { depthMax: 2 }
      }, behavior => found.push(behavior))

      // count === 3 is reachable in two steps (1+2 or 2+1)
      expect(found.length).to.be.greaterThan(0)
    })

    it('should detect safety violations through declared domains', () => {
      const instance = fullyDeclaredCounter('v2checkerSafety')
      const bad = []
      checker({
        instance,
        initialState: { count: 0 },
        reset: init => instance({}).setState(init),
        safety: state => state.count > 3,
        options: { depthMax: 2 }
      }, () => null, behavior => bad.push(behavior))

      // 2+2 = 4 > 3 is reachable
      expect(bad.length).to.be.greaterThan(0)
    })

    it('should accept a generator function as a domain', () => {
      const instance = createInstance({ strict: true, hasAsyncActions: false, instanceName: 'v2domainGen' })
      instance({
        initialState: { count: 0 },
        component: {
          modelShape: { count: { type: 'number' } },
          actions: {
            Increment: {
              action: by => ({ by }),
              schema: { by: { type: 'number', required: true } },
              domain: () => [3]
            }
          },
          acceptors: {
            Increment: model => ({ by }) => {
              model.count += by
            }
          }
        }
      })

      const found = []
      checker({
        instance,
        initialState: { count: 0 },
        reset: init => instance({}).setState(init),
        liveness: state => state.count === 6,
        options: { depthMax: 2 }
      }, behavior => found.push(behavior))

      expect(found.length).to.be.greaterThan(0)
    })
  })
})
