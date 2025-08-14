import { solveLinearSystem } from '../numerics/linearSolver.js'

export function solveTPSMA(foodSources, params = {}) {
  const n = foodSources.length
  const epsilon = params.epsilon || 0.1
  const dt = params.dt || 0.01
  const delta = params.delta || 0.001
  const maxIter = params.maxIter || 1000
  const kSeeds = params.kSeeds || 3

  const D = Array(n).fill().map(() => Array(n).fill(1.0))
  const L = Array(n).fill().map(() => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        L[i][j] = distance(foodSources[i], foodSources[j])
      }
    }
  }

  let bestTour = null
  let bestLength = Infinity

  for (let seed = 0; seed < kSeeds; seed++) {
    resetD(D, seed)
    
    for (let iter = 0; iter < maxIter; iter++) {
      const P = solvePressure(D, L)
      const Q = computeFlow(D, P, L)
      
      let maxDelta = 0
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i !== j) {
            const flow = Math.abs(Q[i][j])
            const newD = D[i][j] + ((flow / (1 + flow)) - D[i][j]) * dt
            maxDelta = Math.max(maxDelta, Math.abs(newD - D[i][j]))
            D[i][j] = newD
          }
        }
      }
      
      if (maxDelta < delta) break
    }
    
    const tour = constructTour(D, L, epsilon)
    const tourLength = calculateLength(tour)
    
    if (tourLength < bestLength) {
      bestLength = tourLength
      bestTour = tour
    }
  }

  return bestTour
}

function solvePressure(D, L) {
  const n = D.length
  const A = Array(n).fill().map(() => Array(n).fill(0))
  const b = Array(n).fill(0)
  
  for (let i = 0; i < n; i++) {
    let rowSum = 0
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const conductance = D[i][j] / L[i][j]
        A[i][j] = -conductance
        rowSum += conductance
      }
    }
    A[i][i] = rowSum
    b[i] = (i === 0) ? 1 : ((i === n - 1) ? -1 : 0)
  }
  
  A[0] = Array(n).fill(0)
  A[0][0] = 1
  b[0] = 0
  
  return solveLinearSystem(A, b)
}

function computeFlow(D, P, L) {
  const n = D.length
  const Q = Array(n).fill().map(() => Array(n).fill(0))
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        Q[i][j] = (D[i][j] / L[i][j]) * (P[i] - P[j])
      }
    }
  }
  
  return Q
}

function constructTour(D, L, epsilon) {
  const n = D.length
  const visited = Array(n).fill(false)
  const tour = [0]
  visited[0] = true
  
  while (tour.length < n) {
    const current = tour[tour.length - 1]
    let bestIdx = -1
    let bestQ = -Infinity
    
    for (let j = 0; j < n; j++) {
      if (!visited[j]) {
        const q = D[current][j] / L[current][j]
        if (q > bestQ) {
          bestQ = q
          bestIdx = j
        }
      }
    }
    
    if (bestIdx !== -1) {
      tour.push(bestIdx)
      visited[bestIdx] = true
    } else {
      break
    }
  }
  
  return tour
}

function resetD(D, seed) {
  const n = D.length
  const rng = new LCG(seed + 1)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      D[i][j] = 1.0 + rng.next() * 0.1
    }
  }
}

function distance(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

function calculateLength(tour) {
  if (tour.length < 2) return 0
  let length = 0
  for (let i = 0; i < tour.length - 1; i++) {
    length += distance(tour[i], tour[i + 1])
  }
  return length
}

class LCG {
  constructor(seed = 12345) {
    this.seed = seed
  }
  
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
}
