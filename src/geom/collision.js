import { segmentsIntersect, pointInPolygon, clipPolygons } from './robust.js'
import { buildIndex, query } from './index2d.js'

let spatialIndex = null
let obstacleSegments = []

export function initCollisionSystem(obstacles) {
  obstacleSegments = []
  
  for (const obstacle of obstacles) {
    if (obstacle.points && obstacle.points.length > 2) {
      for (let i = 0; i < obstacle.points.length; i++) {
        const p1 = obstacle.points[i]
        const p2 = obstacle.points[(i + 1) % obstacle.points.length]
        
        const segment = {
          minX: Math.min(p1.x, p2.x),
          minY: Math.min(p1.y, p2.y),
          maxX: Math.max(p1.x, p2.x),
          maxY: Math.max(p1.y, p2.y),
          data: {p1: [p1.x, p1.y], p2: [p2.x, p2.y]}
        }
        
        obstacleSegments.push(segment)
      }
    }
  }
  
  spatialIndex = buildIndex(obstacleSegments)
}

export function segmentIntersectsObstacles(a, b) {
  if (!spatialIndex) return false
  
  const box = {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y)
  }
  
  const candidates = query(spatialIndex, box)
  const segment = [[a.x, a.y], [b.x, b.y]]
  
  for (const candidate of candidates) {
    if (segmentsIntersect(segment[0], segment[1], candidate.data.p1, candidate.data.p2)) {
      return true
    }
  }
  
  return false
}

export function pointInsideObstacle(point, obstacles) {
  for (const obstacle of obstacles) {
    if (obstacle.points && obstacle.points.length > 2) {
      const poly = obstacle.points.map(p => [p.x, p.y])
      if (pointInPolygon([point.x, point.y], poly)) {
        return true
      }
    }
  }
  return false
}

export function clipObstacle(polyA, polyB) {
  const a = polyA.map(p => [p.x, p.y])
  const b = polyB.map(p => [p.x, p.y])
  return clipPolygons(a, b)
}
