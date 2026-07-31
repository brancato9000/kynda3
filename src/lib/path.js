// Pathfinding (V3-41): the shortest DOCUMENTED path between any two entities
// in the graph. Pure function over an edge list — zero tokens, eval-testable.
//
// Evidence-weighted Dijkstra: a quote-confirmed hop costs less than a
// db-confirmed hop costs less than bare synthesis, so paths prefer receipts
// but stay connected when the well-documented route doesn't exist. Every hop
// carries its evidence tier honestly.

export const TIER_WEIGHTS = { cited: 1, documented: 1.2, synthesis: 3 };

// claim_type → directional verb phrase, read subject → object.
export const HOP_PHRASES = {
  influenced_by: "was influenced by",
  cited_as_influence: "cited as an influence",
  covers: "covered",
  covered_by: "was covered by",
  collaborated_with: "collaborated with",
  member_of: "was a member of",
  produced_by: "was produced by",
  same_scene: "shared a scene with",
  cross_medium_influence: "drew cross-medium influence from",
  used_gear: "used",
  recorded_at: "recorded at",
  founded: "founded",
  taught_at: "taught at",
  studied_under: "studied under",
  created_by: "was created by",
};

/**
 * edges: [{ subjectId, objectId, claimType, tier, ...receipt }]
 * Returns { hops: [{ edge, fromId, toId }], cost } or null when unreachable.
 * Traversal is undirected (influence connects both ways for reachability);
 * each hop keeps the edge's stored direction for honest phrasing.
 */
export function findPath(edges, fromId, toId) {
  if (fromId === toId) return { hops: [], cost: 0 };
  const adj = new Map();
  for (const e of edges) {
    if (!e.subjectId || !e.objectId || e.subjectId === e.objectId) continue;
    const w = TIER_WEIGHTS[e.tier] ?? TIER_WEIGHTS.synthesis;
    if (!adj.has(e.subjectId)) adj.set(e.subjectId, []);
    if (!adj.has(e.objectId)) adj.set(e.objectId, []);
    adj.get(e.subjectId).push({ to: e.objectId, w, edge: e });
    adj.get(e.objectId).push({ to: e.subjectId, w, edge: e });
  }
  if (!adj.has(fromId) || !adj.has(toId)) return null;

  const dist = new Map([[fromId, 0]]);
  const prev = new Map(); // node → { node, edge }
  const visited = new Set();
  // Array-scan priority queue — the graph is a few thousand edges; simplicity wins.
  while (true) {
    let node = null, best = Infinity;
    for (const [n, d] of dist) {
      if (!visited.has(n) && d < best) { best = d; node = n; }
    }
    if (node === null) return null;
    if (node === toId) break;
    visited.add(node);
    for (const { to, w, edge } of adj.get(node) || []) {
      const nd = best + w;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { node, edge });
      }
    }
  }

  const hops = [];
  let cur = toId;
  while (cur !== fromId) {
    const { node, edge } = prev.get(cur);
    hops.unshift({ edge, fromId: node, toId: cur });
    cur = node;
  }
  return { hops, cost: dist.get(toId) };
}

/** Human sentence for one hop, honoring the claim's stored direction. */
export function hopSentence(hop, nameOf) {
  const { edge } = hop;
  const phrase = HOP_PHRASES[edge.claimType] || "is connected to";
  return `${nameOf(edge.subjectId)} ${phrase} ${nameOf(edge.objectId)}`;
}
