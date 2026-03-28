(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.tp = factory());
})(this, (function () { 'use strict';

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

  /**
   * Modernized SAM Utilities
   * 
   * Note: Many functions have been replaced with native JavaScript features:
   * - O() → optional chaining (?.) and nullish coalescing (??)
   * - A() → optional chaining (?.) and nullish coalescing (??)
   * - S() → optional chaining (?.) and nullish coalescing (??)
   * - F() → nullish coalescing (??)
   * - E() → nullish checks (!= null) for simple cases
   * 
   * The remaining functions provide specialized functionality beyond
   * what native optional chaining offers.
   */

  // Util functions often used in SAM implementations
  const first = (arr = []) => arr[0];
  const or = (acc, current) => acc || current;
  const and = (acc, current) => acc && current;
  const match = (conditions, values) => first(conditions.map((condition, index) => condition ? values[index] : null).filter(e));
  const step = () => ({});
  const doNotRender = model => () => model.continue() === true;
  const wrap = (s, w) => m => s(w(m));
  const log = f => (...args) => {
    console.log(args);
    f(...args);
  };

  /**
   * Standardized error handling for SAM
   * Creates a consistent error object that can be used across the system
   * 
   * @param {Error|string} error - The error to standardize
   * @param {string} [context] - Optional context for the error
   * @param {string} [type='SAM_ERROR'] - Optional error type
   * @returns {Object} Standardized error object
   */
  const standardizeError = (error, context = null, type = 'SAM_ERROR') => {
    if (error instanceof Error) {
      return {
        __error: true,
        message: error.message,
        stack: error.stack,
        type,
        context,
        originalError: error
      };
    }
    return {
      __error: true,
      message: String(error),
      type,
      context
    };
  };

  // Enhanced existence check with support for complex cases
  // This goes beyond simple nullish checks to handle:
  // - Array element existence
  // - String substring checks  
  // - Object key existence with truthy values
  const e = value => Array.isArray(value) ? value.map(e).reduce(and, true) : value !== false && value !== null && value !== undefined;
  const i = (value, element) => {
    switch (typeof value) {
      case 'string':
        return typeof element === 'string' && element !== '' && value.includes(element);
      case 'object':
        return Array.isArray(value) ? value.includes(element) : typeof element === 'string' && e(value[element]);
    }
    return value === element;
  };

  /**
   * Enhanced existence check - checks if value exists and optionally if element exists within value
   * 
   * @param {*} value - The value to check
   * @param {*} [element] - Optional element to check within value
   * @returns {boolean} True if value exists and (element is undefined or element exists within value)
   * 
   * Examples:
   * E(null) → false
   * E(undefined) → false  
   * E(false) → false
   * E('hello') → true
   * E('hello', 'ell') → true
   * E('hello', 'xyz') → false
   * E([1,2,3], 2) → true
   * E({a: 1}, 'a') → true
   * E({a: null}, 'a') → false
   */
  const E = (value, element) => {
    if (!e(value)) return false;
    if (element === undefined) return e(value);
    if (!e(element)) return false;
    return i(value, element);
  };

  /**
   * Chainable conditional executor - executes function if value is truthy
   * 
   * @param {*} value - Value to check
   * @param {Function} f - Function to execute if value is truthy
   * @param {boolean} [guard=true] - Optional guard condition
   * @returns {Object} Chainable object with .on method
   * 
   * Example:
   * on(user.loggedIn, () => console.log('Welcome'))
   *   .on(user.isAdmin, () => console.log('Admin access'))
   */
  const oneOf = (value, f, guard = true) => {
    const triggered = e(value) && guard;
    triggered && f(value);
    return mon(triggered);
  };

  /**
   * Chainable conditional executor - executes function if value is truthy
   * Continues chain regardless of execution
   * 
   * @param {*} value - Value to check
   * @param {Function} f - Function to execute if value is truthy
   * @param {boolean} [guard=true] - Optional guard condition
   * @returns {Object} Chainable object with .on method
   */
  const on = (value, f, guard = true) => {
    const triggered = e(value) && guard;
    triggered && f(value);
    return {
      on
    };
  };
  const mon = (triggered = true) => ({
    oneOf: triggered ? () => mon(false) : oneOf
  });

  // Number utilities - still useful for NaN handling
  const N = (val, value = 0) => Number.isNaN(val) ? value : val;
  const NZ = (val, value = 1) => val === 0 || Number.isNaN(val) ? value === 0 ? 1 : value : val;

  // Legacy functions kept for backward compatibility
  // These have been largely replaced by native optional chaining (?.) and nullish coalescing (??)
  const O = (val, value = {}) => val && typeof val === 'object' ? val : value;
  const A = (val, value = []) => val && Array.isArray(val) ? val : value;
  const S = (val, value = '') => val && typeof val === 'string' ? val : value;
  const F = (f, f0 = () => null) => f || f0;

  const safeDeepClone = obj => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(safeDeepClone);
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, safeDeepClone(v)]));
  };
  const clone = state => {
    const comps = state.__components;
    const {
      __components,
      ...stateWithoutComps
    } = state;
    const cln = safeDeepClone(stateWithoutComps);
    if (comps) {
      cln.__components = {};
      Object.keys(comps).forEach(key => {
        const {
          parent,
          ...compWithoutParent
        } = comps[key];
        cln.__components[key] = Object.assign(clone(compWithoutParent), {
          parent: cln
        });
      });
    }
    return cln;
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
      return state;
    }
    travel(index = 0) {
      this.currentIndex = index;
      return this.history[index];
    }
    next() {
      return this.history[this.currentIndex++];
    }
    hasNext() {
      return this.history[this.currentIndex] != null;
    }
    last() {
      this.currentIndex = this.history.length - 1;
      return this.history[this.currentIndex];
    }
  }

  const handlers = {};
  var events = {
    on: (event, handler) => {
      if (handlers[event] == null) {
        handlers[event] = [];
      }
      handlers[event].push(handler);
    },
    off: (event, handler) => {
      var _handlers$event$filte, _handlers$event;
      handlers[event] = (_handlers$event$filte = (_handlers$event = handlers[event]) === null || _handlers$event === void 0 ? void 0 : _handlers$event.filter(h => h !== handler)) !== null && _handlers$event$filte !== void 0 ? _handlers$event$filte : [];
    },
    emit: (events = [], data) => {
      if (Array.isArray(events)) {
        events.forEach(event => {
          var _handlers$event2;
          return (_handlers$event2 = handlers[event]) === null || _handlers$event2 === void 0 ? void 0 : _handlers$event2.forEach(f => f(data));
        });
      } else {
        var _handlers$events;
        (_handlers$events = handlers[events]) === null || _handlers$events === void 0 || _handlers$events.forEach(f => f(data));
      }
    }
  };

  class Model {
    constructor(name) {
      this.__components = {};
      this.__behavior = [];
      this.__name = name;
      this.__lastProposalTimestamp = 0;
      this.__allowedActions = [];
      this.__disallowedActions = [];
      this.__eventQueue = [];
    }
    localState(name) {
      return this.__components[name] || {};
    }
    hasError() {
      return E(this.__error);
    }
    error() {
      return this.__error || undefined;
    }
    errorMessage() {
      var _this$__error;
      return (_this$__error = this.__error) === null || _this$__error === void 0 ? void 0 : _this$__error.message;
    }
    clearError() {
      return delete this.__error;
    }
    allowedActions() {
      return this.__allowedActions;
    }
    disallowedActions() {
      return this.__disallowedActions;
    }
    clearAllowedActions() {
      this.__allowedActions = [];
    }
    clearDisallowedActions() {
      this.__disallowedActions = [];
    }
    addAllowedActions(a) {
      this.__allowedActions.push(a);
    }
    addDisallowedActions(a) {
      this.__disallowedActions.push(a);
    }
    allow(a) {
      this.__allowedActions = this.__allowedActions.concat(a);
    }
    resetBehavior() {
      this.__behavior = [];
    }
    update(snapshot = {}) {
      Object.assign(this, snapshot);
    }
    setComponentState(component) {
      var _component$localState;
      this.__components[component.name] = Object.assign((_component$localState = component.localState) !== null && _component$localState !== void 0 ? _component$localState : {}, {
        parent: this
      });
      component.localState = component.localState || this.__components[component.name];
    }
    hasNext(val) {
      if (val !== undefined) {
        this.__hasNext = val;
      }
      return this.__hasNext;
    }
    continue() {
      return this.__continue === true;
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
      trace,
      info,
      warning,
      error,
      fatal
    }) {
      if (this.__logger) {
        oneOf(trace, v => this.__logger.trace(v)).oneOf(info, v => this.__logger.info(v)).oneOf(warning, v => this.__logger.warning(v)).oneOf(error, v => this.__logger.error(v)).oneOf(fatal, v => this.__logger.fatal(v));
      }
    }
    prepareEvent(event, data) {
      this.__eventQueue.push([event, data]);
    }
    resetEventQueue() {
      this.__eventQueue = [];
    }
    flush() {
      if (this.continue() === false) {
        var _this$__eventQueue;
        (_this$__eventQueue = this.__eventQueue) === null || _this$__eventQueue === void 0 || _this$__eventQueue.forEach(([event, data]) => events.emit(event, data));
        this.__eventQueue = [];
      }
    }
    clone(state = this) {
      const comps = state.__components;
      const {
        __components,
        ...stateWithoutComps
      } = state;

      // Optimized cloning - avoid JSON.parse(JSON.stringify) for better performance
      const cln = Array.isArray(stateWithoutComps) ? [...stateWithoutComps] : {
        ...stateWithoutComps
      };

      // Deep clone nested objects
      Object.keys(cln).forEach(key => {
        const value = cln[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          cln[key] = this.clone(value);
        } else if (Array.isArray(value)) {
          cln[key] = value.map(item => item && typeof item === 'object' ? this.clone(item) : item);
        }
      });
      if (comps) {
        cln.__components = {};
        Object.keys(comps).forEach(key => {
          const {
            parent,
            ...compWithoutParent
          } = comps[key];
          cln.__components[key] = Object.assign(this.clone(compWithoutParent), {
            parent: cln
          });
        });
      }
      return cln;
    }
    state(name, clone) {
      const prop = n => E(this[n]) ? this[n] : E(this.__components[n]) ? this.__components[n] : this;
      let state;
      if (Array.isArray(name)) {
        state = name.map(n => prop(n));
      } else {
        state = prop(name);
      }
      return clone && state ? this.clone(state) : state;
    }
  }

  // ISC License (ISC)
  // Copyright 2019 Jean-Jacques Dubray


  // This is an implementation of SAM using SAM's own principles
  // - SAM's internal model
  // - SAM's internal acceptors
  // - SAM's present function

  // eslint-disable-next-line arrow-body-style
  const stringify = (s, pretty) => {
    return pretty ? JSON.stringify(s, null, 4) : JSON.stringify(s);
  };
  const display = (json = {}, pretty = false) => {
    const keys = Object.keys(json);
    return "".concat(keys.map(key => {
      if (typeof key !== 'string') {
        return '';
      }
      return key.indexOf('__') === 0 ? '' : stringify(json[key], pretty);
    }).filter(val => val !== '').join(', '));
  };
  const react = r => r();
  const accept = proposal => async a => a(proposal);
  function createInstance (options = {}) {
    var _options$timetravel;
    const {
      max
    } = (_options$timetravel = options.timetravel) !== null && _options$timetravel !== void 0 ? _options$timetravel : {};
    const {
      hasAsyncActions = true,
      instanceName = 'global',
      synchronize = false,
      clone = false,
      requestStateRepresentation
    } = options;
    const {
      synchronizeInterval = 5
    } = synchronize !== null && synchronize !== void 0 ? synchronize : {};

    // SAM's internal model
    let history;
    const model = new Model(instanceName);
    const mount = (arr = [], elements = [], operand = model) => elements.map(el => arr.push(el(operand)));
    let intents;
    const acceptors = [({
      __error
    }) => {
      if (__error) {
        if (__error.name !== 'AssertionError') {
          model.__error = __error;
        } else {
          console.log('--------------------------------------');
          console.log(__error);
        }
      }
    }];
    const reactors = [() => {
      model.hasNext(history ? history.hasNext() : false);
    }];
    const naps = [];

    // ancillary
    let renderView = m => m.flush();
    let _render = m => m.flush();
    let storeRenderView = _render;

    // State Representation
    const state = () => {
      try {
        // Compute state representation
        reactors.forEach(react);

        // render state representation (gated by nap)
        if (!naps.map(react).reduce(or, false)) {
          renderView(clone ? model.clone() : model);
        }
        model.renderNextTime();
      } catch (err) {
        if (err.name !== 'AssertionError') {
          setTimeout(() => present({
            __error: err
          }), 0);
        } else {
          throw err;
        }
      }
    };
    const storeBehavior = proposal => {
      if (proposal.__name != null) {
        const actionName = proposal.__name;
        delete proposal.__name;
        const behavior = model.__formatBehavior ? model.__formatBehavior(actionName, proposal, model) : "".concat(actionName, "(").concat(display(proposal), ") ==> ").concat(display(model));
        model.__behavior.push(behavior);
      }
    };
    const checkForOutOfOrder = proposal => {
      if (proposal.__startTime) {
        if (proposal.__startTime < model.__lastProposalTimestamp) {
          return false;
        }
        model.__lastProposalTimestamp = proposal.__startTime;
      }
      return true;
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
            const [args] = self._queue.slice(0, 1);
            self._queue.shift();
            const [proposal] = args;
            proposal.__rendering = self._rendering;
            await present(...args);
            self._rendering = false;
          }
        }, synchronizeInterval);
        return (...args) => queue.add(args);
      },
      clear() {
        clearInterval(this._interval);
      }
    };
    let present = synchronize ? async (proposal, resolve) => {
      if (checkForOutOfOrder(proposal)) {
        model.resetEventQueue();
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
        model.log({
          error: {
            name: condition.name,
            model
          }
        });
        // rollback if history is present
        if (history) {
          model.update(history.last());
          renderView(model);
        }
        return true;
      }
      return false;
    });
    const isAllowed = action => (!model.__blockUnexpectedActions && model.allowedActions().length === 0 || model.allowedActions().map(a => typeof a === 'string' ? a === action.__actionName : a === action).reduce(or, false)) && !model.disallowedActions().map(a => typeof a === 'string' ? a === action.__actionName : a === action).reduce(or, false);
    const acceptLocalState = component => {
      if (component.name != null) {
        model.setComponentState(component);
      }
    };

    // add one component at a time, returns array of intents from actions
    const addComponent = (component = {}) => {
      var _intents;
      const {
        ignoreOutdatedProposals = false,
        debounce = 0,
        retry
      } = component.options || {};
      if (retry) {
        retry.retryMax = NZ(retry.retryMax);
        retry.retryDelay = N(retry.retryDelay);
      }
      const debounceDelay = debounce;

      // Add component's private state
      acceptLocalState(component);

      // Clean up old intents to prevent memory leaks
      if ((_intents = intents) !== null && _intents !== void 0 && _intents.length) {
        intents.length = 0;
      }

      // Decorate actions to present proposal to the model
      if (hasAsyncActions) {
        var _component$actions;
        intents = (_component$actions = component.actions) === null || _component$actions === void 0 ? void 0 : _component$actions.map(action => {
          let needsDebounce = false;
          let retryCount = 0;
          if (typeof action === 'object') {
            const label = action.label || action[0];
            const smId = E(action) && E(action[2]) ? action[2].id : undefined;
            action = action.action || action[1];
            action.__actionName = label;
            action.__stateMachineId = smId;
          }
          const intent = async (...args) => {
            const startTime = new Date().getTime();
            if (isAllowed(action)) {
              if (debounceDelay > 0 && needsDebounce) {
                var _args$;
                needsDebounce = !((_args$ = args[0]) !== null && _args$ !== void 0 && _args$.__resetDebounce);
                return;
              }
              let proposal = {};
              try {
                proposal = await action(...args);
                proposal.__actionName = action.__actionName;
                proposal.__stateMachineId = action.__stateMachineId;
              } catch (err) {
                if (retry) {
                  retryCount += 1;
                  if (retryCount < retry.retryMax) {
                    setTimeout(() => intent(...args), retry.retryDelay);
                    return;
                  }
                  present({
                    __error: err
                  });
                  retryCount = 0;
                  return;
                }
                if (err.name !== 'AssertionError') {
                  proposal.__error = err;
                } else {
                  throw err;
                }
              }
              if (ignoreOutdatedProposals) {
                proposal.__startTime = startTime;
              }
              try {
                if (isAllowed(action)) {
                  present(proposal);
                  retryCount = 0;
                }
              } catch (err) {
                // uncaught exception in an acceptor
                if (err.name !== 'AssertionError') {
                  present({
                    __error: err
                  });
                } else {
                  throw err;
                }
              }
              if (debounceDelay > 0) {
                needsDebounce = true;
                setTimeout(() => intent({
                  __resetDebounce: true
                }), debounceDelay);
              }
            }
          };
          intent.__actionName = action.__actionName;
          intent.__stateMachineId = action.__stateMachineId;
          return intent;
        });
      } else {
        var _intents2, _component$actions2;
        // Clean up old intents to prevent memory leaks
        if ((_intents2 = intents) !== null && _intents2 !== void 0 && _intents2.length) {
          intents.length = 0;
        }
        intents = (_component$actions2 = component.actions) === null || _component$actions2 === void 0 ? void 0 : _component$actions2.map(action => (...args) => {
          try {
            if (isAllowed(action)) {
              const proposal = action(...args);
              present(proposal);
            } else {
              present({
                __error: "unexpected action ".concat(action.__actionName || '')
              });
            }
          } catch (err) {
            if (err.name !== 'AssertionError') {
              present({
                __error: err
              });
            } else {
              throw err;
            }
          }
        });
      }

      // Add component's acceptors,  reactors, naps and safety condition to SAM instance
      mount(acceptors, component.acceptors, component.localState);
      mount(reactors, component.reactors, component.localState);
      mount(naps, rollback(component.safety), component.localState);
      mount(naps, component.naps, component.localState);
    };
    const setRender = render => {
      const flushEventsAndRender = m => {
        m.flush && m.flush();
        render && render(m);
      };
      renderView = history ? wrap(flushEventsAndRender, s => history ? history.snap(s) : s) : flushEventsAndRender;
      _render = render;
    };
    const setLogger = l => {
      model.setLogger(l);
    };
    const setHistory = h => {
      history = new History(h, {
        max
      });
      model.hasNext(history.hasNext());
      model.resetBehavior();
      renderView = wrap(_render, s => history ? history.snap(s) : s);
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
      renderView(Object.assign({}, model, travelTo));
    };
    const setCheck = ({
      begin = {},
      end
    }) => {
      const {
        render
      } = begin;
      if (E(render)) {
        storeRenderView = renderView;
        renderView = render;
      }
      if (E(end)) {
        renderView = storeRenderView;
      }
    };
    const allowedActions = ({
      actions = [],
      clear = false
    }) => {
      if (clear) {
        model.clearAllowedActions();
      }
      if (actions.length > 0) {
        model.addAllowedActions(actions);
      }
      return model.__allowedActions;
    };
    const addEventHandler = ([event, handler]) => events.on(event, handler);

    // SAM's internal present function
    return ({
      // eslint-disable-next-line no-shadow
      initialState,
      component,
      render,
      history,
      travel,
      logger,
      check,
      allowed,
      clearInterval,
      event
    }) => {
      intents = [];
      on(history, setHistory).on(initialState, addInitialState).on(component, addComponent).on(render, setRender).on(travel, timetravel).on(logger, setLogger).on(check, setCheck).on(allowed, allowedActions).on(clearInterval, () => queue.clear()).on(event, addEventHandler);
      return {
        hasNext: model.hasNext(),
        hasError: model.hasError(),
        errorMessage: model.errorMessage(),
        error: model.error(),
        intents,
        state: name => model.state(name, clone),
        dispose: () => synchronize && queue.clear()
      };
    };
  }

  // ISC License (ISC)
  // Copyright 2019 Jean-Jacques Dubray

  const SAM = createInstance();

  // ISC License (ISC)
  // Copyright 2019 Jean-Jacques Dubray


  // A set of methods to use the SAM pattern
  var api = (SAM$1 = SAM) => ({
    // Core SAM API
    addInitialState: initialState => SAM$1({
      initialState
    }),
    addComponent: component => SAM$1({
      component
    }),
    setRender: render => {
      if (Array.isArray(render)) {
        const [display, representation] = render;
        render = state => display(typeof representation === 'function' ? representation(state) : state);
      }
      SAM$1({
        render: render !== null && render !== void 0 ? render : () => null
      });
    },
    addHandler: (event, handler) => SAM$1({
      event: [event, handler]
    }),
    getIntents: actions => SAM$1({
      component: {
        actions
      }
    }),
    addAcceptors: (acceptors, privateModel) => SAM$1({
      component: {
        acceptors,
        privateModel
      }
    }),
    addReactors: (reactors, privateModel) => SAM$1({
      component: {
        reactors,
        privateModel
      }
    }),
    addNAPs: (naps, privateModel) => SAM$1({
      component: {
        naps,
        privateModel
      }
    }),
    addSafetyConditions: (safety, privateModel) => SAM$1({
      component: {
        safety,
        privateModel
      }
    }),
    hasError: () => SAM$1({}).hasError,
    allow: actions => SAM$1({
      allowed: {
        actions
      }
    }),
    clearAllowedActions: () => SAM$1({
      allowed: {
        clear: true
      }
    }),
    allowedActions: () => SAM$1({
      allowed: {}
    }),
    // Time Travel
    addTimeTraveler: (history = []) => SAM$1({
      history
    }),
    travel: (index = 0) => SAM$1({
      travel: {
        index
      }
    }),
    next: () => SAM$1({
      travel: {
        next: true
      }
    }),
    last: () => SAM$1({
      travel: {
        endOfTime: true
      }
    }),
    hasNext: () => SAM$1({}).hasNext,
    reset: initialState => initialState ? SAM$1({
      initialState
    }) : SAM$1({
      travel: {
        reset: true
      }
    }),
    // Checker
    beginCheck: render => SAM$1({
      check: {
        begin: {
          render
        }
      }
    }),
    endCheck: () => SAM$1({
      check: {
        end: true
      }
    })
  });

  const permutations = (arr, perms, currentDepth, depthMax, noDuplicateAction, doNotStartWith) => {
    if (arr.length === 0 || depthMax <= 0) {
      return [];
    }
    const nextLevel = [];
    if (perms.length === 0) {
      arr.forEach(i => {
        if (doNotStartWith.length === 0 || !doNotStartWith.includes(i.name)) {
          nextLevel.push([i]);
        }
      });
    } else {
      perms.forEach(p => {
        const lastInPerm = p[p.length - 1];
        arr.forEach(i => {
          if (noDuplicateAction && lastInPerm === i) {
            return;
          }
          nextLevel.push(p.concat([i]));
        });
      });
    }
    currentDepth++;
    if (currentDepth < depthMax) {
      return permutations(arr, nextLevel, currentDepth, depthMax, noDuplicateAction, doNotStartWith);
    }
    return nextLevel.filter(run => run.length === depthMax);
  };
  const prepareValuePermutations = permutation => {
    const indexMax = permutation.map(intent => {
      var _intent$values$length, _intent$values;
      return (_intent$values$length = intent === null || intent === void 0 || (_intent$values = intent.values) === null || _intent$values === void 0 ? void 0 : _intent$values.length) !== null && _intent$values$length !== void 0 ? _intent$values$length : 0;
    });
    const modMax = indexMax.map((val, index) => {
      let out = 1;
      for (let j = index; j < indexMax.length; j++) {
        out *= indexMax[j];
      }
      return out;
    });
    const increment = currentIndex => modMax.map((m, index) => {
      if (index === modMax.length - 1) {
        return currentIndex % indexMax[index];
      }
      return Math.floor(currentIndex / modMax[index + 1]) % indexMax[index];
    });
    const kmax = indexMax.reduce((acc, val) => acc * val, 1);
    if (kmax === 0) {
      var _error$originalError;
      const error = standardizeError(['Checker: invalid dataset, one of the intents values has no value.', 'If an intent has no parameter, add an empty array to its values'].join('\n'), 'CHECKER_VALIDATION', 'VALIDATION_ERROR');
      throw (_error$originalError = error.originalError) !== null && _error$originalError !== void 0 ? _error$originalError : new Error(error.message);
    }
    return {
      increment,
      kmax
    };
  };
  const apply = (perms = [], resetState, setBehavior) => {
    perms.forEach(permutation => {
      let k = 0;
      const {
        increment,
        kmax
      } = prepareValuePermutations(permutation);
      do {
        // Process a permutation for all possible values
        const currentValueIndex = increment(k++);
        const currentValues = permutation.map((i, forIntent) => i.values[currentValueIndex[forIntent]]);
        // return to initial state
        resetState();
        setBehavior([]);

        // apply behavior (intent(...values))
        permutation.forEach((i, forIntent) => i.intent(...currentValues[forIntent]));
      } while (k < kmax);
    });
  };
  const checker = ({
    instance,
    initialState = {},
    intents = [],
    reset,
    liveness,
    safety,
    options
  }, success = () => null, err = () => null) => {
    const {
      beginCheck,
      endCheck
    } = api(instance);
    const {
      depthMax = 5,
      noDuplicateAction = false,
      doNotStartWith = [],
      format
    } = options;
    const [behaviorIntent, formatIntent] = instance({
      component: {
        actions: [__behavior => ({
          __behavior
        }), __setFormatBehavior => ({
          __setFormatBehavior
        })],
        acceptors: [model => ({
          __behavior
        }) => {
          if (__behavior != null) {
            model.__behavior = __behavior;
          }
        }, model => ({
          __setFormatBehavior
        }) => {
          if (__setFormatBehavior != null) {
            model.__formatBehavior = __setFormatBehavior;
          }
        }]
      }
    }).intents;
    formatIntent(format);
    const behavior = [];
    beginCheck(state => {
      if (liveness && liveness(state)) {
        // console.log('check check', state)
        behavior.push({
          liveness: state.__behavior
        });
        success(state.__behavior);
      }
      if (safety && safety(state)) {
        behavior.push({
          safety: state.__behavior
        });
        err(state.__behavior);
      }
    });
    apply(permutations(intents, [], 0, depthMax, noDuplicateAction, doNotStartWith), () => reset(initialState), behaviorIntent);
    endCheck();
    return behavior;
  };

  // ISC License (ISC)
  // Copyright 2019 Jean-Jacques Dubray

  const {
    addInitialState,
    addComponent,
    setRender,
    addSafetyConditions,
    getIntents,
    addAcceptors,
    addReactors,
    addNAPs,
    addHandler
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
    addHandler,
    // Utils
    step,
    doNotRender,
    first,
    match,
    on,
    oneOf,
    utils: {
      O,
      A,
      N,
      NZ,
      S,
      F,
      E,
      or,
      and,
      log
    },
    events: {
      on: events.on,
      off: events.off,
      emit: events.emit
    },
    checker,
    permutations,
    apply,
    Model
  };

  return index;

}));
