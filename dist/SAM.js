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
  const doNotRender = model => () => model.continue() === true;
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

  class History {
    constructor(h = [], options = {}) {
      this.currentIndex = 0;
      this.history = h;
      this.max = options.max;
    }

    snap(state, index) {
      const snapshot = clone(state);
      if (index) {
        this.history[index] = snapshot;
      } else {
        this.history.push(snapshot);
        if (this.max && this.history.length > this.max) {
          this.history.shift();
        }
      }
      return state
    }

    travel(index = 0) {
      this.currentIndex = index;
      return this.history[index]
    }

    next() {
      return this.history[this.currentIndex++]
    }

    hasNext() {
      return E(this.history[this.currentIndex])
    }

    last() {
      this.currentIndex = this.history.length - 1;
      return this.history[this.currentIndex]
    }
  }

  class Model {
    constructor(name) {
      this.__components = {};
      this.__behavior = [];
      this.__name = name;
      this.__lastProposalTimestamp = 0;
      this.__allowedActions = [];
    }

    localState(name) {
      return E(name) ? this.__components[name] : {}
    }

    hasError() {
      return E(this.__error)
    }

    error() {
      return this.__error || undefined
    }

    errorMessage() {
      return O(this.__error).message
    }

    clearError() {
      return delete this.__error
    }

    allowedActions() {
      return this.__allowedActions
    }

    clearAllowedActions() {
      this.__allowedActions = [];
    }

    addAllowedActions(a) {
      this.__allowedActions.push(a);
    }

    resetBehavior() {
      this.__behavior = [];
    }

    update(snapshot = {}) {
      Object.assign(this, snapshot);
    }

    setComponentState(component) {
      this.__components[component.name] = Object.assign(O(component.localState), { parent: this });
      component.localState = component.localState || this.__components[component.name];
    }

    hasNext(val) {
      if (E(val)) {
        this.__hasNext = val;
      }
      return this.__hasNext
    }

    continue() {
      return this.__continue === true
    }

    renderNextTime() {
      delete this.__continue;
    }

    doNotRender() {
      this.__continue = true;
    }

    setLogger(logger) {
      this.__logger = logger;
    }

    log({
      trace, info, warning, error, fatal
    }) {
      if (this.logger) {
        oneOf(trace, this.logger.trace(trace))
          .oneOf(info, this.logger.info(info))
          .oneOf(warning, this.logger.waring(warning))
          .oneOf(error, this.logger.error(warning))
          .oneOf(fatal, this.logger.fatal(warning));
      }
    }
  }

  // ISC License (ISC)

  // This is an implementation of SAM using SAM's own principles
  // - SAM's internal model
  // - SAM's internal acceptors
  // - SAM's present function

  // eslint-disable-next-line arrow-body-style
  const stringify = (s, pretty) => {
    return (pretty ? JSON.stringify(s, null, 4) : JSON.stringify(s))
  };

  const display = (json = {}, pretty = false) => {
    const keys = Object.keys(json);
    return `${keys.map((key) => {
    if (typeof key !== 'string') {
      return ''
    }
    return key.indexOf('__') === 0 ? '' : stringify(json[key], pretty)
  }).filter(val => val !== '').join(', ')
  }`
  };

  const react = r => r();
  const accept = proposal => async a => a(proposal);


  function createInstance (options = {}) {
    const { max } = O(options.timetravel);
    const { hasAsyncActions = true, instanceName = 'global', synchronize = false } = options;
    const { synchronizeInterval = 5 } = O(synchronize);

    // SAM's internal model
    let history;
    const model = new Model(instanceName);
    const mount = (arr = [], elements = [], operand = model) => elements.map(el => arr.push(el(operand)));
    let intents;
    const acceptors = [
      ({ __error }) => {
        if (__error) {
          model.__error = __error;
        }
      }
    ];
    const reactors = [
      () => {
        model.hasNext(history ? history.hasNext() : false);
      }
    ];
    const naps = [];

    // ancillary
    let renderView = () => null;
    let _render = () => null;
    let storeRenderView = _render;

    // State Representation
    const state = () => {
      try {
        // Compute state representation
        reactors.forEach(react);

        // render state representation (gated by nap)
        if (!naps.map(react).reduce(or, false)) {
          renderView(model);
        }
        model.renderNextTime();
      } catch (err) {
        setTimeout(() => present({ __error: err }), 0);
      }
    };

    const storeBehavior = (proposal) => {
      if (E(proposal.__name)) {
        const actionName = proposal.__name;
        delete proposal.__name;
        const behavior = model.__formatBehavior
          ? model.__formatBehavior(actionName, proposal, model)
          : `${actionName}(${display(proposal)}) ==> ${display(model)}`;
        model.__behavior.push(behavior);
      }
    };

    const checkForOutOfOrder = (proposal) => {
      if (proposal.__startTime) {
        if (proposal.__startTime <= model.__lastProposalTimestamp) {
          return false
        }
        proposal.__startTime = model.__lastProposalTimestamp;
      }
      return true
    };

    const queue = {
      _queue: [],
      _rendering: false,
      add(args) {
        this._queue.push(args);
      },

      synchronize(present) {
        const self = this;
        this._interval = setInterval(async () => {
          if (!self._rendering && self._queue.length > 0) {
            self._rendering = true;
            const [proposal] = self._queue.slice(0, 1);
            self._queue.shift();
            proposal.__rendering = self._rendering;
            await present(...proposal);
            self._rendering = false;
          }
        }, synchronizeInterval);

        return (...args) => queue.add(args)
      },

      clear() {
        clearInterval(this._interval);
      }
    };

    let present = synchronize ? async (proposal, resolve) => {
      if (checkForOutOfOrder(proposal)) {
        // accept proposal
        await Promise.all(acceptors.map(await accept(proposal)));

        storeBehavior(proposal);

        // Continue to state representation
        state();
        resolve && resolve();
      }
    } : (proposal, resolve) => {
      if (checkForOutOfOrder(proposal)) {
        // accept proposal
        acceptors.forEach(accept(proposal));

        storeBehavior(proposal);

        // Continue to state representation
        state();
        resolve && resolve();
      }
    };

    if (synchronize) {
      present = queue.synchronize(present);
    }

    // SAM's internal acceptors
    const addInitialState = (initialState = {}) => {
      model.update(initialState);
      if (history) {
        history.snap(model, 0);
      }
      model.resetBehavior();
    };

    // eslint-disable-next-line no-shadow
    const rollback = (conditions = []) => conditions.map(condition => model => () => {
      const isNotSafe = condition.expression(model);
      if (isNotSafe) {
        model.log({ error: { name: condition.name, model } });
        // rollback if history is present
        if (history) {
          model.update(history.last());
          renderView(model);
        }
        return true
      }
      return false
    });

    const isAllowed = action => model.allowedActions().length === 0
                             || model.allowedActions().map(a => a === action).reduce(or, false);
    const acceptLocalState = (component) => {
      if (E(component.name)) {
        model.setComponentState(component);
      }
    };

    // add one component at a time, returns array of intents from actions
    const addComponent = (component = {}) => {
      const { ignoreOutdatedProposals = false, debounce = 0, retry } = component.options || {};

      if (retry) {
        retry.max = NZ(retry.max);
        retry.delay = N(retry.delay);
      }

      const debounceDelay = debounce;

      // Add component's private state
      acceptLocalState(component);

      // Decorate actions to present proposal to the model
      if (hasAsyncActions) {
        intents = A(component.actions).map((action) => {
          let needsDebounce = false;
          let retryCount = 0;

          const intent = async (...args) => {
            const startTime = new Date().getTime();

            if (isAllowed(action)) {
              if (debounceDelay > 0 && needsDebounce) {
                needsDebounce = !O(args[0]).__resetDebounce;
                return
              }

              let proposal = {};
              try {
                proposal = await action(...args);
              } catch (err) {
                if (retry) {
                  retryCount += 1;
                  if (retryCount < retry.max) {
                    setTimeout(() => intent(...args), retry.delay);
                  }
                  return
                }
                proposal.__error = err;
              }

              if (ignoreOutdatedProposals) {
                proposal.__startTime = startTime;
              }

              try {
                present(proposal);
                retryCount = 0;
              } catch (err) {
                // uncaught exception in an acceptor
                present({ __error: err });
              }

              if (debounceDelay > 0) {
                needsDebounce = true;
                setTimeout(() => intent({ __resetDebounce: true }), debounceDelay);
              }
            }
          };
          return intent
        });
      } else {
        intents = A(component.actions).map(action => (...args) => {
          try {
            const proposal = action(...args);
            present(proposal);
          } catch (err) {
            present({ __error: err });
          }
        });
      }

      // Add component's acceptors,  reactors, naps and safety condition to SAM instance
      mount(acceptors, component.acceptors, component.localState);
      mount(reactors, component.reactors, component.localState);
      mount(naps, rollback(component.safety), component.localState);
      mount(naps, component.naps, component.localState);
    };

    const setRender = (render) => {
      renderView = history ? wrap(render, s => (history ? history.snap(s) : s)) : render;
      _render = render;
    };

    const setLogger = (l) => {
      model.setLogger(l);
    };

    const setHistory = (h) => {
      history = new History(h, { max });
      model.hasNext(history.hasNext());
      model.resetBehavior();
      renderView = wrap(_render, s => (history ? history.snap(s) : s));
    };

    const timetravel = (travel = {}) => {
      let travelTo = {};
      if (E(history)) {
        if (travel.reset) {
          travel.index = 0;
          model.__behavior = [];
        }
        if (travel.next) {
          travelTo = history.next();
        } else if (travel.endOfTime) {
          travelTo = history.last();
        } else {
          travelTo = history.travel(travel.index);
        }
      }
      renderView(Object.assign(model, travelTo));
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

    const allowedActions = ({ actions = [], clear = false }) => {
      if (actions.length > 0) {
        model.addAllowedActions(actions);
      } else if (clear) {
        model.clearAllowedActions();
      }
      return model.allowedActions()
    };

    // SAM's internal present function
    return ({
      // eslint-disable-next-line no-shadow
      initialState, component, render, history, travel, logger, check, allowed, clearInterval
    }) => {
      intents = [];

      on(history, setHistory)
        .on(initialState, addInitialState)
        .on(component, addComponent)
        .on(render, setRender)
        .on(travel, timetravel)
        .on(logger, setLogger)
        .on(check, setCheck)
        .on(allowed, allowedActions)
        .on(clearInterval, () => queue.clear());

      return {
        hasNext: model.hasNext(),
        hasError: model.hasError(),
        errorMessage: model.errorMessage(),
        error: model.error(),
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
    setRender: (render) => {
      if (Array.isArray(render)) {
        const [display, representation] = render;
        render = state => display(typeof representation === 'function' ? representation(state) : state);
      }
      SAM$1({ render });
    },
    getIntents: actions => SAM$1({ component: { actions } }),
    addAcceptors: (acceptors, privateModel) => SAM$1({ component: { acceptors, privateModel } }),
    addReactors: (reactors, privateModel) => SAM$1({ component: { reactors, privateModel } }),
    addNAPs: (naps, privateModel) => SAM$1({ component: { naps, privateModel } }),
    addSafetyConditions: (safety, privateModel) => SAM$1({ component: { safety, privateModel } }),
    hasError: () => SAM$1({}).hasError,
    allow: actions => SAM$1({ allowed: { actions } }),
    clearAllowedActions: () => SAM$1({ allowed: { clear: true } }),
    allowedActions: () => SAM$1({ allowed: {} }),

    // Time Travel
    addTimeTraveler: (history = []) => SAM$1({ history }),
    travel: (index = 0) => SAM$1({ travel: { index } }),
    next: () => SAM$1({ travel: { next: true } }),
    last: () => SAM$1({ travel: { endOfTime: true } }),
    hasNext: () => SAM$1({}).hasNext,
    reset: initialState => (initialState ? SAM$1({ initialState }) : SAM$1({ travel: { reset: true } })),

    // Checker
    beginCheck: render => SAM$1({ check: { begin: { render } } }),
    endCheck: () => SAM$1({ check: { end: true } })
  });

  const permutations = (arr, perms, currentDepth, depthMax, noDuplicateAction, doNotStartWith) => {
    const nextLevel = [];
    if (perms.length === 0) {
      arr.forEach((i) => {
        if (doNotStartWith.length > 0) {
          const canAdd = doNotStartWith.map(name => i.name !== name).reduce(and, true);
          canAdd && nextLevel.push([i]);
        } else {
          nextLevel.push([i]);
        }
      });
    } else {
      perms.forEach(p => arr.forEach((i) => {
        const col = p.concat([i]);
        if (noDuplicateAction) {
          if (p[p.length - 1] !== i) {
            nextLevel.push(col);
          }
        } else {
          nextLevel.push(col);
        }
      }));
    }
    currentDepth++;
    if (currentDepth < depthMax) {
      return permutations(arr, nextLevel, currentDepth, depthMax, noDuplicateAction, doNotStartWith)
    }
    return nextLevel.filter(run => run.length === depthMax)
  };

  const prepareValuePermutations = (permutation) => {
    const indexMax = permutation.map(intent => A(O(intent).values).length);

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

    const kmax = indexMax.reduce((acc, val) => acc * val, 1);
    if (kmax === 0) {
      throw new Error(['Checker: invalid dataset, one of the intents values has no value.',
        'If an intent has no parameter, add an empty array to its values'].join('\n'))
    }

    return { increment, kmax }
  };

  const apply = (perms = [], resetState, setBehavior) => {
    perms.forEach((permutation) => {
      let k = 0;
      const { increment, kmax } = prepareValuePermutations(permutation);
      do {
        // Process a permutation for all possible values
        const currentValueIndex = increment(k++);
        const currentValues = permutation.map((i, forIntent) => i.values[currentValueIndex[forIntent]]);
        // return to initial state
        resetState();
        setBehavior([]);

        // apply behavior (intent(...values))
        permutation.forEach((i, forIntent) => i.intent(...currentValues[forIntent]));
      } while (k < kmax)
    });
  };


  const checker = ({
    instance, initialState = {}, intents = [], reset, liveness, safety, options
  }, success = () => null, err = () => null) => {
    const { beginCheck, endCheck } = api(instance);
    const {
      depthMax = 5, noDuplicateAction = false, doNotStartWith = [], format
    } = options;

    const [behaviorIntent, formatIntent] = instance({
      component: {
        actions: [
          __behavior => ({ __behavior }),
          __setFormatBehavior => ({ __setFormatBehavior })
        ],
        acceptors: [
          model => ({ __behavior }) => {
            if (E(__behavior)) {
              model.__behavior = __behavior;
            }
          },
          model => ({ __setFormatBehavior }) => {
            if (E(__setFormatBehavior)) {
              model.__formatBehavior = __setFormatBehavior;
            }
          }
        ]
      }
    }).intents;

    formatIntent(format);

    const behavior = [];

    beginCheck((state) => {
      if (liveness && liveness(state)) {
        // console.log('check check', state)
        behavior.push({ liveness: state.__behavior });
        success(state.__behavior);
      }
      if (safety && safety(state)) {
        behavior.push({ safety: state.__behavior });
        err(state.__behavior);
      }
    });
    apply(
      permutations(intents, [], 0, depthMax, noDuplicateAction, doNotStartWith),
      () => reset(initialState),
      behaviorIntent);
    endCheck();
    return behavior
  };

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
    doNotRender,
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
