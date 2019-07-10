import api from './sam-actions'
import {
  E, A, O, and
} from './sam-utils'

export const permutations = (arr, perms, currentDepth, depthMax, noDuplicateAction, doNotStartWith) => {
  const nextLevel = []
  if (perms.length === 0) {
    arr.forEach((i) => {
      if (doNotStartWith.length > 0) {
        const canAdd = doNotStartWith.map(name => i.name !== name).reduce(and, true)
        canAdd && nextLevel.push([i])
      } else {
        nextLevel.push([i])
      }
    })
  } else {
    perms.forEach(p => arr.forEach((i) => {
      const col = p.concat([i])
      if (noDuplicateAction) {
        if (p[p.length - 1] !== i) {
          nextLevel.push(col)
        }
      } else {
        nextLevel.push(col)
      }
    }))
  }
  currentDepth++
  if (currentDepth < depthMax) {
    return permutations(arr, nextLevel, currentDepth, depthMax, noDuplicateAction, doNotStartWith)
  }
  return nextLevel.filter(run => run.length === depthMax)
}

const prepareValuePermutations = (permutation) => {
  const indexMax = permutation.map(intent => A(O(intent).values).length)

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
    throw new Error(['Checker: invalid dataset, one of the intents values has no value.',
      'If an intent has no parameter, add an empty array to its values'].join('\n'))
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


export const checker = ({
  instance, initialState = {}, intents = [], reset, liveness, safety, options
}, success = () => null, err = () => null) => {
  const { beginCheck, endCheck } = api(instance)
  const {
    depthMax = 5, noDuplicateAction = false, doNotStartWith = [], format
  } = options

  const [behaviorIntent, formatIntent] = instance({
    component: {
      actions: [
        __behavior => ({ __behavior }),
        __setFormatBehavior => ({ __setFormatBehavior })
      ],
      acceptors: [
        model => ({ __behavior }) => {
          if (E(__behavior)) {
            model.__behavior = __behavior
          }
        },
        model => ({ __setFormatBehavior }) => {
          if (E(__setFormatBehavior)) {
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
    behaviorIntent,
    format
  )
  endCheck()
  return behavior
}
