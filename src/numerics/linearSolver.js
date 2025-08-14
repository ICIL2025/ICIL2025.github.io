import { Matrix } from '../vendor/ml-matrix.js'

export function solveLinearSystem(A, b) {
  const mA = new Matrix(A)
  const mb = Matrix.columnVector(b)
  const x = mA.solve(mb)
  return x.to1DArray()
}
