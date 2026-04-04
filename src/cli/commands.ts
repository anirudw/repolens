import { Command } from "commander";
import fs from "node:fs";
import { relative, resolve } from "node:path";
import { scanDirectory } from "../scanner/index.js";
import { createParser } from "../parser/index.js";
import { Graph, analyzeGraph } from "../graph/index.js";
import { exportGraphToJson } from "../renderers/json/exporter.js";
import type { ParsedFile } from "../parser/types.js";
import type { ScanResult } from "../scanner/walker.js";
import { pc } from "../utils/colors.js";
import { CacheManager } from "../cache/CacheManager.js";

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
    .option("--cycles", "Detect circular dependencies and fail CI if any are found")
    .option("--health", "Display architectural health metrics and identify unstable files")
    .action(async (path, options) => {
      const runStart = Date.now();
      const scanRoot = resolve(path);
      const scanResult = scanDirectory({ rootDir: path, verbose: options.verbose });

      if (options.verbose) {
        console.log(pc.dim("\nParsing files..."));
      }

      const cache = new CacheManager(scanRoot);
      cache.load();
      cache.prune(scanResult.files.map((file) => file.absolutePath));

      const parsedFiles: ParsedFile[] = [];
      for (const file of scanResult.files) {
        const mtimeMs = fs.statSync(file.absolutePath).mtimeMs;
        const cachedParsedFile = cache.get(file.absolutePath, mtimeMs) as ParsedFile | null;
        if (cachedParsedFile) {
          parsedFiles.push(cachedParsedFile);
          continue;
        }

        const parser = createParser(file.absolutePath);
        if (parser) {
          try {
            const content = fs.readFileSync(file.absolutePath, "utf-8");
            const parsed = await parser.parse(file.absolutePath, content);
            cache.set(file.absolutePath, mtimeMs, parsed);
            parsedFiles.push(parsed);
          } catch (err) {
            if (options.verbose) {
              console.warn(`Warning: Failed to parse ${file.relativePath}: ${err}`);
            }
          }
        }
      }

      cache.save();

      const graph = new Graph(parsedFiles);
      const rankedNodes = analyzeGraph(graph);
      graph.calculateHealthMetrics();

      if (options.cycles) {
        const cycles = graph.detectCycles();

        if (cycles.length === 0) {
          console.log(pc.green("No circular dependencies detected."));
          process.exit(0);
        }

        console.log(pc.red(`Found ${cycles.length} circular dependencies.`));
        console.log();

        for (const cycle of cycles) {
          console.log(formatCyclePath(cycle));
        }

        process.exit(1);
      }

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

        printHealthHeader();

        if (topCoreDeps.length > 0) {
          printHealthSection(
            "Top Core Dependencies",
            "Highest Ca (afferent coupling): changes here can impact the most files",
            topCoreDeps.map((node) => ({ path: node.relativePath, value: node.ca.toString(), unit: "dependents" })),
            pc.red
          );
        }

        if (topUnstable.length > 0) {
          printHealthSection(
            "Most Unstable Files",
            "Highest I = Ce / (Ca + Ce)",
            topUnstable.map((node) => ({ path: node.relativePath, value: node.instability.toFixed(3), unit: "instability" })),
            pc.yellow
          );
        }

        printElapsedTime(runStart);
        process.exit(0);
      }

      if (options.implements) {
        const registry = graph.getImplementationRegistry();
        const implementations = registry[options.implements] || [];
        const displayPaths = implementations.map((filePath) => {
          const relToScanRoot = relative(scanRoot, filePath);
          if (relToScanRoot && !relToScanRoot.startsWith("..")) {
            return relToScanRoot;
          }

          const relToCwd = relative(process.cwd(), filePath);
          return relToCwd || filePath;
        });

        printImplementsHeader(options.implements);

        if (displayPaths.length === 0) {
          console.log(pc.yellow("No implementations found in this repository."));
          console.log();
        } else {
          printListSection(
            `Found ${displayPaths.length} implementation(s)`,
            "Files implementing the requested contract",
            displayPaths,
            pc.cyan
          );
        }
        printElapsedTime(runStart);
        process.exit(0);
      }

      if (options.format === "json") {
        const outputPath = options.output ?? resolve(process.cwd(), "repolens-graph.json");
        await exportGraphToJson(graph, parsedFiles, outputPath);
        console.log(`Graph exported to ${outputPath}`);
      } else {
        printSummary(scanResult, rankedNodes, options.verbose);
      }

      printElapsedTime(runStart);
    });

  return program;
}

function printElapsedTime(runStart: number): void {
  const elapsedSeconds = (Date.now() - runStart) / 1000;
  console.log(pc.dim(`Completed in ${elapsedSeconds.toFixed(2)}s`));
}

function formatCyclePath(cycle: string[]): string {
  return cycle
    .map((nodeId, index) => {
      const fileName = nodeId.split(/[\\/]/).pop() ?? nodeId;
      const coloredFile = pc.cyan(fileName);

      if (index === cycle.length - 1) {
        return coloredFile;
      }

      return `${coloredFile} ${pc.yellow("->")}`;
    })
    .join(" ")
    .trim();
}

function printSummary(
  result: ScanResult,
  rankedNodes: ReturnType<typeof analyzeGraph>,
  verbose: boolean
): void {
  printScanSummaryHeader();
  printMetricRows([
    { label: "Total files found", value: result.totalFiles.toString(), color: pc.cyan },
    { label: "Files ignored", value: result.ignoredCount.toString() },
  ]);
  console.log();

  console.log(pc.bold("Files by Language"));
  console.log(pc.dim("Detected source files by parser strategy."));
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
      console.log(`  ${color(lang.padEnd(12))} ${pc.dim("|")} ${pc.bold(count.toString())}`);
    }
  }
  console.log();

  const topHubs = rankedNodes.filter((n) => n.inboundEdges > 0).slice(0, 3);
  if (topHubs.length > 0) {
    printListSection(
      "Top Hubs",
      "Ranked by inbound dependencies.",
      topHubs.map((hub) => {
        const badge = hub.metadata?.heuristics?.isReact ? " [React]" : "";
        return `${hub.relativePath}${badge} ${pc.dim("|")} ${hub.inboundEdges} inbound`;
      }),
      pc.cyan
    );
  }

  if (verbose && result.files.length > 0) {
    printListSection(
      "Scanned Files",
      "First 50 scanned files (verbose mode).",
      result.files.slice(0, 50).map((file) => file.relativePath),
      pc.dim
    );
    if (result.files.length > 50) {
      console.log(`  ${pc.dim(`... and ${result.files.length - 50} more`)}`);
      console.log();
    }
  }

  console.log();
}

type HealthDisplayRow = {
  path: string;
  value: string;
  unit: string;
};

function printHealthHeader(): void {
  console.log();
  console.log(pc.bold("Architectural Health Metrics"));
  // console.log(pc.dim("Dependency pressure and instability hotspots."));
  // console.log(pc.dim("-".repeat(62)));
  console.log();
}

function printScanSummaryHeader(): void {
  console.log();
  console.log(pc.bold("Repository Scan Summary"));
  console.log(pc.dim("Repository composition and dependency centrality."));
  console.log(pc.dim("-".repeat(62)));
  console.log();
}

function printImplementsHeader(interfaceName: string): void {
  console.log();
  console.log(pc.bold("Implementation Search"));
  console.log(`${pc.dim("Interface/Base")}: ${pc.cyan(interfaceName)}`);
  console.log(pc.dim("-".repeat(62)));
  console.log();
}

function printMetricRows(
  rows: Array<{ label: string; value: string; color?: (value: string) => string }>
): void {
  const labelWidth = Math.max(...rows.map((row) => row.label.length));
  for (const row of rows) {
    const value = row.color ? row.color(row.value) : pc.bold(row.value);
    console.log(`${pc.dim(row.label.padEnd(labelWidth))} ${pc.dim("|")} ${value}`);
  }
}

function printListSection(
  title: string,
  subtitle: string,
  rows: string[],
  colorizeRow: (value: string) => string
): void {
  console.log(pc.bold(title));
  console.log(pc.dim(subtitle));
  for (const [index, row] of rows.entries()) {
    const rank = `${index + 1}`.padStart(2, "0");
    console.log(`  ${pc.dim(rank)} ${colorizeRow(row)}`);
  }
  console.log();
}

function printHealthSection(
  title: string,
  subtitle: string,
  rows: HealthDisplayRow[],
  colorizePath: (value: string) => string
): void {
  console.log(pc.bold(title));
  console.log(pc.dim(subtitle));

  const displayRows = rows.map((row) => ({
    ...row,
    path: truncateMiddle(row.path, 56),
  }));

  const pathWidth = Math.max(
    24,
    ...displayRows.map((row) => row.path.length)
  );

  for (const [index, row] of displayRows.entries()) {
    const rank = `${index + 1}`.padStart(2, "0");
    console.log(
      `  ${pc.dim(rank)} ${colorizePath(row.path.padEnd(pathWidth))} ${pc.dim("|")} ${pc.bold(row.value)} ${pc.dim(row.unit)}`
    );
  }

  console.log();
}

function truncateMiddle(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;

  const keep = maxLen - 3;
  const left = Math.ceil(keep / 2);
  const right = Math.floor(keep / 2);
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}
