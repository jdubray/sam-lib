/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai')

const {
  O, A, S, N, NZ, F, E, on, oneOf, or, and, match, step, doNotRender
} = require('../lib/sam-utils')

describe('sam-utils', () => {
  describe('O - optional object chaining', () => {
    it('should return the value when it is an object', () => {
      const obj = { foo: 'bar' }
      expect(O(obj)).to.equal(obj)
    })

    it('should return empty object when value is null', () => {
      expect(O(null)).to.deep.equal({})
    })

    it('should return empty object when value is undefined', () => {
      expect(O(undefined)).to.deep.equal({})
    })

    it('should return empty object when value is a number', () => {
      expect(O(42)).to.deep.equal({})
    })

    it('should return empty object when value is a string', () => {
      expect(O('text')).to.deep.equal({})
    })

    it('should return provided default when value is falsy', () => {
      const fallback = { default: true }
      expect(O(null, fallback)).to.equal(fallback)
    })

    it('should support nested property access via returned object', () => {
      expect(O(null).missingProp).to.be.undefined
    })
  })

  describe('A - optional array chaining', () => {
    it('should return the value when it is an array', () => {
      const arr = [1, 2, 3]
      expect(A(arr)).to.equal(arr)
    })

    it('should return empty array when value is null', () => {
      expect(A(null)).to.deep.equal([])
    })

    it('should return empty array when value is undefined', () => {
      expect(A(undefined)).to.deep.equal([])
    })

    it('should return empty array when value is a plain object', () => {
      expect(A({ foo: 'bar' })).to.deep.equal([])
    })

    it('should return provided default array when value is not an array', () => {
      const fallback = [9, 8, 7]
      expect(A(null, fallback)).to.equal(fallback)
    })

    it('should return empty array for a number', () => {
      expect(A(42)).to.deep.equal([])
    })
  })

  describe('S - optional string chaining', () => {
    it('should return the value when it is a non-empty string', () => {
      expect(S('hello')).to.equal('hello')
    })

    it('should return empty string when value is null', () => {
      expect(S(null)).to.equal('')
    })

    it('should return empty string when value is undefined', () => {
      expect(S(undefined)).to.equal('')
    })

    it('should return empty string when value is a number', () => {
      expect(S(42)).to.equal('')
    })

    it('should return provided default when value is not a string', () => {
      expect(S(null, 'default')).to.equal('default')
    })

    it('should return empty string for an empty string input (falsy)', () => {
      expect(S('')).to.equal('')
    })
  })

  describe('N - optional number chaining', () => {
    it('should return the value when it is a positive number', () => {
      expect(N(42)).to.equal(42)
    })

    it('should return zero when value is 0', () => {
      expect(N(0)).to.equal(0)
    })

    it('should return a negative number as-is', () => {
      expect(N(-5)).to.equal(-5)
    })

    it('should return default (0) when value is NaN', () => {
      expect(N(NaN)).to.equal(0)
    })

    it('should return provided default when value is NaN', () => {
      expect(N(NaN, 10)).to.equal(10)
    })
  })

  describe('NZ - non-zero optional number chaining', () => {
    it('should return the value when it is a positive non-zero number', () => {
      expect(NZ(5)).to.equal(5)
    })

    it('should return a negative non-zero number as-is', () => {
      expect(NZ(-3)).to.equal(-3)
    })

    it('should return 1 when value is 0', () => {
      expect(NZ(0)).to.equal(1)
    })

    it('should return 1 when value is NaN', () => {
      expect(NZ(NaN)).to.equal(1)
    })

    it('should return provided default when value is 0', () => {
      expect(NZ(0, 5)).to.equal(5)
    })

    it('should return 1 when value is 0 and default is also 0', () => {
      expect(NZ(0, 0)).to.equal(1)
    })
  })

  describe('F - optional function chaining', () => {
    it('should return the function when it is truthy', () => {
      const fn = () => 42
      expect(F(fn)).to.equal(fn)
    })

    it('should return a no-op function when value is null', () => {
      const fallback = F(null)
      expect(fallback).to.be.a('function')
      expect(fallback()).to.be.null
    })

    it('should return a no-op function when value is undefined', () => {
      const fallback = F(undefined)
      expect(fallback).to.be.a('function')
    })

    it('should return provided default function when value is falsy', () => {
      const defaultFn = () => 99
      expect(F(null, defaultFn)).to.equal(defaultFn)
    })
  })

  describe('E - exists check', () => {
    it('should return true for a positive number', () => {
      expect(E(1)).to.be.true
    })

    it('should return true for a non-empty string', () => {
      expect(E('hello')).to.be.true
    })

    it('should return true for boolean true', () => {
      expect(E(true)).to.be.true
    })

    it('should return true for a plain object', () => {
      expect(E({ a: 1 })).to.be.true
    })

    it('should return true for an empty array', () => {
      expect(E([])).to.be.true
    })

    it('should return false for null', () => {
      expect(E(null)).to.be.false
    })

    it('should return false for undefined', () => {
      expect(E(undefined)).to.be.false
    })

    it('should return false for boolean false', () => {
      expect(E(false)).to.be.false
    })

    it('should check substring existence in a string', () => {
      expect(E('hello world', 'world')).to.be.true
      expect(E('hello world', 'xyz')).to.be.false
    })

    it('should check element existence in an array', () => {
      expect(E([1, 2, 3], 2)).to.be.true
      expect(E([1, 2, 3], 5)).to.be.false
    })

    it('should check truthy key existence in an object', () => {
      expect(E({ foo: 'bar' }, 'foo')).to.be.true
      expect(E({ foo: null }, 'foo')).to.be.false
    })

    it('should check non-existent key in an object', () => {
      expect(E({ foo: 'bar' }, 'missing')).to.be.false
    })

    it('should return false for array containing null (all must be truthy)', () => {
      expect(E([1, null, 3])).to.be.false
    })

    it('should return true for array where all elements are truthy', () => {
      expect(E([1, 2, 3])).to.be.true
    })

    it('should return false when element is null (e(element) is false)', () => {
      expect(E('hello', null)).to.be.false
    })
  })

  describe('or - logical OR reducer', () => {
    it('should return true when any value is true', () => {
      expect([false, false, true].reduce(or, false)).to.be.true
    })

    it('should return false when all values are false', () => {
      expect([false, false, false].reduce(or, false)).to.be.false
    })

    it('should return true immediately with true initial value', () => {
      expect([false].reduce(or, true)).to.be.true
    })
  })

  describe('and - logical AND reducer', () => {
    it('should return true when all values are true', () => {
      expect([true, true, true].reduce(and, true)).to.be.true
    })

    it('should return false when any value is false', () => {
      expect([true, false, true].reduce(and, true)).to.be.false
    })

    it('should return false immediately with false initial value', () => {
      expect([true].reduce(and, false)).to.be.false
    })
  })

  describe('match - conditional pattern matching', () => {
    it('should return the value at the index of the first true condition', () => {
      const result = match([false, true, false], ['a', 'b', 'c'])
      expect(result).to.equal('b')
    })

    it('should return undefined when no condition matches', () => {
      const result = match([false, false], ['a', 'b'])
      expect(result).to.be.undefined
    })

    it('should return the first match when multiple conditions are true', () => {
      const result = match([true, true], ['first', 'second'])
      expect(result).to.equal('first')
    })

    it('should return the last value when only the last condition matches', () => {
      const result = match([false, false, true], ['x', 'y', 'z'])
      expect(result).to.equal('z')
    })
  })

  describe('step - empty object factory', () => {
    it('should return an empty object', () => {
      expect(step()).to.deep.equal({})
    })

    it('should return a new empty object each call', () => {
      const a = step()
      const b = step()
      expect(a).to.not.equal(b)
    })
  })

  describe('doNotRender - NAP factory for skipping render', () => {
    it('should return false when model.continue() is false', () => {
      const model = { continue: () => false }
      const nap = doNotRender(model)
      expect(nap()).to.be.false
    })

    it('should return true when model.continue() is true', () => {
      const model = { continue: () => true }
      const nap = doNotRender(model)
      expect(nap()).to.be.true
    })
  })

  describe('on - chainable conditional executor', () => {
    it('should call the function when value is truthy', () => {
      let called = false
      on(true, () => { called = true })
      expect(called).to.be.true
    })

    it('should not call the function when value is falsy', () => {
      let called = false
      on(false, () => { called = true })
      expect(called).to.be.false
    })

    it('should return an object with an .on method for chaining', () => {
      const result = on(false, () => {})
      expect(result).to.have.property('on')
      expect(result.on).to.be.a('function')
    })

    it('should fire all truthy handlers in a chain independently', () => {
      const results = []
      on(true, () => results.push('first'))
        .on(true, () => results.push('second'))
        .on(false, () => results.push('third'))
      expect(results).to.deep.equal(['first', 'second'])
    })

    it('should pass the value to the handler function', () => {
      let received
      on(42, v => { received = v })
      expect(received).to.equal(42)
    })
  })

  describe('oneOf - exclusive chainable executor', () => {
    it('should call the function when value is truthy', () => {
      let called = false
      oneOf(true, () => { called = true })
      expect(called).to.be.true
    })

    it('should not call the function when value is falsy', () => {
      let called = false
      oneOf(false, () => { called = true })
      expect(called).to.be.false
    })

    it('should not fire subsequent handlers once one has been triggered', () => {
      const results = []
      oneOf(true, () => results.push('first'))
        .oneOf(true, () => results.push('second'))
      expect(results).to.deep.equal(['first'])
    })

    it('should fire the next handler when first is falsy', () => {
      const results = []
      oneOf(false, () => results.push('first'))
        .oneOf(true, () => results.push('second'))
      expect(results).to.deep.equal(['second'])
    })

    it('should skip all when both are falsy', () => {
      const results = []
      oneOf(false, () => results.push('first'))
        .oneOf(false, () => results.push('second'))
      expect(results).to.deep.equal([])
    })
  })
})
