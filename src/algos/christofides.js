import { minWeightPerfectMatching } from './matching.js'

export function solveChristofides(foodSources) {
  const n = foodSources.length
  const distances = buildDistanceMatrix(foodSources)
  const mst = primMST(distances)
  const oddVertices = findOddVertices(mst, n)
  const matching = minWeightPerfectMatching(oddVertices, distances)
  const multigraph = [...mst, ...matching.map(pair => ({from: pair[0], to: pair[1], weight: distances[pair[0]][pair[1]]}))]
  const eulerianTour = findEulerianTour(multigraph, n)
  const hamiltonianTour = shortcutToHamiltonian(eulerianTour)
  
  return hamiltonianTour.map(i => foodSources[i])
}

function buildDistanceMatrix(points) {
  const n = points.length
  const matrix = Array(n).fill().map(() => Array(n).fill(0))
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const dx = points[j].x - points[i].x
        const dy = points[j].y - points[i].y
        matrix[i][j] = Math.sqrt(dx * dx + dy * dy)
      }
    }
  }
  
  return matrix
}

function primMST(distances) {
  const n = distances.length
  const inMST = Array(n).fill(false)
  const key = Array(n).fill(Infinity)
  const parent = Array(n).fill(-1)
  const mst = []
  
  key[0] = 0
  
  for (let count = 0; count < n; count++) {
    let u = -1
    for (let v = 0; v < n; v++) {
      if (!inMST[v] && (u === -1 || key[v] < key[u])) {
        u = v
      }
    }
    
    inMST[u] = true
    
    if (parent[u] !== -1) {
      mst.push({from: parent[u], to: u, weight: distances[parent[u]][u]})
    }
    
    for (let v = 0; v < n; v++) {
      if (!inMST[v] && distances[u][v] < key[v]) {
        parent[v] = u
        key[v] = distances[u][v]
      }
    }
  }
  
  return mst
}

function findOddVertices(mst, n) {
  const degrees = Array(n).fill(0)
  for (const edge of mst) {
    degrees[edge.from]++
    degrees[edge.to]++
  }
  
  const oddVertices = []
  for (let i = 0; i < n; i++) {
    if (degrees[i] % 2 === 1) {
      oddVertices.push(i)
    }
  }
  
  return oddVertices
}

function findEulerianTour(edges, n) {
  const adj = Array(n).fill().map(() => [])
  for (const edge of edges) {
    adj[edge.from].push(edge.to)
    adj[edge.to].push(edge.from)
  }
  
  const tour = []
  const stack = [0]
  
  while (stack.length > 0) {
    const v = stack[stack.length - 1]
    
    if (adj[v].length > 0) {
      const u = adj[v].pop()
      const idx = adj[u].indexOf(v)
      if (idx !== -1) {
        adj[u].splice(idx, 1)
      }
      stack.push(u)
    } else {
      tour.push(stack.pop())
    }
  }
  
  return tour.reverse()
}

function shortcutToHamiltonian(eulerianTour) {
  const visited = new Set()
  const hamiltonianTour = []
  
  for (const vertex of eulerianTour) {
    if (!visited.has(vertex)) {
      hamiltonianTour.push(vertex)
      visited.add(vertex)
    }
  }
  
  return hamiltonianTour
}
