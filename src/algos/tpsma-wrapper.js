// Enhanced TPSMA wrapper for integration with existing system
// Bridges the bio-inspired TPSMA implementation with TSP interface

import { solveTPSMA as solveBioTPSMA } from './tpsma.js'

export function solveTPSMA(positions, flow, distance, alpha = 0.5) {
  const n = positions.length
  if (n < 2) return { route: [0], distance: 0, algorithm: 'Enhanced TPSMA' }
  
  try {
    // Convert positions to the format expected by bio-inspired TPSMA
    const foodSources = positions.map((pos, idx) => ({
      x: pos.x || pos[0],
      y: pos.y || pos[1],
      id: idx
    }))
    
    // Configure TPSMA parameters
    const params = {
      epsilon: alpha || 0.1,
      dt: 0.01,
      delta: 0.001,
      maxIter: 1000,
      kSeeds: 3
    }
    
    // Solve using bio-inspired TPSMA
    const tour = solveBioTPSMA(foodSources, params)
    
    if (!tour || tour.length === 0) {
      throw new Error('TPSMA returned empty tour')
    }
    
    // Calculate total distance using provided distance function or Euclidean
    let totalDistance = 0
    for (let i = 0; i < tour.length - 1; i++) {
      const from = tour[i]
      const to = tour[i + 1]
      
      if (distance && distance[from] && distance[from][to]) {
        totalDistance += distance[from][to]
      } else {
        // Fallback to Euclidean distance
        const pos1 = positions[from]
        const pos2 = positions[to]
        const dx = (pos1.x || pos1[0]) - (pos2.x || pos2[0])
        const dy = (pos1.y || pos1[1]) - (pos2.y || pos2[1])
        totalDistance += Math.sqrt(dx * dx + dy * dy)
      }
    }
    
    // Add return to start for complete tour
    if (tour.length === n && tour.length > 1) {
      const lastIdx = tour[n - 1]
      const firstIdx = tour[0]
      
      if (distance && distance[lastIdx] && distance[lastIdx][firstIdx]) {
        totalDistance += distance[lastIdx][firstIdx]
      } else {
        const pos1 = positions[lastIdx]
        const pos2 = positions[firstIdx]
        const dx = (pos1.x || pos1[0]) - (pos2.x || pos2[0])
        const dy = (pos1.y || pos1[1]) - (pos2.y || pos2[1])
        totalDistance += Math.sqrt(dx * dx + dy * dy)
      }
    }
    
    return {
      route: tour,
      distance: totalDistance,
      algorithm: 'Enhanced Bio-Inspired TPSMA'
    }
    
  } catch (error) {
    console.warn('Enhanced TPSMA failed, using nearest neighbor fallback:', error)
    
    // Simple nearest neighbor fallback
    const route = [0]
    const visited = new Set([0])
    let current = 0
    let totalDistance = 0
    
    while (route.length < n) {
      let nearest = -1
      let nearestDist = Infinity
      
      for (let i = 0; i < n; i++) {
        if (!visited.has(i)) {
          let dist = Infinity
          
          if (distance && distance[current] && distance[current][i]) {
            dist = distance[current][i]
          } else {
            const pos1 = positions[current]
            const pos2 = positions[i]
            const dx = (pos1.x || pos1[0]) - (pos2.x || pos2[0])
            const dy = (pos1.y || pos1[1]) - (pos2.y || pos2[1])
            dist = Math.sqrt(dx * dx + dy * dy)
          }
          
          if (dist < nearestDist) {
            nearestDist = dist
            nearest = i
          }
        }
      }
      
      if (nearest !== -1) {
        route.push(nearest)
        visited.add(nearest)
        totalDistance += nearestDist
        current = nearest
      } else {
        break
      }
    }
    
    // Add return to start
    if (route.length > 1) {
      const lastIdx = route[route.length - 1]
      const firstIdx = route[0]
      
      if (distance && distance[lastIdx] && distance[lastIdx][firstIdx]) {
        totalDistance += distance[lastIdx][firstIdx]
      } else {
        const pos1 = positions[lastIdx]
        const pos2 = positions[firstIdx]
        const dx = (pos1.x || pos1[0]) - (pos2.x || pos2[0])
        const dy = (pos1.y || pos1[1]) - (pos2.y || pos2[1])
        totalDistance += Math.sqrt(dx * dx + dy * dy)
      }
    }
    
    return {
      route,
      distance: totalDistance,
      algorithm: 'Enhanced TPSMA (fallback)'
    }
  }
}
