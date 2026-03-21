import type { ParserStrategy, ExtractedDependency, ParsedFile } from "../types.js";

type TreeSitterParser = {
  parse(content: string): { rootNode: TreeNode };
  setLanguage(lang: unknown): void;
};

let TreeSitterParser: new () => TreeSitterParser;
let Python: unknown;

async function ensureLoaded(): Promise<void> {
  if (!TreeSitterParser) {
    const [ts, py] = await Promise.all([
      import("tree-sitter"),
      import("tree-sitter-python"),
    ]);
    TreeSitterParser = ts.default as new () => TreeSitterParser;
    Python = py.default;
  }
}

type TreeNode = {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: TreeNode[];
  childForFieldName(name: string): TreeNode | null;
};

export class PythonParser implements ParserStrategy {
  private parser: TreeSitterParser | null = null;

  private async ensureParser(): Promise<TreeSitterParser> {
    if (!this.parser) {
      await ensureLoaded();
      this.parser = new TreeSitterParser();
      this.parser.setLanguage(Python);
    }
    return this.parser;
  }

  async parse(filePath: string, content: string): Promise<ParsedFile> {
    const parser = await this.ensureParser();
    const tree = parser.parse(content);
    const rootNode = tree.rootNode as TreeNode;
    const dependencies: ExtractedDependency[] = [];
    const heuristics: Record<string, boolean> = {};

    this.extractImports(rootNode, dependencies);
    heuristics.hasEntrypoint = this.detectMainEntrypoint(rootNode);

    return {
      id: filePath,
      relativePath: filePath.split("/").pop() ?? filePath,
      language: "python",
      dependencies,
      metadata: {
        sizeBytes: Buffer.byteLength(content, "utf-8"),
        heuristics,
      },
    };
  }

  private extractImports(node: TreeNode, dependencies: ExtractedDependency[]): void {
    if (node.type === "import_statement") {
      for (const child of node.children) {
        if (child.type === "dotted_name") {
          dependencies.push({
            rawSpecifier: child.text,
            type: "import",
            location: {
              line: node.startPosition.row + 1,
              column: node.startPosition.column + 1,
            },
            resolvedPath: child.text,
          });
        } else if (child.type === "aliased_name") {
          const dottedName = child.childForFieldName("name");
          if (dottedName) {
            dependencies.push({
              rawSpecifier: dottedName.text,
              type: "import",
              location: {
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
              },
              resolvedPath: dottedName.text,
            });
          }
        }
      }
    } else if (node.type === "import_from_statement") {
      let moduleName = "";
      const importedNames: string[] = [];
      let foundImportKeyword = false;

      for (const child of node.children) {
        if (child.type === "dotted_name") {
          if (!foundImportKeyword) {
            moduleName = child.text;
          } else {
            importedNames.push(child.text);
          }
        } else if (child.type === "identifier") {
          if (foundImportKeyword) {
            importedNames.push(child.text);
          }
        } else if (child.type === "import") {
          foundImportKeyword = true;
        } else if (child.type === "wildcard_import") {
          importedNames.push("*");
        }
      }

      if (importedNames.length === 0 && moduleName) {
        dependencies.push({
          rawSpecifier: moduleName,
          type: "import",
          location: {
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
          },
          resolvedPath: moduleName,
        });
      } else {
        for (const name of importedNames) {
          dependencies.push({
            rawSpecifier: `${moduleName}.${name}`,
            type: "import",
            location: {
              line: node.startPosition.row + 1,
              column: node.startPosition.column + 1,
            },
            resolvedPath: `${moduleName}.${name}`,
          });
        }
      }
    }

    for (const child of node.children) {
      this.extractImports(child, dependencies);
    }
  }

  private detectMainEntrypoint(node: TreeNode): boolean {
    if (node.type === "if_statement") {
      const condition = node.childForFieldName("condition");
      if (condition && this.isNameEqualsMainCheck(condition)) {
        return true;
      }
    }

    for (const child of node.children) {
      if (this.detectMainEntrypoint(child)) {
        return true;
      }
    }

    return false;
  }

  private isNameEqualsMainCheck(node: TreeNode): boolean {
    if (node.type === "comparison_operator") {
      let hasName = false;
      let hasMainString = false;

      for (const child of node.children) {
        if (child.type === "identifier" && child.text === "__name__") {
          hasName = true;
        } else if (child.type === "string") {
          const innerText = child.text.replace(/['"]/g, "");
          if (innerText === "__main__") {
            hasMainString = true;
          }
        }
      }

      return hasName && hasMainString;
    }

    return false;
  }
}
