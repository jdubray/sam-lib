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

class History {
  constructor(h = [], options = {}) {
    this.currentIndex = 0
    this.history = h
    this.max = options.max
  }

  snap(state, index) {
    const snapshot = clone(state)
    if (index) {
      this.history[index] = snapshot
    } else {
      this.history.push(snapshot)
      if (this.max && this.history.length > this.max) {
        this.history.shift()
      }
    }
    return state
  }

  travel(index = 0) {
    this.currentIndex = index
    return this.history[index]
  }

  next() {
    return this.history[this.currentIndex++]
  }

  hasNext() {
    return E(this.history[this.currentIndex])
  }

  last() {
    this.currentIndex = this.history.length - 1
    return this.history[this.currentIndex]
  }
}

export default History
