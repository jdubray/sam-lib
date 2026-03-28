const handlers = {}

export default {
  on: (event, handler) => {
    if (handlers[event] == null) {
      handlers[event] = []
    }
    handlers[event].push(handler)
  },

  off: (event, handler) => {
    handlers[event] = handlers[event]?.filter(h => h !== handler) ?? []
  },

  emit: (events = [], data) => {
    if (Array.isArray(events)) {
      events.forEach(event => handlers[event]?.forEach(f => f(data)))
    } else {
      handlers[events]?.forEach(f => f(data))
    }
  }
}
