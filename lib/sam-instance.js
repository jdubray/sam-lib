// ISC License (ISC)
// Copyright 2019 Jean-Jacques Dubray

// Permission to use, copy, modify, and/or distribute this software for any purpose
// with or without fee is hereby granted, provided that the above copyright notice
// and this permission notice appear in all copies.

// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
// REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT,
// OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA
// OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
// ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

import {
  A, O, N, NZ, on, or, wrap, E
} from './sam-utils'
import TimeTraveler from './sam-timetravel'
import Model from './sam-model'

// This is an implementation of SAM using SAM's own principles
// - SAM's internal model
// - SAM's internal acceptors
// - SAM's present function

// eslint-disable-next-line arrow-body-style
const stringify = (s, pretty) => {
  return (pretty ? JSON.stringify(s, null, 4) : JSON.stringify(s))
}

const display = (json = {}, pretty = false) => {
  const keys = Object.keys(json)
  return `${keys.map((key) => {
    if (typeof key !== 'string') {
      return ''
    }
    return key.indexOf('__') === 0 ? '' : stringify(json[key], pretty)
  }).filter(val => val !== '').join(', ')
  }`
}

const react = r => r()
const accept = proposal => async a => a(proposal)


export default function (options = {}) {
  const { max } = O(options.timetravel)
  const { hasAsyncActions = true, instanceName = 'global', synchronize = false } = options
  const { synchronizeInterval = 5 } = O(synchronize)

  // SAM's internal model
  let history
  const model = new Model(instanceName)
  const mount = (arr = [], elements = [], operand = model) => elements.map(el => arr.push(el(operand)))
  let intents
  const acceptors = [
    ({ __error }) => {
      if (__error) {
        model.__error = __error
      }
    }
  ]
  const reactors = [
    () => {
      model.hasNext(history ? history.hasNext() : false)
    }
  ]
  const naps = []

  // ancillary
  let renderView = () => null
  let _render = () => null
  let storeRenderView = _render

  // State Representation
  const state = () => {
    try {
      // Compute state representation
      reactors.forEach(react)

      // render state representation (gated by nap)
      if (!naps.map(react).reduce(or, false)) {
        renderView(model)
      }
      model.renderNextTime()
    } catch (err) {
      setTimeout(() => present({ __error: err }), 0)
    }
  }

  const storeBehavior = (proposal) => {
    if (E(proposal.__name)) {
      const actionName = proposal.__name
      delete proposal.__name
      const behavior = model.__formatBehavior
        ? model.__formatBehavior(actionName, proposal, model)
        : `${actionName}(${display(proposal)}) ==> ${display(model)}`
      model.__behavior.push(behavior)
    }
  }

  const checkForOutOfOrder = (proposal) => {
    if (proposal.__startTime) {
      if (proposal.__startTime <= model.__lastProposalTimestamp) {
        return false
      }
      proposal.__startTime = model.__lastProposalTimestamp
    }
    return true
  }

  const queue = {
    _queue: [],
    _rendering: false,
    add(args) {
      this._queue.push(args)
    },

    synchronize(present) {
      const self = this
      this._interval = setInterval(async () => {
        if (!self._rendering && self._queue.length > 0) {
          self._rendering = true
          const [proposal] = self._queue.slice(0, 1)
          self._queue.shift()
          proposal.__rendering = self._rendering
          await present(...proposal)
          self._rendering = false
        }
      }, synchronizeInterval)

      return (...args) => queue.add(args)
    },

    clear() {
      clearInterval(this._interval)
    }
  }

  let present = synchronize ? async (proposal, resolve) => {
    if (checkForOutOfOrder(proposal)) {
      // accept proposal
      await Promise.all(acceptors.map(await accept(proposal)))

      storeBehavior(proposal)

      // Continue to state representation
      state()
      resolve && resolve()
    }
  } : (proposal, resolve) => {
    if (checkForOutOfOrder(proposal)) {
      // accept proposal
      acceptors.forEach(accept(proposal))

      storeBehavior(proposal)

      // Continue to state representation
      state()
      resolve && resolve()
    }
  }

  if (synchronize) {
    present = queue.synchronize(present)
  }

  // SAM's internal acceptors
  const addInitialState = (initialState = {}) => {
    model.update(initialState)
    if (history) {
      history.snap(model, 0)
    }
    model.resetBehavior()
  }

  // eslint-disable-next-line no-shadow
  const rollback = (conditions = []) => conditions.map(condition => model => () => {
    const isNotSafe = condition.expression(model)
    if (isNotSafe) {
      model.log({ error: { name: condition.name, model } })
      // rollback if history is present
      if (history) {
        model.update(history.last())
        renderView(model)
      }
      return true
    }
    return false
  })

  const isAllowed = action => model.allowedActions().length === 0
                           || model.allowedActions().map(a => a === action).reduce(or, false)
  const acceptLocalState = (component) => {
    if (E(component.name)) {
      model.setComponentState(component)
    }
  }

  // add one component at a time, returns array of intents from actions
  const addComponent = (component = {}) => {
    const { ignoreOutdatedProposals = false, debounce = 0, retry } = component.options || {}

    if (retry) {
      retry.max = NZ(retry.max)
      retry.delay = N(retry.delay)
    }

    const debounceDelay = debounce

    // Add component's private state
    acceptLocalState(component)

    // Decorate actions to present proposal to the model
    if (hasAsyncActions) {
      intents = A(component.actions).map((action) => {
        let needsDebounce = false
        let retryCount = 0

        const intent = async (...args) => {
          const startTime = new Date().getTime()

          if (isAllowed(action)) {
            if (debounceDelay > 0 && needsDebounce) {
              needsDebounce = !O(args[0]).__resetDebounce
              return
            }

            let proposal = {}
            try {
              proposal = await action(...args)
            } catch (err) {
              if (retry) {
                retryCount += 1
                if (retryCount < retry.max) {
                  setTimeout(() => intent(...args), retry.delay)
                }
                return
              }
              proposal.__error = err
            }

            if (ignoreOutdatedProposals) {
              proposal.__startTime = startTime
            }

            try {
              present(proposal)
              retryCount = 0
            } catch (err) {
              // uncaught exception in an acceptor
              present({ __error: err })
            }

            if (debounceDelay > 0) {
              needsDebounce = true
              setTimeout(() => intent({ __resetDebounce: true }), debounceDelay)
            }
          }
        }
        return intent
      })
    } else {
      intents = A(component.actions).map(action => (...args) => {
        try {
          const proposal = action(...args)
          present(proposal)
        } catch (err) {
          present({ __error: err })
        }
      })
    }

    // Add component's acceptors,  reactors, naps and safety condition to SAM instance
    mount(acceptors, component.acceptors, component.localState)
    mount(reactors, component.reactors, component.localState)
    mount(naps, rollback(component.safety), component.localState)
    mount(naps, component.naps, component.localState)
  }

  const setRender = (render) => {
    renderView = history ? wrap(render, s => (history ? history.snap(s) : s)) : render
    _render = render
  }

  const setLogger = (l) => {
    model.setLogger(l)
  }

  const setHistory = (h) => {
    history = new TimeTraveler(h, { max })
    model.hasNext(history.hasNext())
    model.resetBehavior()
    renderView = wrap(_render, s => (history ? history.snap(s) : s))
  }

  const timetravel = (travel = {}) => {
    let travelTo = {}
    if (E(history)) {
      if (travel.reset) {
        travel.index = 0
        model.__behavior = []
      }
      if (travel.next) {
        travelTo = history.next()
      } else if (travel.endOfTime) {
        travelTo = history.last()
      } else {
        travelTo = history.travel(travel.index)
      }
    }
    renderView(Object.assign(model, travelTo))
  }

  const setCheck = ({ begin = {}, end }) => {
    const { render } = begin
    if (E(render)) {
      storeRenderView = renderView
      renderView = render
    }

    if (E(end)) {
      renderView = storeRenderView
    }
  }

  const allowedActions = ({ actions = [], clear = false }) => {
    if (actions.length > 0) {
      model.addAllowedActions(actions)
    } else if (clear) {
      model.clearAllowedActions()
    }
    return model.allowedActions()
  }

  // SAM's internal present function
  return ({
    // eslint-disable-next-line no-shadow
    initialState, component, render, history, travel, logger, check, allowed, clearInterval
  }) => {
    intents = []

    on(history, setHistory)
      .on(initialState, addInitialState)
      .on(component, addComponent)
      .on(render, setRender)
      .on(travel, timetravel)
      .on(logger, setLogger)
      .on(check, setCheck)
      .on(allowed, allowedActions)
      .on(clearInterval, () => queue.clear())

    return {
      hasNext: model.hasNext(),
      hasError: model.hasError(),
      errorMessage: model.errorMessage(),
      error: model.error(),
      intents
    }
  }
}
