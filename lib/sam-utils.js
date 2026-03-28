// ISC License (ISC)
// Copyright 2019 Jean-Jacques Dubray

// Permission to use, copy, modify, and/or distribute this software for any purpose
// with or without fee is hereby granted, provided that the above copyright notice
// and this permission notice appear in all copies.

// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
// REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT,
// OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA
// OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
// ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

/**
 * Modernized SAM Utilities
 * 
 * Note: Many functions have been replaced with native JavaScript features:
 * - O() → optional chaining (?.) and nullish coalescing (??)
 * - A() → optional chaining (?.) and nullish coalescing (??)
 * - S() → optional chaining (?.) and nullish coalescing (??)
 * - F() → nullish coalescing (??)
 * - E() → nullish checks (!= null) for simple cases
 * 
 * The remaining functions provide specialized functionality beyond
 * what native optional chaining offers.
 */

// Util functions often used in SAM implementations
const first = (arr = []) => arr[0]
const or = (acc, current) => acc || current
const and = (acc, current) => acc && current
const match = (conditions, values) => first(conditions.map((condition, index) => (condition ? values[index] : null)).filter(e))
const step = () => ({})
const doNotRender = model => () => model.continue() === true
const wrap = (s, w) => m => s(w(m))
const log = f => (...args) => {
  console.log(args)
  f(...args)
}

/**
 * Memoization utility - caches function results based on arguments
 * 
 * @param {Function} fn - Function to memoize
 * @param {Function} [keyFn] - Optional function to generate cache keys
 * @returns {Function} Memoized function
 */
const memoize = (fn, keyFn = (...args) => JSON.stringify(args)) => {
  const cache = new Map()
  
  return (...args) => {
    const key = keyFn(...args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    
    const result = fn(...args)
    cache.set(key, result)
    return result
  }
}

/**
 * Memoization utility with cache size limit
 * 
 * @param {Function} fn - Function to memoize
 * @param {number} maxSize - Maximum cache size
 * @param {Function} [keyFn] - Optional function to generate cache keys
 * @returns {Function} Memoized function with bounded cache
 */
const memoizeWithLimit = (fn, maxSize, keyFn = (...args) => JSON.stringify(args)) => {
  const cache = new Map()
  let accessOrder = []
  
  return (...args) => {
    const key = keyFn(...args)
    
    if (cache.has(key)) {
      // Move to end of access order (LRU strategy)
      accessOrder = accessOrder.filter(k => k !== key)
      accessOrder.push(key)
      return cache.get(key)
    }
    
    const result = fn(...args)
    cache.set(key, result)
    accessOrder.push(key)
    
    // Enforce size limit
    if (cache.size > maxSize) {
      const oldestKey = accessOrder.shift()
      cache.delete(oldestKey)
    }
    
    return result
  }
}

/**
 * Standardized error handling for SAM
 * Creates a consistent error object that can be used across the system
 * 
 * @param {Error|string} error - The error to standardize
 * @param {string} [context] - Optional context for the error
 * @param {string} [type='SAM_ERROR'] - Optional error type
 * @returns {Object} Standardized error object
 */
const standardizeError = (error, context = null, type = 'SAM_ERROR') => {
  if (error instanceof Error) {
    return {
      __error: true,
      message: error.message,
      stack: error.stack,
      type,
      context,
      originalError: error
    }
  }
  
  return {
    __error: true,
    message: String(error),
    type,
    context
  }
}

// Enhanced existence check with support for complex cases
// This goes beyond simple nullish checks to handle:
// - Array element existence
// - String substring checks  
// - Object key existence with truthy values
const e = value => (Array.isArray(value)
  ? value.map(e).reduce(and, true)
  : value !== false && value !== null && value !== undefined && value !== 0 && value !== '')

const i = (value, element) => {
  switch (typeof value) {
    case 'string': return typeof element === 'string' && element !== '' && value.includes(element)
    case 'object': return Array.isArray(value)
      ? value.includes(element)
      : typeof element === 'string' && e(value[element])
  }
  return value === element
}

/**
 * Enhanced existence check - checks if value exists and optionally if element exists within value
 * 
 * @param {*} value - The value to check
 * @param {*} [element] - Optional element to check within value
 * @returns {boolean} True if value exists and (element is undefined or element exists within value)
 * 
 * Examples:
 * E(null) → false
 * E(undefined) → false  
 * E(false) → false
 * E('hello') → true
 * E('hello', 'ell') → true
 * E('hello', 'xyz') → false
 * E([1,2,3], 2) → true
 * E({a: 1}, 'a') → true
 * E({a: null}, 'a') → false
 */
const E = (value, element) => {
  if (!e(value)) return false
  if (element === undefined) return e(value)
  if (!e(element)) return false
  return i(value, element)
}

/**
 * Chainable conditional executor - executes function if value is truthy
 * 
 * @param {*} value - Value to check
 * @param {Function} f - Function to execute if value is truthy
 * @param {boolean} [guard=true] - Optional guard condition
 * @returns {Object} Chainable object with .on method
 * 
 * Example:
 * on(user.loggedIn, () => console.log('Welcome'))
 *   .on(user.isAdmin, () => console.log('Admin access'))
 */
const oneOf = (value, f, guard = true) => {
  const triggered = e(value) && guard
  triggered && f(value)
  return mon(triggered)
}

/**
 * Chainable conditional executor - executes function if value is truthy
 * Continues chain regardless of execution
 * 
 * @param {*} value - Value to check
 * @param {Function} f - Function to execute if value is truthy
 * @param {boolean} [guard=true] - Optional guard condition
 * @returns {Object} Chainable object with .on method
 */
const on = (value, f, guard = true) => {
  const triggered = e(value) && guard
  triggered && f(value)
  return { on }
}

const mon = (triggered = true) => ({
  oneOf: triggered ? () => mon(false) : oneOf
})

// Number utilities - still useful for NaN handling
const N = (val, value = 0) => Number.isNaN(val) ? value : val
const NZ = (val, value = 1) => (val === 0 || Number.isNaN(val)) ? (value === 0 ? 1 : value) : val

// Legacy functions kept for backward compatibility
// These have been largely replaced by native optional chaining (?.) and nullish coalescing (??)
const O = (val, value = {}) => (val && (typeof val === 'object') ? val : value)
const A = (val, value = []) => (val && Array.isArray(val) ? val : value)
const S = (val, value = '') => (val && (typeof val === 'string') ? val : value)
const F = (f, f0 = () => null) => (f || f0)

export {
  O, A, S, N, NZ, F, E, on, oneOf, or, and, match, step, doNotRender, first, wrap, log, standardizeError, memoize, memoizeWithLimit
}
