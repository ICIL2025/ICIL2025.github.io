// Placeholder for rbush ES module
// In production, download from: https://cdn.skypack.dev/rbush
export default class RBush {
  constructor(maxEntries = 9) {
    this.maxEntries = maxEntries
    this.items = []
  }
  
  load(items) {
    this.items = [...items]
    return this
  }
  
  insert(item) {
    this.items.push(item)
    return this
  }
  
  search(bbox) {
    const result = []
    
    for (const item of this.items) {
      if (this.intersects(item, bbox)) {
        result.push(item)
      }
    }
    
    return result
  }
  
  intersects(a, b) {
    return !(a.maxX < b.minX || 
             b.maxX < a.minX || 
             a.maxY < b.minY || 
             b.maxY < a.minY)
  }
  
  clear() {
    this.items = []
    return this
  }
  
  all() {
    return [...this.items]
  }
}
