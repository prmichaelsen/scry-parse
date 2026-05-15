import type { EntryMarker } from './markers.js';

/**
 * Detect cycles in the `depends_on` relationship graph (FR12).
 *
 * Per the spec: "Implementations supporting the `depends_on` field MUST detect cycles."
 * A → B means "A depends on B". Cycles (A → B → C → A) are invalid.
 *
 * Algorithm: DFS with 3-color marking (unvisited / in-stack / done).
 * Back edges (gray → gray) identify cycles. Each cycle is returned as the
 * sequence of IDs forming the loop, with the repeated ID at both ends.
 *
 * Only IDs present in the input `entries` are included in the graph.
 * External `depends_on` references (IDs not in the input set) are ignored.
 *
 * @param entries - Array of parsed entry markers to check
 * @returns Array of cycles; each cycle is an array of IDs forming the loop
 *   (first ID === last ID). Empty array means no cycles.
 */
export function checkCycles(entries: EntryMarker[]): string[][] {
  if (entries.length === 0) return [];

  // Build adjacency map restricted to known IDs
  const knownIds = new Set(entries.map(e => e.id));
  const adj = new Map<string, string[]>();
  for (const entry of entries) {
    adj.set(entry.id, entry.dependsOn.filter(dep => knownIds.has(dep)));
  }

  const cycles: string[][] = [];
  const state = new Map<string, 'unvisited' | 'in-stack' | 'done'>();
  for (const id of adj.keys()) state.set(id, 'unvisited');

  const stack: string[] = [];

  function dfs(node: string): void {
    state.set(node, 'in-stack');
    stack.push(node);

    for (const neighbor of adj.get(node) ?? []) {
      if (state.get(neighbor) === 'in-stack') {
        // Back edge: cycle found — extract the cycle portion from stack
        const idx = stack.indexOf(neighbor);
        cycles.push([...stack.slice(idx), neighbor]);
      } else if (state.get(neighbor) === 'unvisited') {
        dfs(neighbor);
      }
      // 'done' → skip (fully explored; any cycles through it already recorded)
    }

    stack.pop();
    state.set(node, 'done');
  }

  for (const [id, nodeState] of state) {
    if (nodeState === 'unvisited') {
      dfs(id);
    }
  }

  return cycles;
}
