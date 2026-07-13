// ISC License (ISC)
// Copyright 2026 Jean-Jacques Dubray

// Permission to use, copy, modify, and/or distribute this software for any purpose
// with or without fee is hereby granted, provided that the above copyright notice
// and this permission notice appear in all copies.

// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
// REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT,
// OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA
// OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
// ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

// SAM v2 strict profile (issue #20): named intents with declared payload schemas.
// Turns the dropped-payload wiring bug — a valid, silently no-oping spec in v1 —
// into a throw (strict mode) or a loud warning (default mode) on first fire.

/**
 * Error thrown (strict mode) when a proposal violates its intent's declared
 * payload schema.
 */
export class SamSchemaError extends Error {
  /**
   * @param {string} intentName - name of the intent whose proposal is invalid
   * @param {string[]} violations - human-readable violation descriptions
   */
  constructor(intentName, violations = []) {
    super(`Invalid proposal for intent '${intentName}': ${violations.join('; ')}`)
    this.name = 'SamSchemaError'
    this.intentName = intentName
    this.violations = violations
  }
}

/**
 * Returns the schema-level type of a value: 'array', 'null', or typeof.
 * @param {*} value
 * @returns {string}
 */
const typeOf = (value) => {
  if (Array.isArray(value)) {
    return 'array'
  }
  if (value === null) {
    return 'null'
  }
  return typeof value
}

/**
 * Validates a proposal against a declared payload schema.
 *
 * A schema maps field names to `{ type, required, nullable }`:
 * - `required`: the field must be present (not undefined)
 * - `nullable`: null is an accepted value
 * - `type`: one of 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function'
 *
 * Fields absent from the schema are ignored (the sealed model shape, issue #21,
 * owns that concern).
 *
 * @param {Object} schema - map of field name to field specification
 * @param {Object} proposal - the proposal returned by the action
 * @returns {string[]} violations, empty when the proposal is valid
 */
export const validateProposal = (schema = {}, proposal = {}) => {
  const violations = []
  Object.keys(schema).forEach((field) => {
    const spec = schema[field] ?? {}
    const value = proposal[field]
    if (value === undefined) {
      if (spec.required) {
        violations.push(`missing required field '${field}'`)
      }
      return
    }
    if (value === null) {
      if (!spec.nullable) {
        violations.push(`field '${field}' is null but not declared nullable`)
      }
      return
    }
    if (spec.type && typeOf(value) !== spec.type) {
      violations.push(`field '${field}' expected type '${spec.type}', got '${typeOf(value)}'`)
    }
  })
  return violations
}

/**
 * Validates a proposal against an intent's schema and applies the strict-profile
 * policy: throw in strict mode, warn in default mode.
 *
 * @param {string} intentName
 * @param {Object|undefined} schema - the intent's declared payload schema
 * @param {Object} proposal
 * @param {boolean} strict
 * @throws {SamSchemaError} in strict mode when the proposal is invalid
 */
export const enforceProposalSchema = (intentName, schema, proposal, strict) => {
  if (!schema) {
    return
  }
  const violations = validateProposal(schema, proposal)
  if (violations.length > 0) {
    const error = new SamSchemaError(intentName ?? 'anonymous', violations)
    if (strict) {
      throw error
    }
    console.warn(error.message)
  }
}
