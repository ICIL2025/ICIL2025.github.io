import blossom from '../vendor/edmonds-blossom.js'

export function minWeightPerfectMatching(oddVertices, L) {
  const idxMap = new Map()
  oddVertices.forEach((v, i) => idxMap.set(v, i))
  const edges = []
  for (let i = 0; i < oddVertices.length; i++) {
    for (let j = i + 1; j < oddVertices.length; j++) {
      const u = oddVertices[i]
      const v = oddVertices[j]
      const w = L[u][v]
      edges.push([i, j, w])
    }
  }
  const mate = blossom(edges, true)
  const pairs = []
  for (let i = 0; i < mate.length; i++) {
    const j = mate[i]
    if (j > i) {
      const u = oddVertices[i]
      const v = oddVertices[j]
      pairs.push([u, v])
    }
  }
  return pairs
}
