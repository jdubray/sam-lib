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

  const oneOf = (value, f, guard = true) => {
    e(value) && guard && f(value);
    return mon(e(value))
  };

  const on = (value, f, guard = true) => {
    e(value) && guard && f(value);
    return { on }
  };

  const mon = (triggered = true) => ({
    oneOf: triggered ? () => mon() : oneOf
  });

  const clone = (state) => {
    const comps = state.__components;
    delete state.__components;
    const cln = JSON.parse(JSON.stringify(state));
    if (comps) {
      cln.__components = []; 
      if (comps.length > 0) {
        comps.forEach((c) => {
          delete c.parent;
          cln.__components.push(Object.assign(clone(c), { parent: cln }));
        });
      }
    }
    return cln
  };

  var timetraveler = (h = [], options = {}) => (function () {
    let currentIndex = 0;
    const history = h;
    const { max } = options;

    return {
      snap(state, index) {
        const snapshot = clone(state);
        if (index) {
          history[index] = snapshot;
        } else {
          history.push(snapshot);
          if (max && history.length > max) {
            history.splice(0, 1);
          }
        }
        return state
      },

      travel(index = 0) {
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

  function createInstance (options = {}) {
    // SAM's internal model
    let intents;
    let history;
    const acceptors = [];
    const reactors = [model => () => {
      model.__hasNext = history ? history.hasNext() : false;
    }];
    const naps = [];
    let logger;
    const { max } = O(options.timetravel);
    const { hasAsyncActions = true } = options;

    // ancillary
    let renderView = () => null;
    let _render = () => null;
    let storeRenderView = _render;
    const react = r => r();
    const accept = proposal => a => a(proposal);
    const mount = (arr = [], elements = [], operand = model) => elements.map(el => arr.push(el(operand)));
    // eslint-disable-next-line arrow-body-style
    const stringify = (s, pretty) => {
      return (pretty ? JSON.stringify(s, null, 4) : JSON.stringify(s));
    };

    // Model
    let model = {
      __components: {},
      __behavior: [],
      localState(name) {
        return E(name) ? this.__components[name] : {}
      }
    };

    // State Representation
    const state = () => {
      // Compute state representation
      reactors.forEach(react);

      // render state representation (gated by nap)
      if (!naps.map(react).reduce(or, false)) {
        renderView(model);
      }
    };

    const display = (json = {}, pretty) => {
      const keys = Object.keys(json);
      return `{\n${keys.map((key) => {
      if (typeof key !== 'string') {
        return ''
      }
      return key.indexOf('__') === 0 ? '' : stringify(json[key], pretty)
    }).join('\n')
    }\n}\n`
    };


    const storeBehavior = (proposal) => {
      if (E(proposal.__name)) {
        const actionName = proposal._name;
        delete proposal.__name;
        model.__behavior.push(`${actionName}(${display(proposal, true)})\n==> ${display(model, true)}`);
      }
    };

    const present = async (proposal, privateState) => {
      // accept proposal
      const prop = await proposal;
      acceptors.forEach(accept(prop));

      storeBehavior(prop);

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

    // eslint-disable-next-line no-shadow
    const rollback = (conditions = []) => conditions.map(condition => model => () => {
      const isNotSafe = condition.expression(model);
      if (isNotSafe) {
        logger && logger.error({ name: condition.name, model });
        // rollback if history is present
        if (history) {
          model = history.last();
          renderView(model);
        }
        return true
      }
      return false
    });

    // add one component at a time, returns array of intents from actions
    const addComponent = (component = {}) => {
      // Add component's private state
      if (E(component.name)) {
        model.__components[component.name] = Object.assign(O(component.localState), { parent: model });
        component.localState = component.localState || model.__components[component.name];
      }

      // Decorate actions to present proposal to the model
      if (hasAsyncActions) {
        intents = A(component.actions).map(action => (...args) => {
          present(action(...args));
        });
      } else {
        intents = A(component.actions).map(action => (...args) => {
          present(action(...args));
        });
      }

      // Add component's acceptors,  reactors, naps and safety condition to SAM instance
      mount(acceptors, component.acceptors, component.localState);
      mount(reactors, component.reactors, component.localState);
      mount(naps, rollback(component.safety), component.localState);
      mount(naps, component.naps, component.localState);
    };

    const setRender = (render) => {
      renderView = history ? wrap(render, history.snap) : render;
      _render = render;
    };

    const setLogger = (l) => {
      logger = l;
    };

    const setHistory = (h) => {
      history = timetraveler(h, { max });
      model.__hasNext = history.hasNext();
      model.__behavior = [];
      renderView = wrap(_render, history.snap);
    };

    const timetravel = (travel = {}) => {
      if (E(history)) {
        if (travel.reset) {
          travel.index = 0;
          model.__behavior = [];
        }
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

    const setCheck = ({ begin = {}, end }) => {
      const { render } = begin;
      if (E(render)) {
        storeRenderView = renderView;
        renderView = render;
      }

      if (E(end)) {
        renderView = storeRenderView;
      }
    };

    // SAM's internal present function
    return ({
      // eslint-disable-next-line no-shadow
      initialState, component, render, history, travel, logger, check
    }) => {
      intents = [];

      on(history, setHistory)
        .on(initialState, addInitialState)
        .on(component, addComponent)
        .on(render, setRender)
        .on(travel, timetravel)
        .on(logger, setLogger)
        .on(check, setCheck);

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
    // Core SAM API
    addInitialState: initialState => SAM$1({ initialState }),
    addComponent: component => SAM$1({ component }),
    setRender: render => SAM$1({ render }),
    getIntents: actions => SAM$1({ component: { actions } }),
    addAcceptors: (acceptors, privateModel) => SAM$1({ component: { acceptors, privateModel } }),
    addReactors: (reactors, privateModel) => SAM$1({ component: { reactors, privateModel } }),
    addNAPs: (naps, privateModel) => SAM$1({ component: { naps, privateModel } }),
    addSafetyConditions: (safety, privateModel) => SAM$1({ component: { safety, privateModel } }),

    // Time Travel
    addTimeTraveler: (history = []) => SAM$1({ history }),
    travel: (index = 0) => SAM$1({ travel: { index } }),
    next: () => SAM$1({ travel: { next: true } }),
    last: () => SAM$1({ travel: { endOfTime: true } }),
    hasNext: () => SAM$1({}).hasNext,
    reset: () => SAM$1({ travel: { reset: true } }),

    // Checker
    beginCheck: render => SAM$1({ check: { begin: { render } } }),
    endCheck: () => SAM$1({ check: { end: true } })
  });

  const permutations = (arr, perms, currentDepth, depthMax) => {
    const nextLevel = [];
    if (perms.length === 0) {
      arr.forEach(i => nextLevel.push([i]));
    } else {
      perms.forEach(p => arr.forEach((i) => {
        const col = p.concat([i]);
        nextLevel.push(col);
      }));
    }
    currentDepth++;
    if (currentDepth < depthMax) {
      return permutations(arr, nextLevel, currentDepth, depthMax)
    }
    return nextLevel
  };

  const apply = (perms = [], reset) => {
    perms.forEach((p) => {
      let currentIndeces = [];
      const indexMax = p.map(intent => A(O(intent).values).length);
      const modMax = indexMax.map((val, index) => {
        let out = 1;
        for (let j = index; j < indexMax.length; j++) {
          out *= indexMax[j];
        }
        return out
      });
      const increment = currentIndex => modMax.map(
        (m, index) => {
          if (index === modMax.length - 1) {
            return currentIndex % indexMax[index]
          }
          return Math.floor(currentIndex / modMax[index + 1]) % indexMax[index]
        }
      );
      for (let i = 0; i < p.length; i++) {
        currentIndeces.push(0);
      }
      let k = 0;
      const kmax = indexMax.reduce((acc, val) => acc * val, 1);
      if (kmax === 0) {
        throw new Error(['Checker: invalid dataset, one of the intents values has no value.',
          'If an intent has no parameter, add an empty array to its values'].join('\n'))
      }
      do {
        // eslint-disable-next-line no-loop-func
        const vector = p.map((i, index) => i.values[currentIndeces[index]]);
        // return to initial state
        reset();
        // apply behavior (intent(...values))
        p.forEach((i, index) => {
          const intentArgs = vector[index];
          return i.intent(...intentArgs)
        });
        k++;
        currentIndeces = increment(k);
      } while (k < kmax)
    });
  };


  const checker = ({
    instance = SAM, intents = [], liveness, safety, depthMax = 5
  }) => {
    const { beginCheck, endCheck } = api(instance);
    return new Promise((resolve, reject) => {
      beginCheck((state) => {
        liveness && liveness(state) && resolve(state);
        safety && safety(state) && reject(state);
      });
      apply(
        permutations(intents, [], 0, depthMax),
        () => instance({ travel: { reset: true } })
      );
      endCheck();
      reject(new Error('could not find liveness or safety conditions'));
    })
  };


  // [a,b,c]
  //  a
  //  a      b          c
  //  a b c  a b c      a b c
  // aaa, aab, aac, aba, abb, abc, aca, acb, acc
  // [[0,1], [0,1,2], [0,1,2,3]
  // a(0) b(0) c(0)
  // a(1) a(0) a(0)
  // a(1) a(1) a(0)
  // a(1) a(1) a(1)


  // [[0,1], [0,1,2], [0,1,2,3]]
  // 3 x 2 x 4 = 24

  // for (k = 0; k < max[0]; k++) {
  //    for(i = 0; i < max[1]; i++) {
  //      for(j = 0; j<max[2] ) {
  //         reset()
  //         arg = [vals[k], vals[i], vals[j]]
  //         p.forEach(i,index => i.intent(...args[index]))
  //      }
  //    }
  // }

  // int o = k+1 * i+1 * j+1
  // 12 = % kmax * imax -> 6
  // 4 = 0, 1, 0
  // 8 = 0, 2 = o / max[col+1] % max[col], 0 = o % max[col]
  // 12 = 1 = o / max[col+1] * max[col+2] % max[col], 0 = o / 4 % 3, 0 = o % max[col]

  // ISC License (ISC)

  const {
    addInitialState, addComponent, setRender, addSafetyConditions,
    getIntents, addAcceptors, addReactors, addNAPs
  } = api();

  var index = {
    // Constructors
    SAM,
    createInstance,
    api,

    // SAM Core
    addInitialState,
    addComponent,
    addAcceptors,
    addReactors,
    addNAPs,
    addSafetyConditions,
    getIntents,
    setRender,

    // Utils
    step,
    first,
    match,
    on,
    oneOf,
    utils: {
      O, A, N, NZ, S, F, E, or, and
    },
    checker
  };

  return index;

}));
