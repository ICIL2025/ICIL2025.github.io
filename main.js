// Main ES6 module integration script
// This bridges the new enhanced modules with the existing script.js

import EnhancedTSP from './src/enhanced.js'

// Global enhanced TSP instance
let enhancedTSP = null

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Wait for existing script.js to initialize
  setTimeout(() => {
    initializeEnhancedSystem()
  }, 100)
})

function initializeEnhancedSystem() {
  console.log('Initializing enhanced algorithm system...')
  
  // Initialize with current obstacles (from existing script.js global)
  const currentObstacles = window.obstaclePolygons || []
  enhancedTSP = new EnhancedTSP(currentObstacles)
  
  // Expose enhanced system to global scope for integration with script.js
  window.enhancedTSP = enhancedTSP
  
  // Override existing TSP functions with enhanced versions
  setupEnhancedIntegration()
  
  console.log('Enhanced system initialized with', currentObstacles.length, 'obstacles')
}

function setupEnhancedIntegration() {
  // Store original functions before overriding
  const originalSolveTSP_TPSMA = window.solveTSP_TPSMA
  const originalSolveTSP_Christofides = window.solveTSP_Christofides
  const originalCalculateDistance = window.calculateDistance
  
  // Override TPSMA with enhanced version
  if (typeof window.solveTSP_TPSMA === 'function') {
    window.solveTSP_TPSMA = function(positions, flow, distance, alpha) {
      console.log('Using enhanced TPSMA algorithm')
      try {
        return enhancedTSP.solveTSP_TPSMA(positions, flow, distance, alpha)
      } catch (error) {
        console.warn('Enhanced TPSMA failed, falling back to original:', error)
        return originalSolveTSP_TPSMA.call(this, positions, flow, distance, alpha)
      }
    }
  }
  
  // Override Christofides with enhanced version
  if (typeof window.solveTSP_Christofides === 'function') {
    window.solveTSP_Christofides = function(positions) {
      console.log('Using enhanced Christofides algorithm')
      try {
        return enhancedTSP.solveTSP_Christofides(positions)
      } catch (error) {
        console.warn('Enhanced Christofides failed, falling back to original:', error)
        return originalSolveTSP_Christofides.call(this, positions)
      }
    }
  }
  
  // Override distance calculation with obstacle awareness
  if (typeof window.calculateDistance === 'function') {
    window.calculateDistance = function(pos1, pos2) {
      if (enhancedTSP && enhancedTSP.obstacles.length > 0) {
        return enhancedTSP.calculateDistance(pos1, pos2)
      }
      return originalCalculateDistance.call(this, pos1, pos2)
    }
  }
  
  // Add obstacle update integration
  const originalClearObstacles = window.clearObstacles
  if (typeof window.clearObstacles === 'function') {
    window.clearObstacles = function() {
      originalClearObstacles.call(this)
      if (enhancedTSP) {
        enhancedTSP.updateObstacles([])
      }
    }
  }
  
  // Hook into obstacle drawing completion
  const originalFinishPolygon = window.finishCurrentPolygon
  if (typeof window.finishCurrentPolygon === 'function') {
    window.finishCurrentPolygon = function() {
      originalFinishPolygon.call(this)
      if (enhancedTSP && window.obstaclePolygons) {
        enhancedTSP.updateObstacles(window.obstaclePolygons)
      }
    }
  }
  
  console.log('Enhanced integration setup complete')
}

// Expose utility functions for console debugging
window.enhancedDebug = {
  getEnhancedTSP: () => enhancedTSP,
  testLinearSolve: async () => {
    const { solveLinearSystem } = await import('./src/numerics/linearSolver.js')
    const A = [[2, 1], [1, 3]]
    const b = [1, 2]
    const result = solveLinearSystem(A, b)
    console.log('Linear solve test:', { A, b, result })
    return result
  },
  testMatching: async () => {
    const { minWeightPerfectMatching } = await import('./src/algos/matching.js')
    const vertices = [0, 1, 2, 3]
    const distances = {
      '0-1': 1, '0-2': 4, '0-3': 3,
      '1-2': 2, '1-3': 5,
      '2-3': 1
    }
    const result = minWeightPerfectMatching(vertices, distances)
    console.log('Matching test:', { vertices, distances, result })
    return result
  },
  reinitialize: () => {
    initializeEnhancedSystem()
  }
}

console.log('Enhanced TSP system loaded. Use enhancedDebug for testing.')
