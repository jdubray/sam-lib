import { E } from './sam-utils'

const clone = (state) => {
  const comps = state.__components
  delete state.__components
  const cln = JSON.parse(JSON.stringify(state))
  if (comps) {
    cln.__components = [] 
    if (comps.length > 0) {
      comps.forEach((c) => {
        delete c.parent
        cln.__components.push(Object.assign(clone(c), { parent: cln }))
      })
    }
  }
  return cln
}

export default (h = [], options = {}) => (function () {
  let currentIndex = 0
  const history = h
  const { max } = options

  return {
    snap(state, index) {
      const snapshot = clone(state)
      if (index) {
        history[index] = snapshot
      } else {
        history.push(snapshot)
        if (max && history.length > max) {
          history.splice(0, 1)
        }
      }
      return state
    },

    travel(index = 0) {
      currentIndex = index
      return history[index]
    },

    next() {
      return history[currentIndex++]
    },

    hasNext() {
      return E(history[currentIndex])
    },

    last() {
      currentIndex = history.length - 1
      return history[currentIndex]
    }
  }
}())
