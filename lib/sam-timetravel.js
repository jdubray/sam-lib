import { E } from './sam-utils'

const clone = state => JSON.parse(JSON.stringify(state))

export default (h = []) => (function () {
  let currentIndex = 0
  const history = h

  return {
    snap(state, index) {
      const snapshot = clone(state)
      if (index) {
        history[index] = snapshot
      } else {
        history.push(snapshot)
      }
      return state
    },

    travel(index) {
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
