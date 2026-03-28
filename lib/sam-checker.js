import api from './sam-actions'
import {
  E, A, O, and, standardizeError
} from './sam-utils'

// Cache for memoization
const permutationCache = new Map()

const getCacheKey = (arr, perms, currentDepth, depthMax, noDuplicateAction, doNotStartWith) => {
  return JSON.stringify({ 
    arrLength: arr.length, 
    permsLength: perms.length, 
    currentDepth, 
    depthMax, 
    noDuplicateAction, 
    doNotStartWith: doNotStartWith.join(',')
  })
}

export const permutations = (arr, perms, currentDepth, depthMax, noDuplicateAction, doNotStartWith) => {
  // Early termination for common cases
  if (arr.length === 0 || depthMax <= 0) {
    return []
  }
  
  // Check cache first
  const cacheKey = getCacheKey(arr, perms, currentDepth, depthMax, noDuplicateAction, doNotStartWith)
  if (permutationCache.has(cacheKey)) {
    return permutationCache.get(cacheKey)
  }
  
  const nextLevel = []
  
  // Optimized first level handling
  if (perms.length === 0) {
    if (doNotStartWith.length > 0) {
      // Use filter for better performance with large arrays
      nextLevel.push(...arr.filter(i => !doNotStartWith.includes(i.name)).map(i => [i]))
    } else {
      // Simple case - just map to arrays
      nextLevel.push(...arr.map(i => [i]))
    }
    
    // Early termination if we've reached max depth
    if (currentDepth + 1 >= depthMax) {
      const result = nextLevel.filter(run => run.length === depthMax)
      permutationCache.set(cacheKey, result)
      return result
    }
  } else {
    // Optimized permutation building
    perms.forEach(p => {
      const lastInPerm = p[p.length - 1]
      arr.forEach((i) => {
        if (noDuplicateAction && lastInPerm === i) {
          return // Skip duplicates
        }
        nextLevel.push(p.concat([i]))
      })
    })
  }
  
  currentDepth++
  
  // Recursive call with memoization
  if (currentDepth < depthMax) {
    const result = permutations(arr, nextLevel, currentDepth, depthMax, noDuplicateAction, doNotStartWith)
    permutationCache.set(cacheKey, result)
    return result
  }
  
  const result = nextLevel.filter(run => run.length === depthMax)
  permutationCache.set(cacheKey, result)
  return result
}

// Add method to clear cache (useful for testing)
export const clearPermutationCache = () => {
  permutationCache.clear()
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
