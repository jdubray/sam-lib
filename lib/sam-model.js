import {
  E, O, oneOf, A
} from './sam-utils'
import events from './sam-events'

// module-level clone so the recursion cannot be shadowed by a model data key
// named `clone` (issue #29)
const cloneState = (state) => {
  const comps = state.__components
  const { __components, ...stateWithoutComps } = state

  // Optimized cloning - avoid JSON.parse(JSON.stringify) for better performance
  const cln = Array.isArray(stateWithoutComps)
    ? [...stateWithoutComps]
    : { ...stateWithoutComps }

  // Deep clone nested objects
  Object.keys(cln).forEach((key) => {
    const value = cln[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      cln[key] = cloneState(value)
    } else if (Array.isArray(value)) {
      cln[key] = value.map((item) => (item && typeof item === 'object' ? cloneState(item) : item))
    }
  })

  if (comps) {
    cln.__components = {}

    Object.keys(comps).forEach((key) => {
      const { parent, ...compWithoutParent } = comps[key]
      cln.__components[key] = Object.assign(cloneState(compWithoutParent), { parent: cln })
    })
  }
  return cln
}

class Model {
  constructor(name) {
    this.__components = {}
    this.__behavior = []
    this.__name = name
    this.__lastProposalTimestamp = 0
    this.__allowedActions = []
    this.__disallowedActions = []
    this.__eventQueue = []
  }

  localState(name) {
    return this.__components[name] || {}
  }

  hasError() {
    return E(this.__error)
  }

  error() {
    return this.__error || undefined
  }

  errorMessage() {
    return this.__error?.message
  }

  clearError() {
    return delete this.__error
  }

  allowedActions() {
    return this.__allowedActions
  }

  disallowedActions() {
    return this.__disallowedActions
  }

  clearAllowedActions() {
    this.__allowedActions = []
  }

  clearDisallowedActions() {
    this.__disallowedActions = []
  }

  addAllowedActions(a) {
    this.__allowedActions.push(a)
  }

  addDisallowedActions(a) {
    this.__disallowedActions.push(a)
  }

  allow(a) {
    this.__allowedActions = this.__allowedActions.concat(a)
  }

  resetBehavior() {
    this.__behavior = []
  }

  update(snapshot = {}) {
    Object.assign(this, snapshot)
  }

  setComponentState(component) {
    this.__components[component.name] = Object.assign(component.localState ?? {}, { parent: this })
    component.localState = component.localState || this.__components[component.name]
  }

  hasNext(val) {
    if (val !== undefined) {
      this.__hasNext = val
    }
    return this.__hasNext
  }

  continue() {
    return this.__continue === true
  }

  renderNextTime() {
    delete this.__continue
  }

  doNotRender() {
    this.__continue = true
  }

  setLogger(logger) {
    this.__logger = logger
  }

  log({
    trace, info, warning, error, fatal
  }) {
    if (this.__logger) {
      oneOf(trace, (v) => this.__logger.trace(v))
        .oneOf(info, (v) => this.__logger.info(v))
        .oneOf(warning, (v) => this.__logger.warning(v))
        .oneOf(error, (v) => this.__logger.error(v))
        .oneOf(fatal, (v) => this.__logger.fatal(v))
    }
  }

  prepareEvent(event, data) {
    this.__eventQueue.push([event, data])
  }

  resetEventQueue() {
    this.__eventQueue = []
  }

  flush() {
    // direct field access: a data key named `continue` must not shadow the check (#29)
    if (this.__continue !== true) {
      this.__eventQueue?.forEach(([event, data]) => events.emit(event, data))
      this.__eventQueue = []
    }
  }

  clone(state = this) {
    return cloneState(state)
  }

  state(name, clone) {
    const prop = (n) => (E(this[n]) ? this[n] : (E(this.__components[n]) ? this.__components[n] : this))
    let state
    if (Array.isArray(name)) {
      state = name.map((n) => prop(n))
    } else {
      state = prop(name)
    }
    return clone && state ? cloneState(state) : state
  }
}

export default Model
