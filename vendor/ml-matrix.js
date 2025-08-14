// Placeholder for ml-matrix ES module
// In production, download from: https://cdn.skypack.dev/ml-matrix
export class Matrix {
  constructor(data) {
    if (Array.isArray(data) && Array.isArray(data[0])) {
      this.data = data.map(row => [...row])
    } else {
      throw new Error('Matrix constructor requires 2D array')
    }
  }
  
  static columnVector(vector) {
    return new Matrix(vector.map(v => [v]))
  }
  
  solve(b) {
    const A = this.data
    const bData = b.data
    const n = A.length
    
    for (let i = 0; i < n; i++) {
      let maxRow = i
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
          maxRow = k
        }
      }
      [A[i], A[maxRow]] = [A[maxRow], A[i]]
      [bData[i], bData[maxRow]] = [bData[maxRow], bData[i]]
      
      for (let k = i + 1; k < n; k++) {
        const factor = A[k][i] / A[i][i]
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j]
        }
        bData[k][0] -= factor * bData[i][0]
      }
    }
    
    const x = Array(n).fill(0)
    for (let i = n - 1; i >= 0; i--) {
      x[i] = bData[i][0]
      for (let j = i + 1; j < n; j++) {
        x[i] -= A[i][j] * x[j]
      }
      x[i] /= A[i][i]
    }
    
    return new Matrix(x.map(v => [v]))
  }
  
  to1DArray() {
    return this.data.map(row => row[0])
  }
}
