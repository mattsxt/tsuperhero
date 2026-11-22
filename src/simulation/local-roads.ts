import { roadGeometry } from "@/simulation/seed/road-geometry.generated";
import { routes } from "@/simulation/seed/geography";
import { getDistanceMeters, type LatLngPair } from "@/utils/geo";

const JOIN_M = 12;
const MAX_SNAP_M = 600;
const CELL_DEG = 0.0002;

type Graph = {
  nodes: LatLngPair[];
  edges: Map<number, number>[];
  segments: [number, number][];
};

let graph: Graph | null = null;

const meters = (a: LatLngPair, b: LatLngPair) =>
  getDistanceMeters({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });

const roadLines = (): LatLngPair[][] => {
  const lines: LatLngPair[][] = [];
  for (const entry of Object.values(roadGeometry)) lines.push(entry.path, ...entry.alternatives);
  for (const route of routes) {
    if (!roadGeometry[String(route.route_id)] && Array.isArray(route.path))
      lines.push(route.path as LatLngPair[]);
  }
  return lines.filter((line) => line.length > 1);
};

const buildGraph = (): Graph => {
  const nodes: LatLngPair[] = [];
  const edges: Map<number, number>[] = [];
  const segments: [number, number][] = [];
  const cells = new Map<string, number[]>();
  const nodeFor = (point: LatLngPair): number => {
    const cy = Math.floor(point[0] / CELL_DEG);
    const cx = Math.floor(point[1] / CELL_DEG);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const id of cells.get(`${cy + dy}:${cx + dx}`) ?? [])
          if (meters(nodes[id], point) <= JOIN_M) return id;
    const id = nodes.length;
    nodes.push(point);
    edges.push(new Map());
    const key = `${cy}:${cx}`;
    const cell = cells.get(key);
    if (cell) cell.push(id);
    else cells.set(key, [id]);
    return id;
  };
  const link = (a: number, b: number) => {
    if (a === b || edges[a].has(b)) return;
    const cost = meters(nodes[a], nodes[b]);
    edges[a].set(b, cost);
    edges[b].set(a, cost);
    segments.push([a, b]);
  };
  for (const line of roadLines()) {
    let previous = nodeFor(line[0]);
    for (let i = 1; i < line.length; i++) {
      const next = nodeFor(line[i]);
      link(previous, next);
      previous = next;
    }
  }
  return { nodes, edges, segments };
};

type Snap = { point: LatLngPair; a: number; b: number; distance: number };

const snapToGraph = ({ nodes, segments }: Graph, p: LatLngPair): Snap | null => {
  const k = Math.cos((p[0] * Math.PI) / 180);
  const px = p[1] * k;
  const py = p[0];
  let bestIndex = -1;
  let bestT = 0;
  let bestSq = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i];
    const ax = nodes[a][1] * k;
    const ay = nodes[a][0];
    const dx = nodes[b][1] * k - ax;
    const dy = nodes[b][0] - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    const ex = ax + dx * t - px;
    const ey = ay + dy * t - py;
    const sq = ex * ex + ey * ey;
    if (sq < bestSq) {
      bestSq = sq;
      bestIndex = i;
      bestT = t;
    }
  }
  if (bestIndex < 0) return null;
  const [a, b] = segments[bestIndex];
  const point: LatLngPair = [
    nodes[a][0] + (nodes[b][0] - nodes[a][0]) * bestT,
    nodes[a][1] + (nodes[b][1] - nodes[a][1]) * bestT,
  ];
  const distance = meters(p, point);
  return distance <= MAX_SNAP_M ? { point, a, b, distance } : null;
};

class MinHeap {
  private items: [number, number][] = [];
  get size() {
    return this.items.length;
  }
  push(item: [number, number]) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent][0] <= items[i][0]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): [number, number] {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l][0] < items[m][0]) m = l;
        if (r < items.length && items[r][0] < items[m][0]) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top;
  }
}

const shortestPath = (g: Graph, from: Snap, to: Snap): number[] | null => {
  const START = -1;
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const open = new MinHeap();
  const push = (id: number, d: number, via: number) => {
    if (d >= (dist.get(id) ?? Infinity)) return;
    dist.set(id, d);
    prev.set(id, via);
    open.push([d, id]);
  };
  push(from.a, meters(from.point, g.nodes[from.a]), START);
  push(from.b, meters(from.point, g.nodes[from.b]), START);
  const goal = new Map<number, number>([
    [to.a, meters(to.point, g.nodes[to.a])],
    [to.b, meters(to.point, g.nodes[to.b])],
  ]);
  let bestEnd = -1;
  let bestTotal = Infinity;
  while (open.size) {
    const [d, id] = open.pop();
    if (d > dist.get(id)!) continue;
    if (d >= bestTotal) break;
    const tail = goal.get(id);
    if (tail !== undefined && d + tail < bestTotal) {
      bestTotal = d + tail;
      bestEnd = id;
    }
    g.edges[id].forEach((cost, next) => push(next, d + cost, id));
  }
  if (bestEnd < 0) return null;
  const chain: number[] = [];
  for (let id = bestEnd; id !== START; id = prev.get(id)!) chain.push(id);
  return chain.reverse();
};

export function localRoadPath(from: LatLngPair, to: LatLngPair): LatLngPair[] | null {
  graph ??= buildGraph();
  const a = snapToGraph(graph, from);
  const b = snapToGraph(graph, to);
  if (!a || !b) return null;
  const sameEdge = (a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a);
  if (sameEdge) return [from, a.point, b.point, to];
  const chain = shortestPath(graph, a, b);
  if (!chain) return null;
  const nodes = graph.nodes;
  return [from, a.point, ...chain.map((id) => nodes[id]), b.point, to];
}
