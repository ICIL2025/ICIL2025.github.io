import * as pc from '../vendor/polygon-clipping.js'
import { orient2d } from '../vendor/robust-predicates.js'

export function segmentsIntersect(a, b, c, d) {
  function onDiffSides(p, q, r, s) {
    const o1 = orient2d(p[0], p[1], q[0], q[1], r[0], r[1])
    const o2 = orient2d(p[0], p[1], q[0], q[1], s[0], s[1])
    return o1 * o2 < 0
  }
  return onDiffSides(a, b, c, d) && onDiffSides(c, d, a, b)
}

export function pointInPolygon(p, poly) {
  let wn = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if (a[1] <= p[1]) {
      if (b[1] > p[1] && orient2d(a[0], a[1], b[0], b[1], p[0], p[1]) > 0) wn++
    } else {
      if (b[1] <= p[1] && orient2d(a[0], a[1], b[0], b[1], p[0], p[1]) < 0) wn--
    }
  }
  return wn !== 0
}

export function clipPolygons(a, b) {
  const res = pc.intersection([a], [b])
  return res || []
}
