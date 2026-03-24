import type { ParserStrategy, ExtractedDependency, ParsedFile } from "../types.js";

type TreeSitterParser = {
  parse(content: string): { rootNode: TreeNode };
  setLanguage(lang: unknown): void;
};

let TreeSitterParser: new () => TreeSitterParser;
let JavaScript: unknown;
let TypeScript: unknown;

async function ensureLoaded(): Promise<void> {
  if (!TreeSitterParser) {
    const [ts, js, tst] = await Promise.all([
      import("tree-sitter"),
      import("tree-sitter-javascript"),
      import("tree-sitter-typescript"),
    ]);
    TreeSitterParser = ts.default as new () => TreeSitterParser;
    JavaScript = js.default;
    TypeScript = tst.default.typescript;
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

export class JavaScriptParser implements ParserStrategy {
  private jsParser: TreeSitterParser | null = null;
  private tsParser: TreeSitterParser | null = null;

  private async ensureParser(filePath: string): Promise<TreeSitterParser> {
    await ensureLoaded();
    const isTsFile = filePath.endsWith(".ts") || filePath.endsWith(".tsx");
    
    if (isTsFile) {
      if (!this.tsParser) {
        this.tsParser = new TreeSitterParser();
        this.tsParser.setLanguage(TypeScript);
      }
      return this.tsParser;
    } else {
      if (!this.jsParser) {
        this.jsParser = new TreeSitterParser();
        this.jsParser.setLanguage(JavaScript);
      }
      return this.jsParser;
    }
  }

  async parse(filePath: string, content: string): Promise<ParsedFile> {
    const parser = await this.ensureParser(filePath);
    const tree = parser.parse(content);
    const rootNode = tree.rootNode as TreeNode;
    const dependencies: ExtractedDependency[] = [];
    const imports: Set<string> = new Set();
    const sourceModules: string[] = [];
    const definedClasses: string[] = [];
    const definedInterfaces: string[] = [];
    const implementsInterfaces: string[] = [];

    this.extractImports(rootNode, dependencies, imports, sourceModules);
    this.extractClassData(rootNode, definedClasses, implementsInterfaces);
    this.extractInterfaceData(rootNode, definedInterfaces);

    const heuristics: Record<string, boolean> = {};
    const allImports = [...imports, ...sourceModules].map((s) => s.toLowerCase());
    heuristics.isReact = allImports.some((i) => i === "react" || i === "@types/react");
    heuristics.isReactNative = allImports.some((i) => i === "react-native");
    heuristics.isNodejs = allImports.some((i) => i.startsWith("node:"));
    heuristics.hasDefaultExport = this.hasDefaultExport(rootNode);
    heuristics.hasNamedExports = this.hasNamedExports(rootNode);

    return {
      id: filePath,
      relativePath: filePath.split("/").pop() ?? filePath,
      language: "javascript",
      dependencies,
      metadata: {
        sizeBytes: Buffer.byteLength(content, "utf-8"),
        heuristics,
        definedClasses,
        definedInterfaces,
        implementsInterfaces,
      },
    };
  }

  private extractImports(
    node: TreeNode,
    dependencies: ExtractedDependency[],
    imports: Set<string>,
    sourceModules: string[]
  ): void {
    if (node.type === "import_statement") {
      this.extractImportStatement(node, dependencies, imports, sourceModules);
    } else if (node.type === "call_expression" && this.isRequireCall(node)) {
      this.extractRequireCall(node, dependencies, sourceModules);
    }

    for (const child of node.children) {
      this.extractImports(child, dependencies, imports, sourceModules);
    }
  }

  private extractClassData(
    node: TreeNode,
    definedClasses: string[],
    implementsInterfaces: string[]
  ): void {
    if (node.type === "class_declaration") {
      const nameNode = node.childForFieldName("name") || this.getChildByType(node, "type_identifier");
      if (nameNode) {
        definedClasses.push(nameNode.text);
      }
      const classHeritage = node.childForFieldName("heritage") || this.getChildByType(node, "class_heritage");
      if (classHeritage) {
        const implementsClause = classHeritage.childForFieldName("interfaces") || this.getChildByType(classHeritage, "implements_clause");
        if (implementsClause) {
          for (const child of implementsClause.children) {
            if (child.type === "type_identifier" || child.type === "identifier") {
              implementsInterfaces.push(child.text);
            }
          }
        }
      }
    }

    for (const child of node.children) {
      this.extractClassData(child, definedClasses, implementsInterfaces);
    }
  }

  private extractInterfaceData(
    node: TreeNode,
    definedInterfaces: string[]
  ): void {
    if (node.type === "interface_declaration") {
      const nameNode = node.childForFieldName("name") || this.getChildByType(node, "type_identifier");
      if (nameNode) {
        definedInterfaces.push(nameNode.text);
      }
    }

    for (const child of node.children) {
      this.extractInterfaceData(child, definedInterfaces);
    }
  }

  private getChildByType(node: TreeNode, type: string): TreeNode | null {
    for (const child of node.children) {
      if (child.type === type) return child;
    }
    return null;
  }

  private extractImportStatement(
    node: TreeNode,
    dependencies: ExtractedDependency[],
    imports: Set<string>,
    sourceModules: string[]
  ): void {
    const sourceNode = node.childForFieldName("source");
    if (sourceNode && sourceNode.type === "string") {
      const rawSpecifier = sourceNode.text.slice(1, -1);
      sourceModules.push(rawSpecifier);
      dependencies.push({
        rawSpecifier,
        type: "import",
        location: {
          line: node.startPosition.row + 1,
          column: node.startPosition.column + 1,
        },
        resolvedPath: rawSpecifier,
      });
    }

    for (const child of node.children) {
      if (child.type === "import_specifier") {
        const nameNode = child.childForFieldName("name");
        if (nameNode) {
          imports.add(nameNode.text);
        }
      } else if (child.type === "import_default_specifier") {
        const nameNode = child.childForFieldName("name");
        if (nameNode) {
          imports.add(nameNode.text);
        }
      } else if (child.type === "import_namespace_specifier") {
        const nameNode = child.childForFieldName("name");
        if (nameNode) {
          imports.add(nameNode.text);
        }
      }
    }
  }

  private extractRequireCall(
    node: TreeNode,
    dependencies: ExtractedDependency[],
    sourceModules: string[]
  ): void {
    const args = node.childForFieldName("arguments");
    if (args) {
      for (const arg of args.children) {
        if (arg.type === "string") {
          const rawSpecifier = arg.text.slice(1, -1);
          sourceModules.push(rawSpecifier);
          dependencies.push({
            rawSpecifier,
            type: "require",
            location: {
              line: node.startPosition.row + 1,
              column: node.startPosition.column + 1,
            },
            resolvedPath: rawSpecifier,
          });
        }
      }
    }
  }

  private isRequireCall(node: TreeNode): boolean {
    const functionExpr = node.childForFieldName("function");
    if (!functionExpr) return false;

    if (functionExpr.type === "identifier" && functionExpr.text === "require") {
      return true;
    }

    if (functionExpr.type === "member_expression") {
      const object = functionExpr.childForFieldName("object");
      const property = functionExpr.childForFieldName("property");
      if (object?.text === "require" && property?.text === "resolve") {
        return true;
      }
    }

    return false;
  }

  private hasDefaultExport(node: TreeNode): boolean {
    if (node.type === "export_statement") {
      return node.children.some((c) => c.type === "default");
    }
    for (const child of node.children) {
      if (this.hasDefaultExport(child)) return true;
    }
    return false;
  }

  private hasNamedExports(node: TreeNode): boolean {
    if (node.type === "export_clause") return true;
    if (node.type === "export_statement") {
      const hasDefault = node.children.some((c) => c.type === "default");
      if (hasDefault) return false;
      return node.children.some(
        (c) => c.type === "variable_declaration" || c.type === "function_declaration" || c.type === "class_declaration"
      );
    }
    for (const child of node.children) {
      if (this.hasNamedExports(child)) return true;
    }
    return false;
  }
}
