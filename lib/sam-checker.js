import api from './sam-actions'
import {
  E, A, O, and, standardizeError
} from './sam-utils'

export const permutations = (arr, perms, currentDepth, depthMax, noDuplicateAction, doNotStartWith) => {
  if (arr.length === 0 || depthMax <= 0) {
    return []
  }

  const nextLevel = []

  if (perms.length === 0) {
    arr.forEach((i) => {
      if (doNotStartWith.length === 0 || !doNotStartWith.includes(i.name)) {
        nextLevel.push([i])
      }
    })
  } else {
    perms.forEach(p => {
      const lastInPerm = p[p.length - 1]
      arr.forEach((i) => {
        if (noDuplicateAction && lastInPerm === i) {
          return
        }
        nextLevel.push(p.concat([i]))
      })
    })
  }

  currentDepth++

  if (currentDepth < depthMax) {
    return permutations(arr, nextLevel, currentDepth, depthMax, noDuplicateAction, doNotStartWith)
  }

  return nextLevel.filter(run => run.length === depthMax)
}

const prepareValuePermutations = (permutation) => {
  const indexMax = permutation.map(intent => intent?.values?.length ?? 0)

  const modMax = indexMax.map((val, index) => {
    let out = 1
    for (let j = index; j < indexMax.length; j++) {
      out *= indexMax[j]
    }
    return out
  })

  const increment = currentIndex => modMax.map(
    (m, index) => {
      if (index === modMax.length - 1) {
        return currentIndex % indexMax[index]
      }
      return Math.floor(currentIndex / modMax[index + 1]) % indexMax[index]
    }
  )

  const kmax = indexMax.reduce((acc, val) => acc * val, 1)
  if (kmax === 0) {
    const error = standardizeError([
      'Checker: invalid dataset, one of the intents values has no value.',
      'If an intent has no parameter, add an empty array to its values'
    ].join('\n'), 'CHECKER_VALIDATION', 'VALIDATION_ERROR')
    throw error.originalError ?? new Error(error.message)
  }

  return { increment, kmax }
}

export const apply = (perms = [], resetState, setBehavior) => {
  perms.forEach((permutation) => {
    let k = 0
    const { increment, kmax } = prepareValuePermutations(permutation)
    do {
      // Process a permutation for all possible values
      const currentValueIndex = increment(k++)
      const currentValues = permutation.map((i, forIntent) => i.values[currentValueIndex[forIntent]])
      // return to initial state
      resetState()
      setBehavior([])

      // apply behavior (intent(...values))
      permutation.forEach((i, forIntent) => i.intent(...currentValues[forIntent]))
    } while (k < kmax)
  })
}


// v2 (#24): derives the checker's intent list from the instance's named
// intents and their declared input domains — no harness-side configuration.
// Domain entries: an array spreads as intent arguments, anything else is the
// single argument; a function domain is a generator evaluated here.
const intentsFromDomains = (instance) => {
  const control = instance({})
  if (typeof control.namedIntents !== 'function') {
    return []
  }
  const named = control.namedIntents()
  return Object.keys(named)
    .map((name) => {
      const intent = named[name]
      const domain = typeof intent.__domain === 'function' ? intent.__domain() : intent.__domain
      return {
        name,
        intent,
        values: (domain ?? []).map(entry => (Array.isArray(entry) ? entry : [entry]))
      }
    })
    .filter(i => i.values.length > 0)
}

export const checker = ({
  instance, initialState = {}, intents = [], reset, liveness, safety, options
}, success = () => null, err = () => null) => {
  const { beginCheck, endCheck } = api(instance)
  const {
    depthMax = 5, noDuplicateAction = false, doNotStartWith = [], format
  } = options

  if (intents.length === 0) {
    intents = intentsFromDomains(instance)
  }

  const [behaviorIntent, formatIntent] = instance({
    component: {
      actions: [
        __behavior => ({ __behavior }),
        __setFormatBehavior => ({ __setFormatBehavior })
      ],
      acceptors: [
        model => ({ __behavior }) => {
          if (__behavior != null) {
            model.__behavior = __behavior
          }
        },
        model => ({ __setFormatBehavior }) => {
          if (__setFormatBehavior != null) {
            model.__formatBehavior = __setFormatBehavior
          }
        }
      ]
    }
  }).intents

  formatIntent(format)

  const behavior = []

  beginCheck((state) => {
    if (liveness && liveness(state)) {
      // console.log('check check', state)
      behavior.push({ liveness: state.__behavior })
      success(state.__behavior)
    }
    if (safety && safety(state)) {
      behavior.push({ safety: state.__behavior })
      err(state.__behavior)
    }
  })
  apply(
    permutations(intents, [], 0, depthMax, noDuplicateAction, doNotStartWith),
    () => reset(initialState),
    behaviorIntent
  )
  endCheck()
  return behavior
}
