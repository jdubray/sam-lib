(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.tp = factory());
}(this, function () { 'use strict';

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


  // Optional chaining implementation
  const O = (val, value = {}) => (val && (typeof val === 'object') ? val : value);
  const A = (val, value = []) => (val && Array.isArray(val) ? val : value);
  const S = (val, value = '') => (val && (typeof val === 'string') ? val : value);
  const N = (val, value = 0) => (Number.isNaN(val) ? value : val);
  const NZ = (val, value = 1) => (val === 0 || Number.isNaN(val) ? value === 0 ? 1 : value : val);
  const F = (f, f0 = () => null) => (f || f0);

  // Util functions often used in SAM implementations
  const first = (arr = []) => arr[0];
  const or = (acc, current) => acc || current;
  const and = (acc, current) => acc && current;
  const match = (conditions, values) => first(conditions.map((condition, index) => (condition ? values[index] : null)).filter(e));
  const step = () => ({});
  const wrap = (s, w) => m => s(w(m));

  const e = value => (Array.isArray(value)
    ? value.map(e).reduce(and, true)
    : value === true || (value !== null && value !== undefined));

  const i = (value, element) => {
    switch (typeof value) {
      case 'string': return typeof element === 'string' && value.includes(element)
      case 'object': return Array.isArray(value)
        ? value.includes(element)
        : typeof element === 'string' && e(value[element])
    }
    return value === element
  };

  const E = (value, element) => (e(value) && e(element)
    ? i(value, element)
    : e(value));

  const oneOf = (value, f) => {
    e(value) && f(value);
    return mon(e(value))
  };

  const on = (value, f) => {
    e(value) && f(value);
    return { on }
  };

  const mon = (triggered = true) => ({
    oneOf: triggered ? () => mon() : oneOf
  });

  const clone = state => JSON.parse(JSON.stringify(state));

  var timetraveler = (h = []) => (function () {
    let currentIndex = 0;
    const history = h;

    return {
      snap(state, index) {
        const snapshot = clone(state);
        if (index) {
          history[index] = snapshot;
        } else {
          history.push(snapshot);
        }
        return state
      },

      travel(index) {
        currentIndex = index;
        return history[index]
      },

      next() {
        return history[currentIndex++]
      },

      hasNext() {
        return E(history[currentIndex])
      },

      last() {
        currentIndex = history.length - 1;
        return history[currentIndex]
      }
    }
  }());

  // ISC License (ISC)

  // This is an implementation of SAM using SAM's own principles
  // - SAM's internal model
  // - SAM's internal acceptors
  // - SAM's present function

  function createInstance () {
    // SAM's internal model
    let intents;
    let history;
    const acceptors = [];
    const reactors = [model => () => {
      model.__hasNext = history ? history.hasNext() : false;
    }];
    const naps = [];

    // ancillary
    let renderView = () => null;
    let _render = () => null;
    const react = r => r();
    const accept = proposal => a => a(proposal);
    const mount = (arr = [], elements = [], operand = model) => elements.map(el => arr.push(el(operand)));

    // Model
    let model = {
      __components: {},
      localState(name) {
        return E(name) ? this.__components[name] : {}
      }
    };

    // State Representation
    const state = () => {
      // Compute state representation
      reactors.forEach(react);

      // render state representation (gated by nap)
      !naps.map(react).reduce(or, false) && renderView(model);
    };

    const present = (proposal, privateState) => {
      // accept proposal
      acceptors.forEach(accept(proposal));

      // Continue to state representation
      state();
    };

    // SAM's internal acceptors
    const addInitialState = (initialState = {}) => {
      Object.assign(model, initialState);
      if (history) {
        history.snap(model, 0);
      }
    };

    // add one component at a time, returns array of intents from actions
    const addComponent = (component = {}) => {
      // Add component's private state
      if (E(component.name)) {
        model.__components[component.name] = O(component.localState);
      }

      // Decorate actions to present proposal to the model
      intents = A(component.actions).map(action => async (...args) => present(await action(...args)));

      // Add component's acceptors,  reactors and naps to SAM
      mount(acceptors, component.acceptors, component.localState);
      mount(reactors, component.reactors, component.localState);
      mount(naps, component.naps, component.localState);
    };

    const setRender = (render) => {
      renderView = history ? wrap(render, history.snap) : render;
      _render = render;
    };

    const setHistory = (h) => {
      history = timetraveler(h);
      model.__hasNext = history.hasNext();
      renderView = wrap(_render, history.snap);
    };

    const timetravel = (travel = {}) => {
      if (E(history)) {
        if (travel.reset) travel.index = 0;
        if (travel.next) {
          model = history.next();
        } else if (travel.endOfTime) {
          model = history.last();
        } else {
          model = history.travel(travel.index);
        }
      }
      renderView(model);
    };

    // SAM's internal present function
    return ({
      // eslint-disable-next-line no-shadow
      initialState, component, render, history, travel
    }) => {
      intents = [];

      on(initialState, addInitialState)
        .on(component, addComponent)
        .on(render, setRender)
        .on(history, setHistory)
        .on(travel, timetravel);

      return {
        hasNext: model.__hasNext,
        intents
      }
    }
  }

  // ISC License (ISC)

  const SAM = createInstance();

  // ISC License (ISC)

  // A set of methods to use the SAM pattern
  var api = (SAM$1 = SAM) => ({
    addInitialState: initialState => SAM$1({ initialState }),
    addComponent: component => SAM$1({ component }),
    setRender: render => SAM$1({ render }),
    getIntents: actions => SAM$1({ component: { actions } }),
    addAcceptors: (acceptors, privateModel) => SAM$1({ component: { acceptors, privateModel } }),
    addReactors: (reactors, privateModel) => SAM$1({ component: { reactors, privateModel } }),
    addNAPs: (naps, privateModel) => SAM$1({ component: { naps, privateModel } }),
    addTimeTraveler: (history = []) => SAM$1({ history }),
    travel: (index = 0) => SAM$1({ travel: { index } }),
    next: () => SAM$1({ travel: { next: true } }),
    last: () => SAM$1({ travel: { endOfTime: true } }),
    hasNext: () => SAM$1({}).hasNext
  });

  // ISC License (ISC)

  const {
    addInitialState, addComponent, setRender,
    getIntents, addAcceptors, addReactors, addNAPs
  } = api();

  var index = {
    SAM,
    createInstance,
    api,
    addInitialState,
    addComponent,
    addAcceptors,
    addReactors,
    addNAPs,
    getIntents,
    setRender,
    step,
    first,
    match,
    on,
    oneOf,
    utils: {
      O, A, N, NZ, S, F, E, or, and
    }
  };

  return index;

}));
