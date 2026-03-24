import type { ParserStrategy, ExtractedDependency, ParsedFile } from "../types.js";

type TreeSitterParser = {
  parse(content: string): { rootNode: TreeNode };
  setLanguage(lang: unknown): void;
};

let TreeSitterParser: new () => TreeSitterParser;
let Java: unknown;

async function ensureLoaded(): Promise<void> {
  if (!TreeSitterParser) {
    const [ts, j] = await Promise.all([
      import("tree-sitter"),
      import("tree-sitter-java"),
    ]);
    TreeSitterParser = ts.default as new () => TreeSitterParser;
    Java = j.default;
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

export class JavaParser implements ParserStrategy {
  private parser: TreeSitterParser | null = null;

  private async ensureParser(): Promise<TreeSitterParser> {
    if (!this.parser) {
      await ensureLoaded();
      this.parser = new TreeSitterParser();
      this.parser.setLanguage(Java);
    }
    return this.parser;
  }

  async parse(filePath: string, content: string): Promise<ParsedFile> {
    const parser = await this.ensureParser();
    const tree = parser.parse(content);
    const rootNode = tree.rootNode as TreeNode;
    const dependencies: ExtractedDependency[] = [];
    const heuristics: Record<string, boolean> = {};
    const definedClasses: string[] = [];
    const definedInterfaces: string[] = [];
    const implementsInterfaces: string[] = [];

    this.extractImports(rootNode, dependencies);
    this.extractClassData(rootNode, definedClasses, implementsInterfaces);
    this.extractInterfaceData(rootNode, definedInterfaces);
    heuristics.hasMainMethod = this.detectMainMethod(rootNode);

    return {
      id: filePath,
      relativePath: filePath.split("/").pop() ?? filePath,
      language: "java",
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

  private extractImports(node: TreeNode, dependencies: ExtractedDependency[]): void {
    if (node.type === "import_declaration") {
      const importText = this.getScopedIdentifierText(node);
      if (importText) {
        dependencies.push({
          rawSpecifier: importText,
          type: "import",
          location: {
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
          },
          resolvedPath: importText,
        });
      }
    }

    for (const child of node.children) {
      this.extractImports(child, dependencies);
    }
  }

  private extractClassData(
    node: TreeNode,
    definedClasses: string[],
    implementsInterfaces: string[]
  ): void {
    if (node.type === "class_declaration") {
      const nameNode = this.getChildByType(node, "identifier");
      if (nameNode) {
        definedClasses.push(nameNode.text);
      }
      const interfaces = node.childForFieldName("interfaces");
      if (interfaces) {
        const typeList = this.getChildByType(interfaces, "type_list");
        if (typeList) {
          for (const child of typeList.children) {
            if (child.type === "type_identifier" || child.type === "identifier") {
              implementsInterfaces.push(child.text);
            } else if (child.type === "scoped_identifier") {
              implementsInterfaces.push(this.getScopedIdentifierText(child));
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
      const nameNode = this.getChildByType(node, "identifier");
      if (nameNode) {
        definedInterfaces.push(nameNode.text);
      }
    }

    for (const child of node.children) {
      this.extractInterfaceData(child, definedInterfaces);
    }
  }

  private detectMainMethod(node: TreeNode): boolean {
    if (node.type === "method_declaration") {
      const nameNode = this.getChildByType(node, "identifier");
      const modifiersNode = this.getChildByType(node, "modifiers");

      if (nameNode?.text === "main") {
        if (modifiersNode) {
          const modifierTexts = this.getModifierTexts(modifiersNode);
          if (modifierTexts.includes("public") && modifierTexts.includes("static")) {
            return true;
          }
        }
      }
    }

    for (const child of node.children) {
      if (this.detectMainMethod(child)) {
        return true;
      }
    }

    return false;
  }

  private getChildByType(node: TreeNode, type: string): TreeNode | null {
    for (const child of node.children) {
      if (child.type === type) return child;
    }
    return null;
  }

  private getModifierTexts(node: TreeNode): string[] {
    const modifiers: string[] = [];
    for (const child of node.children) {
      if (child.type === "public" || child.type === "private" || child.type === "protected" ||
          child.type === "static" || child.type === "final" || child.type === "abstract" ||
          child.type === "synchronized" || child.type === "volatile" || child.type === "transient" ||
          child.type === "native" || child.type === "strictfp") {
        modifiers.push(child.text);
      } else if (child.type === "annotation" || child.type === "identifier") {
        modifiers.push(child.text);
      }
    }
    return modifiers;
  }

  private getScopedIdentifierText(node: TreeNode): string {
    for (const child of node.children) {
      if (child.type === "scoped_identifier") {
        const parts: string[] = [];
        this.collectIdentifiers(child, parts);
        return parts.join(".");
      } else if (child.type === "identifier") {
        return child.text;
      }
    }
    return "";
  }

  private collectIdentifiers(node: TreeNode, parts: string[]): void {
    for (const child of node.children) {
      if (child.type === "identifier") {
        parts.push(child.text);
      } else if (child.type === "scoped_identifier") {
        this.collectIdentifiers(child, parts);
      }
    }
  }
}
