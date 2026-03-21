import { resolve, dirname, join } from "node:path";
import type { ParsedFile, ExtractedDependency } from "../parser/types.js";

export interface GraphNode {
  id: string;
  relativePath: string;
  language: string;
  metadata: ParsedFile["metadata"];
  inboundEdges: number;
  outboundEdges: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: ExtractedDependency["type"];
}

export class Graph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];

  constructor(files: ParsedFile[]) {
    for (const file of files) {
      this.nodes.set(file.id, {
        id: file.id,
        relativePath: file.relativePath,
        language: file.language,
        metadata: file.metadata,
        inboundEdges: 0,
        outboundEdges: 0,
      });
    }

    this.resolveEdges(files);
  }

  private resolveEdges(files: ParsedFile[]): void {
    for (const file of files) {
      const dir = dirname(file.id);

      for (const dep of file.dependencies) {
        if (!dep.rawSpecifier) continue;

        if (
          dep.rawSpecifier.startsWith("http") ||
          dep.rawSpecifier.startsWith("//") ||
          dep.rawSpecifier.startsWith("#") ||
          !this.isLocalImport(dep.rawSpecifier)
        ) {
          continue;
        }

        const resolvedPath = this.resolveImportPath(
          dir,
          dep.rawSpecifier
        );

        if (resolvedPath && this.nodes.has(resolvedPath)) {
          dep.resolvedPath = resolvedPath;
          this.edges.push({
            source: file.id,
            target: resolvedPath,
            type: dep.type,
          });

          const targetNode = this.nodes.get(resolvedPath);
          if (targetNode) {
            targetNode.inboundEdges++;
          }

          const sourceNode = this.nodes.get(file.id);
          if (sourceNode) {
            sourceNode.outboundEdges++;
          }
        }
      }
    }
  }

  private resolveImportPath(
    fromDir: string,
    specifier: string
  ): string | null {
    const candidatePaths = [
      specifier,
      `${specifier}.js`,
      `${specifier}.ts`,
      `${specifier}.jsx`,
      `${specifier}.tsx`,
      `${specifier}/index.js`,
      `${specifier}/index.ts`,
      `${specifier}/index.jsx`,
      `${specifier}/index.tsx`,
    ];

    for (const candidate of candidatePaths) {
      try {
        const fullPath = resolve(fromDir, candidate);
        if (this.nodes.has(fullPath)) {
          return fullPath;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private isLocalImport(specifier: string): boolean {
    return (
      specifier.startsWith("./") ||
      specifier.startsWith("../") ||
      specifier.startsWith("/")
    );
  }

  getNodes(): Map<string, GraphNode> {
    return this.nodes;
  }

  getEdges(): GraphEdge[] {
    return this.edges;
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getNeighbors(id: string): { inbound: GraphNode[]; outbound: GraphNode[] } {
    const inbound: GraphNode[] = [];
    const outbound: GraphNode[] = [];

    for (const edge of this.edges) {
      if (edge.target === id) {
        const node = this.nodes.get(edge.source);
        if (node) inbound.push(node);
      }
      if (edge.source === id) {
        const node = this.nodes.get(edge.target);
        if (node) outbound.push(node);
      }
    }

    return { inbound, outbound };
  }
}
