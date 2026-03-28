/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const { permutations, apply } = require('../dist/SAM')

/**
 * Minimal intent descriptors used as stand-ins for real SAM intents.
 * @param {string} name
 * @param {Array} values
 * @param {Function} fn
 */
const makeIntent = (name, values, fn = () => {}) => ({ name, values, intent: fn })

describe('checker utilities', () => {
  describe('permutations()', () => {
    const A = makeIntent('A', [[1]])
    const B = makeIntent('B', [[2]])

    it('should return one permutation per intent at depth 1 with no restrictions', () => {
      const result = permutations([A, B], [], 0, 1, false, [])
      expect(result.length).to.equal(2)
      expect(result[0][0]).to.equal(A)
      expect(result[1][0]).to.equal(B)
    })

    it('should generate n² permutations at depth 2 for n intents (no duplicates filter)', () => {
      const result = permutations([A, B], [], 0, 2, false, [])
      // [A,A], [A,B], [B,A], [B,B]
      expect(result.length).to.equal(4)
    })

    it('should generate n³ permutations at depth 3 for n intents', () => {
      const result = permutations([A, B], [], 0, 3, false, [])
      expect(result.length).to.equal(8)
    })

    it('should exclude consecutive duplicate intents when noDuplicateAction is true', () => {
      const result = permutations([A, B], [], 0, 2, true, [])
      // A,A and B,B are excluded
      expect(result.length).to.equal(2)
      result.forEach(perm => expect(perm[0]).to.not.equal(perm[1]))
    })

    it('should exclude starting intents listed in doNotStartWith', () => {
      const result = permutations([A, B], [], 0, 1, false, ['A'])
      expect(result.length).to.equal(1)
      expect(result[0][0]).to.equal(B)
    })

    it('should return empty array when all intents are excluded by doNotStartWith', () => {
      const result = permutations([A, B], [], 0, 1, false, ['A', 'B'])
      expect(result.length).to.equal(0)
    })

    it('should return permutations of correct length (depthMax)', () => {
      const result = permutations([A, B], [], 0, 3, false, [])
      result.forEach(perm => expect(perm.length).to.equal(3))
    })

    it('should produce unique sequence objects (not shared references)', () => {
      const result = permutations([A, B], [], 0, 2, false, [])
      expect(result[0]).to.not.equal(result[1])
    })
  })

  describe('apply()', () => {
    it('should call resetState once per permutation', () => {
      const perms = [[makeIntent('A', [[1]])], [makeIntent('B', [[2]])]]
      let resetCount = 0
      apply(perms, () => { resetCount++ }, () => {})
      expect(resetCount).to.equal(2)
    })

    it('should call setBehavior once per permutation', () => {
      const perms = [[makeIntent('A', [[1]])], [makeIntent('B', [[2]])]]
      let behaviorResets = 0
      apply(perms, () => {}, () => { behaviorResets++ })
      expect(behaviorResets).to.equal(2)
    })

    it('should call the intent with the correct values for each value combination', () => {
      const calls = []
      const intent = makeIntent('A', [[10], [20]], v => calls.push(v))
      apply([[intent]], () => {}, () => {})
      expect(calls).to.deep.equal([10, 20])
    })

    it('should call the intent for every combination of two intents with multiple values', () => {
      const calls = []
      const iA = makeIntent('A', [[1], [2]], v => calls.push(`A:${v}`))
      const iB = makeIntent('B', [[3]], v => calls.push(`B:${v}`))
      // 2 value combinations: (A=1,B=3) and (A=2,B=3)
      apply([[iA, iB]], () => {}, () => {})
      expect(calls).to.include('A:1')
      expect(calls).to.include('A:2')
      expect(calls).to.include('B:3')
    })

    it('should invoke resetState before each intent call within a permutation', () => {
      const order = []
      const intent = makeIntent('A', [[1]], () => order.push('intent'))
      apply([[intent]], () => order.push('reset'), () => order.push('behavior'))
      expect(order[0]).to.equal('reset')
      expect(order[1]).to.equal('behavior')
      expect(order[2]).to.equal('intent')
    })

    it('should do nothing when perms is empty', () => {
      let called = false
      apply([], () => { called = true }, () => {})
      expect(called).to.be.false
    })

    it('should throw when an intent has an empty values array', () => {
      const intent = makeIntent('A', [])
      expect(() => apply([[intent]], () => {}, () => {}))
        .to.throw(/invalid dataset/)
    })
  })
})
