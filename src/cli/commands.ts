import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanDirectory } from "../scanner/index.js";
import { createParser } from "../parser/index.js";
import { Graph, analyzeGraph } from "../graph/index.js";
import { exportGraphToJson } from "../renderers/json/exporter.js";
import type { ParsedFile } from "../parser/types.js";
import type { ScanResult } from "../scanner/walker.js";
import { pc } from "../utils/colors.js";

export function createCommand(): Command {
  const program = new Command();

  program
    .name("repolens")
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
    .option("-i, --implements <interfaceName>", "Find all files implementing a specific interface or base class")
    .option("--health", "Display architectural health metrics and identify unstable files")
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
      graph.calculateHealthMetrics();

      if (options.health) {
        const nodes = Array.from(graph.getNodes().values());

        const topCoreDeps = nodes
          .sort((a, b) => b.ca - a.ca)
          .slice(0, 5)
          .filter(n => n.ca > 0);

        const topUnstable = nodes
          .sort((a, b) => b.instability - a.instability)
          .slice(0, 5)
          .filter(n => n.instability > 0);

        console.log(pc.bold("\n=== Architectural Health Metrics ===\n"));

        if (topCoreDeps.length > 0) {
          console.log(pc.bold("Top 5 Core Dependencies (Highest Ca - will break most things if changed):"));
          for (const node of topCoreDeps) {
            console.log(`  ${pc.red(node.relativePath)}: ${pc.bold(node.ca.toString())} dependents`);
          }
          console.log();
        }

        if (topUnstable.length > 0) {
          console.log(pc.bold("Top 5 Most Unstable Files (Highest I = Ce/(Ca+Ce)):"));
          for (const node of topUnstable) {
            console.log(`  ${pc.yellow(node.relativePath)}: ${pc.bold(node.instability.toFixed(3))} instability`);
          }
          console.log();
        }

        process.exit(0);
      }

      if (options.implements) {
        const registry = graph.getImplementationRegistry();
        const implementations = registry[options.implements] || [];

        console.log(pc.bold(`\nSearching for implementations of: ${pc.cyan(options.implements)}`));

        if (implementations.length === 0) {
          console.log(pc.yellow(`\nNo implementations found for ${options.implements} in this repository.`));
        } else {
          console.log(pc.green(`\nFound ${implementations.length} implementation(s):`));
          for (const file of implementations) {
            console.log(`  ${pc.dim(file)}`);
          }
        }
        process.exit(0);
      }

      if (options.format === "json") {
        const outputPath = options.output ?? resolve(process.cwd(), "repolens-graph.json");
        await exportGraphToJson(graph, parsedFiles, outputPath);
        console.log(`Graph exported to ${outputPath}`);
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
