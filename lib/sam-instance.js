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

export default function () {
  // SAM's internal model
  let intents
  let history
  const acceptors = []
  const reactors = [model => () => {
    model.__hasNext = history ? history.hasNext() : false
  }]
  const naps = []

  // ancillary
  let renderView = () => null
  let _render = () => null
  const react = r => r()
  const accept = proposal => a => a(proposal)
  const mount = (arr = [], elements = [], operand = model) => elements.map(el => arr.push(el(operand)))

  // Model
  let model = {
    __components: {},
    localState(name) {
      return E(name) ? this.__components[name] : {}
    }
  }

  // State Representation
  const state = () => {
    // Compute state representation
    reactors.forEach(react)

    // render state representation (gated by nap)
    !naps.map(react).reduce(or, false) && renderView(model)
  }

  const present = (proposal, privateState) => {
    // accept proposal
    acceptors.forEach(accept(proposal, privateState))

    // Continue to state representation
    state()
  }

  // SAM's internal acceptors
  const addInitialState = (initialState = {}) => {
    Object.assign(model, initialState)
    if (history) {
      history.snap(model, 0)
    }
  }

  // add one component at a time, returns array of intents from actions
  const addComponent = (component = {}) => {
    // Add component's private state
    if (E(component.name)) {
      model.__components[component.name] = O(component.localState)
    }

    // Decorate actions to present proposal to the model
    intents = A(component.actions).map(action => async (...args) => present(await action(...args)))

    // Add component's acceptors,  reactors and naps to SAM
    mount(acceptors, component.acceptors, component.localState)
    mount(reactors, component.reactors, component.localState)
    mount(naps, component.naps, component.localState)
  }

  const setRender = (render) => {
    renderView = history ? wrap(render, history.snap) : render
    _render = render
  }

  const setHistory = (h) => {
    history = timetraveler(h)
    model.__hasNext = history.hasNext()
    renderView = wrap(_render, history.snap)
  }

  const timetravel = (travel = {}) => {
    if (E(history)) {
      if (travel.reset) travel.index = 0
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

  // SAM's internal present function
  return ({
    // eslint-disable-next-line no-shadow
    initialState, component, render, history, travel
  }) => {
    intents = []

    on(initialState, addInitialState)
      .on(component, addComponent)
      .on(render, setRender)
      .on(history, setHistory)
      .on(travel, timetravel)

    return {
      hasNext: model.__hasNext,
      intents
    }
  }
}
