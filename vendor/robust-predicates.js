// Placeholder for robust-predicates ES module  
// In production, download from: https://cdn.skypack.dev/robust-predicates
export function orient2d(ax, ay, bx, by, cx, cy) {
  // Cross product for orientation test
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

export function incircle(ax, ay, bx, by, cx, cy, dx, dy) {
  // Simplified incircle test
  const adx = ax - dx
  const ady = ay - dy
  const bdx = bx - dx
  const bdy = by - dy
  const cdx = cx - dx
  const cdy = cy - dy
  
  return (adx * adx + ady * ady) * (bdx * cdy - bdy * cdx) +
         (bdx * bdx + bdy * bdy) * (cdx * ady - cdy * adx) +
         (cdx * cdx + cdy * cdy) * (adx * bdy - ady * bdx)
}

export function inpolygon(point, vs) {
  const x = point[0], y = point[1]
  let inside = false
  
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    if (((vs[i][1] > y) !== (vs[j][1] > y)) &&
        (x < (vs[j][0] - vs[i][0]) * (y - vs[i][1]) / (vs[j][1] - vs[i][1]) + vs[i][0])) {
      inside = !inside
    }
  }
  
  return inside
}
