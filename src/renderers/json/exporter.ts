import { writeFile } from "node:fs/promises";
import type { Graph } from "../../graph/network.js";
import type { ParsedFile } from "../../parser/types.js";

export interface JsonNode {
  id: string;
  relativePath: string;
  language: string;
  sizeBytes: number;
  heuristics: Record<string, boolean>;
}

export interface JsonEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphJson {
  nodes: JsonNode[];
  edges: JsonEdge[];
  implementations: Record<string, string[]>;
}

export async function exportGraphToJson(
  graph: Graph,
  parsedFiles: ParsedFile[],
  outputPath: string
): Promise<void> {
  const fileMap = new Map<string, ParsedFile>();
  for (const file of parsedFiles) {
    fileMap.set(file.id, file);
  }

  const nodes: JsonNode[] = [];
  for (const [nodeId] of graph.getNodes()) {
    const parsedFile = fileMap.get(nodeId);
    if (parsedFile) {
      nodes.push({
        id: parsedFile.id,
        relativePath: parsedFile.relativePath,
        language: parsedFile.language,
        sizeBytes: parsedFile.metadata.sizeBytes,
        heuristics: parsedFile.metadata.heuristics,
      });
    }
  }

  const edges: JsonEdge[] = graph.getEdges().map((edge) => ({
    source: edge.source,
    target: edge.target,
    type: edge.type,
  }));

  const implementations = graph.getImplementationRegistry();

  const output: GraphJson = { nodes, edges, implementations };
  await writeFile(outputPath, JSON.stringify(output, null, 2));
}
