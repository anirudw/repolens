import { resolve, dirname, join } from "node:path";
import type { ParsedFile, ExtractedDependency } from "../parser/types.js";

export interface GraphNode {
  id: string;
  relativePath: string;
  language: string;
  metadata: ParsedFile["metadata"];
  inboundEdges: number;
  outboundEdges: number;
  ca: number;
  ce: number;
  instability: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: ExtractedDependency["type"];
}

export class Graph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private implementationRegistry: Map<string, string[]> = new Map();

  constructor(files: ParsedFile[]) {
    for (const file of files) {
      this.addNode(file);
    }

    this.resolveEdges(files);
  }

  private addNode(file: ParsedFile): void {
    this.nodes.set(file.id, {
      id: file.id,
      relativePath: file.relativePath,
      language: file.language,
      metadata: file.metadata,
      inboundEdges: 0,
      outboundEdges: 0,
      ca: 0,
      ce: 0,
      instability: 0,
    });

    if (file.metadata.implementsInterfaces) {
      for (const interfaceName of file.metadata.implementsInterfaces) {
        if (!this.implementationRegistry.has(interfaceName)) {
          this.implementationRegistry.set(interfaceName, []);
        }
        this.implementationRegistry.get(interfaceName)!.push(file.id);
      }
    }
  }

  calculateHealthMetrics(): void {
    for (const node of this.nodes.values()) {
      node.ca = node.inboundEdges;
      node.ce = node.outboundEdges;
      const denominator = node.ca + node.ce;
      node.instability = denominator === 0 ? 0 : node.ce / denominator;
    }
  }

  /*
   * COPILOT PROMPT:
   * Implement a `detectCycles()` method that returns string[][] (an array of cycles, where each cycle is an array of node IDs representing the path).
   * 1. Create a `visited` Set<string> and a `recursionStack` Set<string>.
   * 2. Loop through all nodes in the graph. If a node is not in `visited`, call a helper function `dfs(nodeId, currentPath)`.
   * 3. In the `dfs` function:
   * - Add `nodeId` to `visited`, `recursionStack`, and `currentPath` array.
   * - Find all outgoing edges for this node (where edge.source === nodeId).
   * - For each target of those edges:
   * - If target is in `recursionStack`, a cycle is found! Slice `currentPath` from the index of target to the end, append target to close the loop, and push to a `cycles` array.
   * - If target is not in `visited`, recursively call `dfs(target, currentPath)`.
   * - After checking all edges, remove `nodeId` from `recursionStack` and pop it from `currentPath`.
   * 4. Return the `cycles` array.
   */
  detectCycles(): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, currentPath: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      currentPath.push(nodeId);

      for (const edge of this.edges) {
        if (edge.source !== nodeId) {
          continue;
        }

        const target = edge.target;

        if (recursionStack.has(target)) {
          const cycleStartIndex = currentPath.indexOf(target);
          if (cycleStartIndex !== -1) {
            cycles.push([...currentPath.slice(cycleStartIndex), target]);
          }
          continue;
        }

        if (!visited.has(target)) {
          dfs(target, currentPath);
        }
      }

      recursionStack.delete(nodeId);
      currentPath.pop();
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  getImplementationRegistry(): Record<string, string[]> {
    return Object.fromEntries(this.implementationRegistry);
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
    const ext = specifier.slice(specifier.lastIndexOf("."));
    const withoutExt = ext.length > 1 ? specifier.slice(0, specifier.lastIndexOf(".")) : specifier;
    
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
      withoutExt,
      `${withoutExt}.js`,
      `${withoutExt}.ts`,
      `${withoutExt}.jsx`,
      `${withoutExt}.tsx`,
      `${withoutExt}/index.js`,
      `${withoutExt}/index.ts`,
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
