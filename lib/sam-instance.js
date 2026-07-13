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
  A, O, N, NZ, on, or, wrap, E, standardizeError
} from './sam-utils'
import TimeTraveler from './sam-timetravel'
import Model from './sam-model'
import events from './sam-events'
import {
  enforceProposalSchema, checkShapeWrite, SamShapeError, SamValidationError
} from './sam-strict'

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
  }).filter((val) => val !== '').join(', ')
  }`
}

const react = (r) => r()
const accept = (proposal, stepApi) => async (a) => a(proposal, stepApi)
// synchronous variant so acceptor exceptions (e.g. SamShapeError) propagate to
// the intent instead of becoming unhandled rejections
const acceptSync = (proposal, stepApi) => (a) => a(proposal, stepApi)

// errors the strict profile lets propagate to the intent caller rather than
// converting to an __error proposal
const isStrictError = (err) => err.name === 'SamSchemaError' || err.name === 'SamShapeError'

// v2 (#20): named intents — component.actions may be an object map of
// name -> action | { action, schema, domain }. Normalizes to an array of
// decorated action functions; returns undefined for the v1 array form.
const normalizeNamedActions = (actions) => {
  if (actions == null || Array.isArray(actions) || typeof actions !== 'object') {
    return undefined
  }
  return Object.entries(actions).map(([name, definition]) => {
    const action = typeof definition === 'function' ? definition : definition.action
    if (typeof action !== 'function') {
      throw new Error(`SAM: intent '${name}' must declare an action function`)
    }
    action.__actionName = name
    if (typeof definition !== 'function') {
      action.__schema = definition.schema
      action.__domain = definition.domain
    }
    return action
  })
}

export default function (options = {}) {
  const { max } = options.timetravel ?? {}
  const {
    hasAsyncActions = true,
    instanceName = 'global',
    synchronize = false,
    clone = false,
    requestStateRepresentation,
    strict = false,
    devWarnings = strict,
    neverEnabledThreshold = 3
  } = options
  const { synchronizeInterval = 5 } = synchronize ?? {}

  // SAM's internal model
  let history
  const model = new Model(instanceName)

  // framework-internal Model method access, immune to data keys shadowing
  // prototype methods (issue #29: a model key named 'state', 'clone', ...)
  const invokeModel = (method, ...args) => Model.prototype[method].apply(model, args)
  const safeFlush = (m) => (m instanceof Model
    ? Model.prototype.flush.call(m)
    : (typeof m.flush === 'function' ? m.flush() : undefined))

  // v2 (#21): declared, sealed model shape — SAM's VARIABLES
  let modelShape = null
  const stepMutations = new Set()

  // v2 (#22): per-step enabledness observability
  const stepWrites = new Set()
  const stepRejections = []
  let currentIntentName = null
  let stepListener = null
  const stepApi = {
    /**
     * Records an explicit, observable rejection of the current proposal —
     * distinct from silent fall-through and from the __error slot.
     * @param {string} reason - why the acceptor rejected the proposal
     */
    reject: (reason) => {
      stepRejections.push({ intent: currentIntentName, reason })
    }
  }

  // shallow write tracking cannot see in-place nested mutations
  // (model.nodes[k].field = v); a strict-mode snapshot comparison catches
  // them so they classify as mutated (deep) instead of a false "unhandled"
  let stepBeforeSnapshot
  let stepDeepChange = false

  const beginStep = (proposal) => {
    currentIntentName = proposal.__actionName ?? null
    stepMutations.clear()
    stepWrites.clear()
    stepRejections.length = 0
    stepDeepChange = false
    stepBeforeSnapshot = strict && currentIntentName != null ? display(model) : undefined
  }

  // strict mode hands acceptors/reactors/naps a sealed view of the model:
  // writes to undeclared or ill-typed keys throw SamShapeError; framework
  // internals (__-prefixed) are exempt. Also records per-step mutations.
  const sealedModel = strict ? new Proxy(model, {
    set(target, prop, value) {
      if (typeof prop === 'string' && prop.indexOf('__') !== 0) {
        if (modelShape) {
          const violation = checkShapeWrite(modelShape, prop, value)
          if (violation) {
            throw new SamShapeError(prop, violation)
          }
        }
        stepWrites.add(prop)
        if (target[prop] !== value) {
          stepMutations.add(prop)
        }
      }
      target[prop] = value
      return true
    },
    deleteProperty(target, prop) {
      if (typeof prop === 'string' && prop.indexOf('__') !== 0) {
        stepWrites.add(prop)
        stepMutations.add(prop)
      }
      delete target[prop]
      return true
    }
  }) : model

  const registerModelShape = (shape) => {
    modelShape = Object.assign(modelShape ?? {}, shape)
    // #29: the framework is immune to data keys shadowing Model methods, but
    // user code calling model.<key>() in render/naps would see data — flag it
    if (devWarnings) {
      const collisions = Object.keys(shape).filter((key) => typeof Model.prototype[key] === 'function')
      if (collisions.length > 0) {
        console.warn(`SAM: modelShape key(s) ${collisions.map((k) => `'${k}'`).join(', ')} shadow Model method(s) of the same name; the framework is unaffected, but calling model.${collisions[0]}() in your own render/naps returns the data — use getState() for snapshots`)
      }
    }
    // validate the current observable state against the declared shape
    Object.keys(model)
      .filter((key) => key.indexOf('__') !== 0)
      .forEach((key) => {
        const violation = checkShapeWrite(modelShape, key, model[key])
        if (violation) {
          if (strict) {
            throw new SamShapeError(key, violation)
          }
          console.warn(`SAM: model shape violation: ${violation}`)
        }
      })
  }

  const observableKeys = () => (modelShape
    ? Object.keys(modelShape).filter((key) => !modelShape[key].internal)
    : Object.keys(model).filter((key) => key.indexOf('__') !== 0))

  const getState = () => {
    const snapshot = {}
    observableKeys().forEach((key) => {
      if (model[key] !== undefined) {
        snapshot[key] = model[key] === null ? null : JSON.parse(JSON.stringify(model[key]))
      }
    })
    return snapshot
  }

  const setState = (snapshot = {}) => {
    Object.keys(snapshot).forEach((key) => {
      if (strict && modelShape) {
        const violation = checkShapeWrite(modelShape, key, snapshot[key])
        if (violation) {
          throw new SamShapeError(key, violation)
        }
      }
      model[key] = snapshot[key] === null || snapshot[key] === undefined
        ? snapshot[key]
        : JSON.parse(JSON.stringify(snapshot[key]))
    })
  }

  // v2 (#21/#22): per-step observability — every no-op step is mechanically
  // classifiable as rejected | unhandled | identity-by-mutation
  const lastStep = () => {
    const rejections = stepRejections.slice()
    const mutations = Array.from(stepMutations)
    const writes = Array.from(stepWrites)
    let classification = 'unhandled'
    if (rejections.length > 0) {
      classification = 'rejected'
    } else if (mutations.length > 0 || stepDeepChange) {
      classification = 'mutated'
    } else if (writes.length > 0) {
      classification = 'identity-by-mutation'
    }
    return {
      intent: currentIntentName, mutations, writes, rejections, classification, deep: stepDeepChange
    }
  }

  const endStep = () => {
    if (stepBeforeSnapshot !== undefined && stepMutations.size === 0 && stepRejections.length === 0) {
      stepDeepChange = display(model) !== stepBeforeSnapshot
    }
    const step = lastStep()
    if (devWarnings && strict && step.intent != null && step.classification === 'unhandled') {
      console.warn(`SAM: unhandled proposal — intent '${step.intent}' fired but no acceptor mutated the model or rejected the proposal`)
    }
    stepListener && stepListener(step)
  }

  // v2 (#23/#24): structural registry — external tools (explorer, transpiler,
  // linter) recover intents, schemas, domains, acceptor bindings and the model
  // shape from the instance instead of parsing code or side-channel manifests
  const intentRegistry = {}
  const acceptorRegistry = { keyed: [], broadcast: 0 }
  // named intent functions survive across instance calls so tools (e.g. the
  // checker) can drive the spec without a side-channel intent list
  const registeredIntents = {}

  // v2 (#24): validates that every declared obligation is present — the
  // strict analog of TLC refusing to run without CONSTANTS
  const validate = () => {
    const problems = []
    const names = Object.keys(intentRegistry)
    if (names.length === 0) {
      problems.push('no named intents registered')
    }
    names.forEach((name) => {
      const { schema, domain } = intentRegistry[name]
      if (!schema) {
        problems.push(`intent '${name}' has no payload schema`)
      }
      if (domain == null) {
        problems.push(`intent '${name}' has no input domain`)
      }
    })
    if (!modelShape) {
      problems.push('no modelShape declared')
    }
    if (strict && problems.length > 0) {
      throw new SamValidationError(problems)
    }
    return problems
  }

  const manifest = () => ({
    intents: Object.keys(intentRegistry).reduce((acc, name) => {
      acc[name] = {
        schema: intentRegistry[name].schema,
        domain: intentRegistry[name].domain
      }
      return acc
    }, {}),
    acceptors: {
      keyed: acceptorRegistry.keyed.slice(),
      broadcast: acceptorRegistry.broadcast
    },
    modelShape: modelShape ? ({ ...modelShape }) : null
  })

  const mount = (arr = [], elements = [], operand = sealedModel) => elements.map((el) => arr.push(el(operand)))
  let intents
  const acceptors = [
    ({ __error }) => {
      if (__error) {
        if (__error.name !== 'AssertionError') {
          model.__error = __error
        } else {
          console.log('--------------------------------------')
          console.log(__error)
        }
      }
    }
  ]
  const reactors = [
    () => {
      invokeModel('hasNext', history ? history.hasNext() : false)
    }
  ]
  const naps = []

  // ancillary
  let renderView = (m) => safeFlush(m)
  let _render = (m) => safeFlush(m)
  let storeRenderView = _render

  // State Representation
  const state = () => {
    try {
      // Compute state representation
      reactors.forEach(react)

      // render state representation (gated by nap)
      if (!naps.map(react).reduce(or, false)) {
        renderView(clone ? invokeModel('clone') : model)
      }
      invokeModel('renderNextTime')
    } catch (err) {
      if (err.name === 'AssertionError' || isStrictError(err)) {
        throw err
      }
      setTimeout(() => present({ __error: err }), 0)
    }
  }

  const storeBehavior = (proposal) => {
    if (proposal.__name != null) {
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
      if (proposal.__startTime < model.__lastProposalTimestamp) {
        return false
      }
      model.__lastProposalTimestamp = proposal.__startTime
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
          const [args] = self._queue.slice(0, 1)
          self._queue.shift()
          const [proposal] = args
          proposal.__rendering = self._rendering
          await present(...args)
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
      beginStep(proposal)
      invokeModel('resetEventQueue')
      // accept proposal
      await Promise.all(acceptors.map(accept(proposal, stepApi)))

      storeBehavior(proposal)
      endStep()

      // Continue to state representation
      state()
      resolve && resolve()
    }
  } : (proposal, resolve) => {
    if (checkForOutOfOrder(proposal)) {
      beginStep(proposal)
      // accept proposal (synchronously, so strict-profile errors propagate)
      acceptors.forEach(acceptSync(proposal, stepApi))

      storeBehavior(proposal)
      endStep()

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
    invokeModel('update', initialState)
    if (history) {
      history.snap(model, 0)
    }
    invokeModel('resetBehavior')
  }

  // eslint-disable-next-line no-shadow
  const rollback = (conditions = []) => conditions.map((condition) => (model) => () => {
    const isNotSafe = condition.expression(model)
    if (isNotSafe) {
      invokeModel('log', { error: { name: condition.name, model } })
      // rollback if history is present
      if (history) {
        invokeModel('update', history.last())
        renderView(model)
      }
      return true
    }
    return false
  })

  const isAllowed = (action) => ((!model.__blockUnexpectedActions && invokeModel('allowedActions').length === 0)
                              || invokeModel('allowedActions')
                                .map((a) => (typeof a === 'string'
                                  ? a === action.__actionName
                                  : a === action))
                                .reduce(or, false))
                              && !invokeModel('disallowedActions')
                                .map((a) => (typeof a === 'string'
                                  ? a === action.__actionName
                                  : a === action))
                                .reduce(or, false)

  const acceptLocalState = (component) => {
    if (component.name != null) {
      invokeModel('setComponentState', component)
    }
  }

  // add one component at a time, returns array of intents from actions
  const addComponent = (component = {}) => {
    const { ignoreOutdatedProposals = false, debounce = 0, retry } = component.options || {}

    if (retry) {
      retry.retryMax = NZ(retry.retryMax)
      retry.retryDelay = N(retry.retryDelay)
    }

    const debounceDelay = debounce

    // v2 (#21): declared model shape
    if (component.modelShape) {
      registerModelShape(component.modelShape)
    }

    // Add component's private state
    acceptLocalState(component)

    // Clean up old intents to prevent memory leaks
    if (intents?.length) {
      intents.length = 0
    }

    // v2 (#20): named intent registration (object map) normalizes to an array;
    // undefined means the v1 positional array form
    const namedActions = normalizeNamedActions(component.actions)
    const actionList = namedActions ?? component.actions
    let intentList

    if (namedActions) {
      namedActions.forEach((action) => {
        const { __actionName: name, __schema: schema, __domain: domain } = action
        // v2 (#24): payload-object domain entries are schema-validated at
        // declaration time (argument-style entries are validated on fire)
        if (schema && Array.isArray(domain)) {
          domain.forEach((entry) => {
            if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
              enforceProposalSchema(name, schema, entry, strict)
            }
          })
        }
        intentRegistry[name] = { schema, domain }
      })
    }

    // Decorate actions to present proposal to the model
    if (hasAsyncActions) {
      intentList = actionList?.map((action) => {
        let needsDebounce = false
        let retryCount = 0
        let noopCount = 0
        let warnedNeverEnabled = false

        if (typeof action === 'object') {
          const label = action.label || action[0]
          const smId = E(action) && E(action[2]) ? action[2].id : undefined
          action = action.action || action[1]
          action.__actionName = label
          action.__stateMachineId = smId
        }

        const intent = async (...args) => {
          const startTime = new Date().getTime()

          if (isAllowed(action)) {
            if (debounceDelay > 0 && needsDebounce) {
              needsDebounce = !args[0]?.__resetDebounce
              return
            }

            let proposal = {}
            try {
              proposal = await action(...args)
              proposal.__actionName = action.__actionName
              proposal.__stateMachineId = action.__stateMachineId
            } catch (err) {
              if (retry) {
                retryCount += 1
                if (retryCount < retry.retryMax) {
                  setTimeout(() => intent(...args), retry.retryDelay)
                  return
                }
                present({ __error: err })
                retryCount = 0
                return
              }
              if (err.name !== 'AssertionError') {
                proposal.__error = err
              } else {
                throw err
              }
            }

            // v2 (#20): payload schema enforcement — throws SamSchemaError in
            // strict mode, warns in default mode; error proposals bypass it
            if (!proposal.__error) {
              enforceProposalSchema(action.__actionName, action.__schema, proposal, strict)
            }

            if (ignoreOutdatedProposals) {
              proposal.__startTime = startTime
            }

            // v2 (#20): never-enabled heuristic — snapshot the observable model
            // around present; synchronize mode queues proposals, so skip there
            const watchForNoop = devWarnings && !synchronize && !proposal.__error
            const beforeSnapshot = watchForNoop ? display(model) : undefined

            try {
              if (isAllowed(action)) {
                present(proposal)
                retryCount = 0
              }
            } catch (err) {
              // uncaught exception in an acceptor
              if (err.name === 'AssertionError' || isStrictError(err)) {
                throw err
              }
              present({ __error: err })
            }

            if (watchForNoop) {
              if (stepRejections.length > 0) {
                // an explicit rejection proves the intent is wired and guarded
                noopCount = 0
              } else if (display(model) === beforeSnapshot) {
                noopCount += 1
                if (noopCount >= neverEnabledThreshold && !warnedNeverEnabled) {
                  warnedNeverEnabled = true
                  console.warn(`SAM: intent '${action.__actionName ?? 'anonymous'}' fired ${noopCount} times without mutating the model — possibly never enabled (dropped payload or guard mismatch?)`)
                }
              } else {
                noopCount = 0
              }
            }

            if (debounceDelay > 0) {
              needsDebounce = true
              setTimeout(() => intent({ __resetDebounce: true }), debounceDelay)
            }
          }
        }
        intent.__actionName = action.__actionName
        intent.__stateMachineId = action.__stateMachineId
        intent.__schema = action.__schema
        intent.__domain = action.__domain
        return intent
      })
    } else {
      intentList = actionList?.map((action) => {
        const intent = (...args) => {
          try {
            if (isAllowed(action)) {
              const proposal = action(...args)
              proposal.__actionName = action.__actionName
              enforceProposalSchema(action.__actionName, action.__schema, proposal, strict)
              present(proposal)
            } else {
              present({ __error: `unexpected action ${action.__actionName || ''}` })
            }
          } catch (err) {
            if (err.name === 'AssertionError' || isStrictError(err)) {
              throw err
            }
            present({ __error: err })
          }
        }
        intent.__actionName = action.__actionName
        intent.__stateMachineId = action.__stateMachineId
        intent.__schema = action.__schema
        intent.__domain = action.__domain
        return intent
      })
    }

    // v2 (#20): named form returns intents keyed by name
    intents = namedActions
      ? (intentList ?? []).reduce((acc, intent) => Object.assign(acc, { [intent.__actionName]: intent }), {})
      : intentList

    if (namedActions) {
      Object.assign(registeredIntents, intents)
    }

    // Add component's acceptors,  reactors, naps and safety condition to SAM instance
    if (component.acceptors && !Array.isArray(component.acceptors) && typeof component.acceptors === 'object') {
      // v2 (#23): keyed acceptor registration — the framework binds each
      // acceptor to its action, so acceptor bodies contain only guards and
      // mutations; the switch-dispatch monolith is inexpressible in this form
      Object.keys(component.acceptors).forEach((key) => {
        const acceptorFactory = component.acceptors[key]
        if (key === '*') {
          // explicitly-marked cross-cutting (broadcast) acceptor
          acceptorRegistry.broadcast += 1
          mount(acceptors, [acceptorFactory], component.localState)
          return
        }
        if (strict && intentRegistry[key] === undefined) {
          throw new Error(`SAM: keyed acceptor '${key}' does not match any registered intent (declare the intent first, or use '*' for cross-cutting acceptors)`)
        }
        acceptorRegistry.keyed.push(key)
        mount(acceptors, [(operand) => {
          const acceptor = acceptorFactory(operand)
          return (proposal, api) => (proposal.__actionName === key ? acceptor(proposal, api) : undefined)
        }], component.localState)
      })
    } else {
      acceptorRegistry.broadcast += A(component.acceptors).length
      mount(acceptors, component.acceptors, component.localState)
    }
    mount(reactors, component.reactors, component.localState)
    mount(naps, rollback(component.safety), component.localState)
    mount(naps, component.naps, component.localState)
  }

  const setRender = (render) => {
    const flushEventsAndRender = (m) => {
      safeFlush(m)
      render && render(m)
    }
    renderView = history ? wrap(flushEventsAndRender, (s) => (history ? history.snap(s) : s)) : flushEventsAndRender
    _render = render
  }

  const setLogger = (l) => {
    invokeModel('setLogger', l)
  }

  const setHistory = (h) => {
    history = new TimeTraveler(h, { max })
    invokeModel('hasNext', history.hasNext())
    invokeModel('resetBehavior')
    renderView = wrap(_render, (s) => (history ? history.snap(s) : s))
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
    renderView({ ...model, ...travelTo })
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
    if (clear) {
      invokeModel('clearAllowedActions')
    }
    if (actions.length > 0) {
      invokeModel('addAllowedActions', actions)
    }
    return model.__allowedActions
  }

  const addEventHandler = ([event, handler]) => events.on(event, handler)

  // SAM's internal present function
  return ({
    // eslint-disable-next-line no-shadow
    initialState, component, render, history, travel, logger, check, allowed, clearInterval, event,
    stepListener: stepListenerParam
  }) => {
    intents = []

    on(history, setHistory)
      .on(stepListenerParam, (listener) => { stepListener = listener })
      .on(initialState, addInitialState)
      .on(component, addComponent)
      .on(render, setRender)
      .on(travel, timetravel)
      .on(logger, setLogger)
      .on(check, setCheck)
      .on(allowed, allowedActions)
      .on(clearInterval, () => queue.clear())
      .on(event, addEventHandler)

    return {
      hasNext: invokeModel('hasNext'),
      hasError: invokeModel('hasError'),
      errorMessage: invokeModel('errorMessage'),
      error: invokeModel('error'),
      intents,
      state: (name) => invokeModel('state', name, clone),
      getState,
      setState,
      lastStep,
      manifest,
      validate,
      namedIntents: () => ({ ...registeredIntents }),
      dispose: () => synchronize && queue.clear()
    }
  }
}
