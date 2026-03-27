import { scanDirectory } from "./src/scanner/index.js";
import { createParser } from "./src/parser/index.js";
import { readFileSync } from "fs";
import { Graph } from "./src/graph/index.js";
import { resolve, dirname } from "path";

const result = scanDirectory({ rootDir: "src/cli", verbose: false });

const parsedFiles = [];
for (const file of result.files) {
  const parser = createParser(file.absolutePath);
  if (parser) {
    const content = readFileSync(file.absolutePath, "utf-8");
    const parsed = await parser.parse(file.absolutePath, content);
    parsedFiles.push(parsed);
  }
}

// Manual test of Graph's resolveImportPath logic
const graph = new (Graph as any)(parsedFiles);

// Manually check resolveImportPath for index.ts -> ./commands.js
const indexFile = parsedFiles.find(p => p.id.includes("index.ts"));
const fromDir = dirname(indexFile.id);
const specifier = "./commands.js";

console.log("Checking isLocalImport for:", specifier);
const isLocal = specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/");
console.log("isLocal:", isLocal);

console.log("\nChecking resolveImportPath:");
const nodes = graph.getNodes();
console.log("Nodes in graph:", Array.from(nodes.keys()));

const candidates = [
  specifier,
  `${specifier}.js`,
  `${specifier}.ts`,
  `${specifier}.jsx`,
  `${specifier}.tsx`,
];

for (const candidate of candidates) {
  const fullPath = resolve(fromDir, candidate);
  const exists = nodes.has(fullPath);
  console.log(`  ${candidate} -> ${fullPath} -> exists: ${exists}`);
}