import { E, O } from './sam-utils'

const ModelClass = function (name) {
  this.__components = {}
  this.__behavior = []
  this.__name = name
  this.__lastProposalTimestamp = 0
}

ModelClass.prototype.localState = function (name) {
  return E(name) ? this.__components[name] : {}
}

ModelClass.prototype.hasError = function () {
  return E(this.__error)
}

ModelClass.prototype.error = function () {
  return this.__error || undefined
}

ModelClass.prototype.errorMessage = function () {
  return O(this.__error).message
}

ModelClass.prototype.clearError = function () {
  return delete this.__error
}

export default ModelClass
