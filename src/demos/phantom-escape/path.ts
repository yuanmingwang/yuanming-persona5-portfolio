import { floorNeighbors, tileDistance } from './map.ts'

export function findRoute(floor: Uint8Array, start: number, goal: number, risk: Float32Array, explored: Set<number>) {
  const cost = new Float32Array(floor.length).fill(Infinity)
  const estimate = new Float32Array(floor.length)
  const previous = new Int16Array(floor.length).fill(-1)
  const frontier = new Set([start])
  cost[start] = 0
  estimate[start] = tileDistance(start, goal)

  while (frontier.size) {
    let next = -1
    for (const cell of frontier) {
      if (next === -1 || estimate[cell] < estimate[next] ||
        (estimate[cell] === estimate[next] && cost[cell] > cost[next])) next = cell
    }
    frontier.delete(next)
    explored.add(next)
    if (next === goal) {
      const cells = [goal]
      for (let cell = previous[goal]; cell !== -1; cell = previous[cell]) cells.push(cell)
      return { cells: cells.reverse(), cost: cost[goal] }
    }

    for (const neighbor of floorNeighbors(floor, next)) {
      const candidate = Math.fround(cost[next] + 1 + risk[neighbor])
      if (candidate >= cost[neighbor]) continue
      cost[neighbor] = candidate
      estimate[neighbor] = candidate + tileDistance(neighbor, goal)
      previous[neighbor] = next
      frontier.add(neighbor)
    }
  }
  return { cells: [], cost: Infinity }
}
