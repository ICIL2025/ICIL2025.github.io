import RBush from '../vendor/rbush.js'

export function buildIndex(items) {
  const tree = new RBush()
  tree.load(items)
  return tree
}

export function query(tree, box) {
  return tree.search(box)
}
