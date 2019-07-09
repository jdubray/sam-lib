// import SAM from './SAM'
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

export const apply = (perms = [], reset, behaviorIntent) => {
  let behavior
  perms.forEach((p) => {
    let currentIndeces = []
    const indexMax = p.map(intent => A(O(intent).values).length)
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
    for (let i = 0; i < p.length; i++) {
      currentIndeces.push(0)
    }
    let k = 0
    const kmax = indexMax.reduce((acc, val) => acc * val, 1)
    if (kmax === 0) {
      throw new Error(['Checker: invalid dataset, one of the intents values has no value.',
        'If an intent has no parameter, add an empty array to its values'].join('\n'))
    }
    do {
      // eslint-disable-next-line no-loop-func
      const vector = p.map((i, index) => i.values[currentIndeces[index]])
      // return to initial state
      reset()
      behaviorIntent([])

      // apply behavior (intent(...values))
      // eslint-disable-next-line no-loop-func
      p.forEach((i, index) => {
        const intentArgs = vector[index]
        i.intent(...intentArgs)
      })
      k++
      currentIndeces = increment(k, indexMax, modMax)
    } while (k < kmax)
  })
  return behavior
}


export const checker = ({
  instance, initialState = {}, intents = [], reset, liveness, safety, options
}, success = () => null, err = () => null) => {
  const { beginCheck, endCheck } = api(instance)
  const { depthMax = 5, noDuplicateAction = false, doNotStartWith = [] } = options

  const behaviorIntent = instance({
    component: {
      actions: [
        __behavior => ({ __behavior })
      ],
      acceptors: [
        model => ({ __behavior }) => {
          if (E(__behavior)) {
            model.__behavior = __behavior
          }
        }
      ]
    }
  }).intents[0]

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
