import { Graph, type GraphNode } from "../network.js";

export interface RankedNode extends GraphNode {
  centrality: number;
}

export function analyzeGraph(graph: Graph): RankedNode[] {
  const nodes = graph.getNodes();
  const ranked: RankedNode[] = [];

  for (const [, node] of nodes) {
    let centrality = node.inboundEdges;

    if (node.metadata?.heuristics?.isReact) {
      centrality += 5;
    }

    if (node.metadata?.heuristics?.hasMainMethod) {
      centrality += 5;
    }

    ranked.push({
      ...node,
      centrality,
    });
  }

  ranked.sort((a, b) => b.centrality - a.centrality);

  return ranked;
}
