import { remark } from "remark";
import { visit } from "unist-util-visit";
import type { Node } from "unist";
import type { ParserStrategy, ExtractedDependency, ParsedFile } from "../types.js";

interface LinkNode extends Node {
  type: string;
  url?: string;
  children?: Node[];
  position?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export class MarkdownParser implements ParserStrategy {
  private processor = remark();

  async parse(filePath: string, content: string): Promise<ParsedFile> {
    const tree = this.processor.parse(content);
    const dependencies: ExtractedDependency[] = [];

    visit(tree, "link", (node: LinkNode) => {
      if (node.url) {
        dependencies.push({
          rawSpecifier: node.url,
          type: "markdown-link",
          location: {
            line: node.position?.start.line ?? 1,
            column: node.position?.start.column ?? 1,
          },
          resolvedPath: this.resolvePath(node.url),
        });
      }
    });

    const wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    while ((match = wikilinkRegex.exec(content)) !== null) {
      const lineInfo = this.getLineNumber(content, match.index);
      dependencies.push({
        rawSpecifier: match[1],
        type: "wikilink",
        location: {
          line: lineInfo.line,
          column: lineInfo.column,
        },
        resolvedPath: this.resolvePath(match[1]),
      });
    }

    return {
      id: filePath,
      relativePath: filePath.split("/").pop() ?? filePath,
      language: "markdown",
      dependencies,
      metadata: {
        sizeBytes: Buffer.byteLength(content, "utf-8"),
        heuristics: {
          hasWikilinks: dependencies.some((d) => d.type === "wikilink"),
          hasExternalLinks: dependencies.some((d) =>
            d.rawSpecifier.startsWith("http")
          ),
        },
      },
    };
  }

  private getLineNumber(content: string, index: number): { line: number; column: number } {
    const lines = content.substring(0, index).split("\n");
    return {
      line: lines.length,
      column: (lines[lines.length - 1]?.length ?? 0) + 1,
    };
  }

  private resolvePath(specifier: string): string | null {
    if (specifier.startsWith("http") || specifier.startsWith("//")) {
      return null;
    }
    return specifier;
  }
}
