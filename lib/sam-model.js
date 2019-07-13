import { E, O } from './sam-utils'

class ModelClass {
  constructor(name) {
    this.__components = {}
    this.__behavior = []
    this.__name = name
    this.__lastProposalTimestamp = 0
    this.__allowedActions = []
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

  clearAllowedActions() {
    this.__allowedActions = []
  }

  addAllowedActions(a) {
    this.__allowedActions.push(a)
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
}

export default ModelClass
