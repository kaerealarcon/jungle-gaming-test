import type { Island } from './simulation';

export interface Point { x: number; y: number }
export function clearPath(from: Point, to: Point, radius: number, blocked: (x: number, y: number, radius: number) => boolean) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 8));
  for (let step = 0; step <= steps; step++) {
    const fraction = step / steps;
    if (blocked(from.x + (to.x - from.x) * fraction, from.y + (to.y - from.y) * fraction, radius)) return false;
  }
  return true;
}

// Small visibility graph around expanded island corners; no physics engine is involved.
export function findRoute(from: Point, to: Point, radius: number, islands: readonly Island[], blocked: (x: number, y: number, radius: number) => boolean): Point[] {
  if (clearPath(from, to, radius, blocked)) return [{ ...to }];
  const nodes = [{ ...from }, { ...to }];
  for (const island of islands) {
    for (const x of [island.x - radius - 4, island.x + island.width + radius + 4]) {
      for (const y of [island.y - radius - 4, island.y + island.height + radius + 4]) if (!blocked(x, y, radius)) nodes.push({ x, y });
    }
  }
  const distance = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  distance[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    for (let index = 0; index < nodes.length; index++) if (!visited.has(index) && (current < 0 || distance[index]! < distance[current]!)) current = index;
    if (current < 0 || !Number.isFinite(distance[current])) break;
    if (current === 1) {
      const route: Point[] = [];
      for (let index = 1; index !== 0; index = previous[index]!) route.unshift(nodes[index]!);
      return route;
    }
    visited.add(current);
    const start = nodes[current]!;
    for (let index = 0; index < nodes.length; index++) {
      const end = nodes[index]!;
      if (visited.has(index) || !clearPath(start, end, radius, blocked)) continue;
      const candidate = distance[current]! + Math.hypot(end.x - start.x, end.y - start.y);
      if (candidate < distance[index]!) { distance[index] = candidate; previous[index] = current; }
    }
  }
  return [];
}
