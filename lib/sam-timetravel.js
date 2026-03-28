const safeDeepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(safeDeepClone)
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, safeDeepClone(v)])
  )
}

const clone = (state) => {
  const comps = state.__components
  const { __components, ...stateWithoutComps } = state
  const cln = safeDeepClone(stateWithoutComps)
  if (comps) {
    cln.__components = {}
    Object.keys(comps).forEach((key) => {
      const { parent, ...compWithoutParent } = comps[key]
      cln.__components[key] = Object.assign(clone(compWithoutParent), { parent: cln })
    })
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
    return this.history[this.currentIndex] != null
  }

  last() {
    this.currentIndex = this.history.length - 1
    return this.history[this.currentIndex]
  }
}

export default History
