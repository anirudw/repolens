import { Command } from "commander";
import { readFileSync } from "node:fs";
import { scanDirectory } from "../scanner/index.js";
import { createParser } from "../parser/index.js";
import { Graph, analyzeGraph } from "../graph/index.js";
import type { ParsedFile } from "../parser/types.js";
import type { ScanResult } from "../scanner/walker.js";
import { pc } from "../utils/colors.js";

export function createCommand(): Command {
  const program = new Command();

  program
    .name("repo-graph")
    .description("Visualize repository dependency graphs")
    .version("0.1.0")
    .argument("[path]", "Directory to scan", process.cwd())
    .option("-v, --verbose", "Enable verbose output", false)
    .option(
      "-f, --format <format>",
      "Output format (text, json)",
      "text"
    )
    .option("-o, --output <file>", "Output file path")
    .action(async (path, options) => {
      const scanResult = scanDirectory({ rootDir: path, verbose: options.verbose });

      if (options.verbose) {
        console.log(pc.dim("\nParsing files..."));
      }

      const parsedFiles: ParsedFile[] = [];
      for (const file of scanResult.files) {
        const parser = createParser(file.absolutePath);
        if (parser) {
          try {
            const content = readFileSync(file.absolutePath, "utf-8");
            const parsed = await parser.parse(file.absolutePath, content);
            parsedFiles.push(parsed);
          } catch (err) {
            if (options.verbose) {
              console.warn(`Warning: Failed to parse ${file.relativePath}: ${err}`);
            }
          }
        }
      }

      const graph = new Graph(parsedFiles);
      const rankedNodes = analyzeGraph(graph);

      if (options.format === "json") {
        const output = JSON.stringify(
          {
            scan: scanResult,
            parsed: parsedFiles,
            graph: {
              nodes: graph.getNodes(),
              edges: graph.getEdges(),
            },
            rankedNodes,
          },
          null,
          2
        );
        if (options.output) {
          const { writeFileSync } = await import("node:fs");
          writeFileSync(options.output, output);
          console.log(`Written to ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        printSummary(scanResult, rankedNodes, options.verbose);
      }
    });

  return program;
}

function printSummary(
  result: ScanResult,
  rankedNodes: ReturnType<typeof analyzeGraph>,
  verbose: boolean
): void {
  console.log(pc.bold("\nRepository Scan Summary\n"));
  console.log(`Total files found: ${pc.cyan(result.totalFiles.toString())}`);
  console.log(`Files ignored: ${result.ignoredCount}\n`);

  console.log(pc.bold("Files by language:"));
  const langColors: Record<string, (s: string) => string> = {
    javascript: pc.yellow,
    typescript: pc.blue,
    python: pc.green,
    java: pc.red,
    markdown: pc.magenta,
  };

  for (const [lang, count] of Object.entries(result.filesByLanguage)) {
    if (count > 0) {
      const color = langColors[lang] ?? pc.white;
      console.log(`  ${color(`• ${lang}`)}: ${pc.bold(count.toString())}`);
    }
  }

  const topHubs = rankedNodes.filter((n) => n.inboundEdges > 0).slice(0, 3);
  if (topHubs.length > 0) {
    console.log(pc.bold("\nTop Hubs (Most Connected):"));
    for (const hub of topHubs) {
      const badge = hub.metadata?.heuristics?.isReact ? " [React]" : "";
      console.log(
        `  ${pc.cyan(hub.relativePath)}${badge}: ${pc.bold(hub.inboundEdges.toString())} inbound`
      );
    }
  }

  if (verbose && result.files.length > 0) {
    console.log(pc.bold("\nScanned files:"));
    for (const file of result.files.slice(0, 50)) {
      console.log(`  ${pc.dim(file.relativePath)}`);
    }
    if (result.files.length > 50) {
      console.log(`  ${pc.dim(`... and ${result.files.length - 50} more`)}`);
    }
  }

  console.log();
}
