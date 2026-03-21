import type { ParserStrategy } from "./types.js";
import { MarkdownParser } from "./strategies/markdown.js";
import { JavaScriptParser } from "./strategies/javascript.js";

const JAVASCRIPT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);

export function createParser(filePath: string): ParserStrategy | null {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();

  if (JAVASCRIPT_EXTENSIONS.has(ext)) {
    return new JavaScriptParser();
  }

  if (MARKDOWN_EXTENSIONS.has(ext)) {
    return new MarkdownParser();
  }

  return null;
}
