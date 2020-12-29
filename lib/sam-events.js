import { E, A } from './sam-utils'

const handlers = {}

export default {
  on: (event, handler) => {
    if (!E(handlers[event])) {
      handlers[event] = []
    }
    handlers[event].push(handler)
  },

  off: (event, handler) => {
    A(handlers[event]).forEach((h, i) => {
      if (h === handler) {
        handlers[event].splice(i, 1)
      }
    })
  },

  emit: (events = [], data) => {
    if (Array.isArray(events)) {
      events.forEach(event => A(handlers[event]).forEach(f => f(data)))
    } else {
      A(handlers[events]).forEach(f => f(data))
    }
  }
}
