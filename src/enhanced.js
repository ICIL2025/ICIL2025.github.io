// Main integration module for enhanced algorithms
// This bridges the new modular system with existing codebase

// Import all enhanced modules
import { solveLinearSystem } from './numerics/linearSolver.js'
import { minWeightPerfectMatching } from './algos/matching.js'
import { segmentsIntersect, pointInPolygon, clipPolygons } from './geom/robust.js'
import { buildIndex, queryIndex } from './geom/index2d.js'
import { solveTPSMA } from './algos/tpsma-wrapper.js'
import { christofides } from './algos/christofides.js'
import { 
  initCollisionSystem, 
  segmentIntersectsObstacles, 
  pointInsideObstacle 
} from './geom/collision.js'

// Enhanced algorithm implementations that replace existing functions
export class EnhancedTSP {
  constructor(obstacles = []) {
    this.obstacles = obstacles
    this.collisionSystem = initCollisionSystem(obstacles)
  }

  // Enhanced TPSMA using stable linear algebra
  solveTSP_TPSMA(positions, flow, distance, alpha = 0.5) {
    return solveTPSMA(positions, flow, distance, alpha)
  }

  // Enhanced Christofides with optimal matching
  solveTSP_Christofides(positions) {
    return christofides(positions)
  }

  // Enhanced genetic algorithm (placeholder for now)
  solveTSP_GA(positions, populationSize = 50, generations = 100) {
    // This would integrate with existing GA implementation
    // For now, delegate to existing implementation
    return this.fallbackGA(positions, populationSize, generations)
  }

  // Enhanced distance calculation with obstacles
  calculateDistance(pos1, pos2) {
    // Check if direct path is blocked by obstacles
    if (this.isPathBlocked(pos1, pos2)) {
      // Use A* or similar pathfinding (simplified here)
      return this.calculateObstacleAwareDistance(pos1, pos2)
    }
    
    // Direct Euclidean distance
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  isPathBlocked(pos1, pos2) {
    return segmentIntersectsObstacles(
      [pos1.x, pos1.y, pos2.x, pos2.y], 
      this.collisionSystem
    )
  }

  calculateObstacleAwareDistance(pos1, pos2) {
    // Simplified obstacle-aware distance (could be enhanced with A*)
    const directDistance = Math.sqrt(
      (pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2
    )
    
    // Add penalty for obstacle avoidance
    return directDistance * 1.4 // 40% penalty for obstacle avoidance
  }

  // Fallback to existing implementations
  fallbackGA(positions, populationSize, generations) {
    // This would call the existing GA implementation
    // Placeholder return
    return { route: Array.from({length: positions.length}, (_, i) => i), distance: 0 }
  }

  // Update obstacle configuration
  updateObstacles(obstacles) {
    this.obstacles = obstacles
    this.collisionSystem = initCollisionSystem(obstacles)
  }
}

// Enhanced utilities
export class EnhancedGeometry {
  static pointInPolygon(point, polygon) {
    return pointInPolygon(point, polygon)
  }

  static segmentIntersection(seg1, seg2) {
    return segmentsIntersect(seg1, seg2)
  }

  static clipPolygons(subject, clip) {
    return clipPolygons(subject, clip)
  }

  static buildSpatialIndex(items) {
    return buildIndex(items)
  }

  static querySpatialIndex(index, bounds) {
    return queryIndex(index, bounds)
  }
}

// Export enhanced classes for integration with existing code
export default EnhancedTSP
