import SAM from './SAM'
import api from './sam-actions'
import { A, O, and } from './sam-utils'

export const permutations = (arr, perms, currentDepth, depthMax) => {
  if (perms.length === 0) {
    arr.forEach(i => perms.push([i]))
  } else {
    const nextLevel = []
    perms.forEach(p => arr.forEach(i => nextLevel.push(p.push(i))))
    currentDepth++
    if (currentDepth < depthMax) {
      return permutations(arr, nextLevel, currentDepth, depthMax)
    }
    return nextLevel
  }
}

export const apply = (perms = [], reset) => {
  perms.forEach((p) => {
    let currentIndeces = []
    const indexMax = p.map(intent => A(O(intent).values).length)
    const modMax = indexMax.map((val, index) => {
      let out = val
      for (let j = index; j < indexMax; j++) {
        out *= indexMax[j]
      }
      return out
    })
    const increment = currentIndex => modMax.map((m, index) => Math.floor(currentIndex / m) % indexMax[index])
    for (let i = 0; i < p.length; i++) {
      currentIndeces.push(0)
    }
    let k = 0
    const kmax = indexMax.reduce((acc, val) => acc * val, 1)
    do {
      // eslint-disable-next-line no-loop-func
      const vector = p.map((i, index) => i.values[currentIndeces[index]])
      // return to initial state
      reset()
      // apply behavior (intent(...values))
      p.forEach((i, index) => i.intent(...vector[index]))
      k++
      currentIndeces = increment(k, indexMax, modMax)
    } while (k < kmax)
  })
}


export const checker = ({
  instance = SAM, intents = [], liveness, safety, depthMax = 5
}) => {
  const { beginCheck, endCheck } = api(instance)
  return new Promise((resolve, reject) => {
    beginCheck((state) => {
      liveness && liveness(state) && resolve(state)
      safety && safety(state) && reject(state)
    })
    apply(
      permutations(intents, [], 0, depthMax),
      () => instance({ timetravel: { reset: true } })
    )
    endCheck()
  })
}


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