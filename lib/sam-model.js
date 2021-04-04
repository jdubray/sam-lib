import {
  E, O, oneOf, A
} from './sam-utils'
import events from './sam-events'

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
    return E(name) ? this.__components[name] : {}
  }

  hasError() {
    return E(this.__error)
  }

  error() {
    return this.__error || undefined
  }

  errorMessage() {
    return O(this.__error).message
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
    this.__components[component.name] = Object.assign(O(component.localState), { parent: this })
    component.localState = component.localState || this.__components[component.name]
  }

  hasNext(val) {
    if (E(val)) {
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
    if (this.logger) {
      oneOf(trace, this.logger.trace(trace))
        .oneOf(info, this.logger.info(info))
        .oneOf(warning, this.logger.waring(warning))
        .oneOf(error, this.logger.error(warning))
        .oneOf(fatal, this.logger.fatal(warning))
    }
  }

  prepareEvent(event, data) {
    this.__eventQueue.push([event, data])
  }

  resetEventQueue() {
    this.__eventQueue = []
  }

  flush() {
    if (this.continue() === false) {
      A(this.__eventQueue).forEach(([event, data]) => events.emit(event, data))
      this.__eventQueue = []
    }
  }

  clone(state = this) {
    const comps = state.__components
    delete state.__components
    const cln = JSON.parse(JSON.stringify(state))
    if (comps) {
      cln.__components = {}

      Object.keys(comps).forEach((key) => {
        const c = comps[key]
        delete c.parent
        cln.__components[key] = Object.assign(this.clone(c), { parent: cln })
      })
    }
    return cln
  }

  state(name, clone) {
    const prop = n => (E(this[n]) ? this[n] : (E(this.__components[n]) ? this.__components[n] : this))
    let state
    if (Array.isArray(name)) {
      state = name.map(n => prop(n))
    } else {
      state = prop(name)
    }
    return clone && state ? this.clone(state) : state
  }
}

export default Model
