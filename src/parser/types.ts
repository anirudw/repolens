export interface ExtractedDependency {
  rawSpecifier: string;
  type: 'import' | 'require' | 'export' | 'markdown-link' | 'wikilink';
  location: { line: number; column: number };
  resolvedPath: string | null;
}

export interface ParsedFile {
  id: string;
  relativePath: string;
  language: string;
  dependencies: ExtractedDependency[];
  metadata: { sizeBytes: number; heuristics: Record<string, boolean> };
}

export interface ParserStrategy {
  parse(filePath: string, content: string): Promise<ParsedFile>;
}
