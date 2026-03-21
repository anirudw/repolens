import type { ParserStrategy } from "./types.js";
import { MarkdownParser } from "./strategies/markdown.js";
import { JavaScriptParser } from "./strategies/javascript.js";
import { PythonParser } from "./strategies/python.js";
import { JavaParser } from "./strategies/java.js";

const JAVASCRIPT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const PYTHON_EXTENSIONS = new Set([".py"]);
const JAVA_EXTENSIONS = new Set([".java"]);

export function createParser(filePath: string): ParserStrategy | null {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();

  if (JAVASCRIPT_EXTENSIONS.has(ext)) {
    return new JavaScriptParser();
  }

  if (MARKDOWN_EXTENSIONS.has(ext)) {
    return new MarkdownParser();
  }

  if (PYTHON_EXTENSIONS.has(ext)) {
    return new PythonParser();
  }

  if (JAVA_EXTENSIONS.has(ext)) {
    return new JavaParser();
  }

  return null;
}
