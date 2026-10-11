// Routable road graph: Natural Earth 10m roads (Oman + UAE box) + hand-added gaps + stop connectors.
import fs from "node:fs";

const rad = Math.PI / 180;
export const hav = (a, b) => {
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

// road classes: speed (km/h) and detour factor applied to straight-segment length
export const CLS = [
  { name: "major", kmh: 105, f: 1.0 },   // 0 Natural Earth "Major Highway"
  { name: "road", kmh: 98, f: 1.0 },     // 1 Natural Earth "Road" (e.g. Route 31)
  { name: "other", kmh: 80, f: 1.0 },    // 2 Natural Earth "Unknown"
  { name: "coast", kmh: 95, f: 1.12 },   // 3 added: Quriyat–Sur coastal highway
  { name: "local", kmh: 70, f: 1.15 },   // 4 added: Sur–Ras al Hadd–Ras al Jinz
  { name: "mount", kmh: 40, f: 1.6 },    // 5 added: Jebel Akhdar mountain road
  { name: "link", kmh: 40, f: 1.3 },     // 6 connector from a place to the nearest road
];

export function buildGraph(roadsPath, stops) {
  const gj = JSON.parse(fs.readFileSync(roadsPath, "utf8"));
  const SNAP = 0.003;
  const nodes = [], idx = new Map(), adj = [];
  const keyOf = ([x, y]) => Math.round(x / SNAP) + "," + Math.round(y / SNAP);
  const nodeAt = p => { const k = keyOf(p); if (!idx.has(k)) { idx.set(k, nodes.length); nodes.push(p); adj.push([]); } return idx.get(k); };
  const newNode = p => { nodes.push(p); adj.push([]); return nodes.length - 1; };
  const edges = [];
  const link = (a, b, cls) => {
    if (a === b || adj[a].some(e => e[0] === b)) return;
    const km = hav(nodes[a], nodes[b]) * CLS[cls].f;
    const min = km / CLS[cls].kmh * 60;
    adj[a].push([b, km, min]); adj[b].push([a, km, min]);
    edges.push([a, b, cls]);
  };
  const clsOf = p => p.type === "Major Highway" ? 0 : p.type === "Road" ? 1 : 2;
  for (const f of gj.features) {
    const cls = clsOf(f.properties);
    const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const l of lines) for (let i = 1; i < l.length; i++) link(nodeAt(l[i - 1]), nodeAt(l[i]), cls);
  }
  const roadCount = nodes.length;
  const nearestNode = (p, maxIdx = roadCount, skip = () => false) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < maxIdx; i++) { if (skip(i)) continue; const d = hav(p, nodes[i]); if (d < bd) { bd = d; best = i; } }
    return [best, bd];
  };
  // heal dangling ends that stop just short of another road
  for (let i = 0; i < roadCount; i++) {
    if (adj[i].length !== 1) continue;
    const nb = adj[i][0][0];
    const [j, d] = nearestNode(nodes[i], roadCount, k => k === i || k === nb);
    if (d < 2.5) link(i, j, edges.find(e => e[0] === i || e[1] === i)[2]);
  }
  // hand-added roads missing from Natural Earth
  const chain = (pts, cls) => {
    let prev = null;
    for (const p of pts) {
      let n;
      if (Array.isArray(p) && p.snap) { n = nearestNode(p)[0]; }
      else n = newNode(p);
      if (prev != null) link(prev, n, cls);
      prev = n;
    }
  };
  const snap = p => Object.assign([...p], { snap: true });
  chain([snap([58.91, 23.26]), [59.06, 23.04], [59.17, 22.84], [59.24, 22.80], [59.40, 22.66], snap([59.52, 22.57])], 3);   // Quriyat–Dibab–Tiwi–Sur
  chain([snap([59.52, 22.57]), [59.66, 22.55], [59.79, 22.53], [59.83, 22.45]], 4);                                         // Sur–Ras al Hadd–Ras al Jinz
  chain([snap([57.67, 22.92]), [57.66, 22.98], [57.65, 23.04], [57.668, 23.067]], 5);                                        // Birkat al Mawz–Saiq plateau
  // keep only the main connected network for snapping (Natural Earth has a few stray fragments)
  const comp = new Int32Array(nodes.length).fill(-1); const sizes = [];
  for (let st = 0; st < nodes.length; st++) {
    if (comp[st] >= 0) continue; const id = sizes.length; let n = 0; const stack = [st]; comp[st] = id;
    while (stack.length) { const u = stack.pop(); n++; for (const [v] of adj[u]) if (comp[v] < 0) { comp[v] = id; stack.push(v); } }
    sizes.push(n);
  }
  const mainId = sizes.indexOf(Math.max(...sizes));
  const mainCount = nodes.length;
  const isMain = i => i < mainCount && comp[i] === mainId;
  // stops become nodes linked to the nearest road node
  const stopNode = {};
  for (const [k, s] of Object.entries(stops)) {
    const total = nodes.length;
    const [j, d] = nearestNode(s.ll, total, i => !isMain(i));
    if (d < 0.3) { stopNode[k] = j; continue; }
    const n = newNode(s.ll);
    link(n, j, k === "diana" ? 5 : 6);
    stopNode[k] = n;
  }
  const main = Array.from({ length: nodes.length }, (_, i) => (isMain(i) ? 1 : 0));
  return { nodes, adj, edges, stopNode, roadCount, main, sizes };
}

// Dijkstra by travel time; returns node path, km, minutes
export function route(G, s, t) {
  const n = G.nodes.length;
  const dist = new Float64Array(n).fill(Infinity), km = new Float64Array(n), prev = new Int32Array(n).fill(-1);
  const heap = [[0, s]]; dist[s] = 0;
  while (heap.length) {
    let bi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
    const [du, u] = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
    if (du > dist[u]) continue;
    if (u === t) break;
    for (const [v, ek, em] of G.adj[u]) if (du + em < dist[v]) { dist[v] = du + em; km[v] = km[u] + ek; prev[v] = u; heap.push([dist[v], v]); }
  }
  if (!isFinite(dist[t])) return null;
  const path = []; for (let u = t; u !== -1; u = prev[u]) path.push(u);
  return { path: path.reverse(), km: km[t], min: dist[t] };
}
