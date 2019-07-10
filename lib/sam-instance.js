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
  A, O, on, or, wrap, E
} from './sam-utils'
import timetraveler from './sam-timetravel'

// This is an implementation of SAM using SAM's own principles
// - SAM's internal model
// - SAM's internal acceptors
// - SAM's present function

export default function (options = {}) {
  // SAM's internal model
  let intents
  let history
  const acceptors = []
  const reactors = [model => () => {
    model.__hasNext = history ? history.hasNext() : false
  }]
  const naps = []
  let logger
  const { max } = O(options.timetravel)
  const { hasAsyncActions = true, instanceName = 'global' } = options

  // ancillary
  let renderView = () => null
  let _render = () => null
  let storeRenderView = _render
  const react = r => r()
  const accept = proposal => a => a(proposal)
  const mount = (arr = [], elements = [], operand = model) => elements.map(el => arr.push(el(operand)))
  // eslint-disable-next-line arrow-body-style
  const stringify = (s, pretty) => {
    return (pretty ? JSON.stringify(s, null, 4) : JSON.stringify(s))
  }

  // Model
  let model = {
    __components: {},
    __behavior: [],
    __name: instanceName,
    localState(name) {
      return E(name) ? this.__components[name] : {}
    }
  }

  // State Representation
  const state = () => {
    // Compute state representation
    reactors.forEach(react)

    // render state representation (gated by nap)
    if (!naps.map(react).reduce(or, false)) {
      renderView(model)
    }
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

  const present = (proposal, privateState) => {
    // accept proposal
    acceptors.forEach(accept(proposal, privateState))

    storeBehavior(proposal)

    // Continue to state representation
    state()
  }

  // SAM's internal acceptors
  const addInitialState = (initialState = {}) => {
    Object.assign(model, initialState)
    if (history) {
      history.snap(model, 0)
    }
    model.__behavior = []
  }

  // eslint-disable-next-line no-shadow
  const rollback = (conditions = []) => conditions.map(condition => model => () => {
    const isNotSafe = condition.expression(model)
    if (isNotSafe) {
      logger && logger.error({ name: condition.name, model })
      // rollback if history is present
      if (history) {
        model = history.last()
        renderView(model)
      }
      return true
    }
    return false
  })

  // add one component at a time, returns array of intents from actions
  const addComponent = (component = {}) => {
    // Add component's private state
    if (E(component.name)) {
      model.__components[component.name] = Object.assign(O(component.localState), { parent: model })
      component.localState = component.localState || model.__components[component.name]
    }

    // Decorate actions to present proposal to the model
    if (hasAsyncActions) {
      intents = A(component.actions).map(action => async (...args) => {
        const proposal = await action(...args)
        present(proposal)
      })
    } else {
      intents = A(component.actions).map(action => (...args) => {
        const proposal = action(...args)
        present(proposal)
      })
    }

    // Add component's acceptors,  reactors, naps and safety condition to SAM instance
    mount(acceptors, component.acceptors, component.localState)
    mount(reactors, component.reactors, component.localState)
    mount(naps, rollback(component.safety), component.localState)
    mount(naps, component.naps, component.localState)
  }

  const setRender = (render) => {
    renderView = history ? wrap(render, history.snap) : render
    _render = render
  }

  const setLogger = (l) => {
    logger = l
  }

  const setHistory = (h) => {
    history = timetraveler(h, { max })
    model.__hasNext = history.hasNext()
    model.__behavior = []
    renderView = wrap(_render, history.snap)
  }

  const timetravel = (travel = {}) => {
    if (E(history)) {
      if (travel.reset) {
        travel.index = 0
        model.__behavior = []
      }
      if (travel.next) {
        model = history.next()
      } else if (travel.endOfTime) {
        model = history.last()
      } else {
        model = history.travel(travel.index)
      }
    }
    renderView(model)
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

  // SAM's internal present function
  return ({
    // eslint-disable-next-line no-shadow
    initialState, component, render, history, travel, logger, check
  }) => {
    intents = []

    on(history, setHistory)
      .on(initialState, addInitialState)
      .on(component, addComponent)
      .on(render, setRender)
      .on(travel, timetravel)
      .on(logger, setLogger)
      .on(check, setCheck)

    return {
      hasNext: model.__hasNext,
      intents
    }
  }
}
