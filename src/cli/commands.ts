import { Command } from "commander";
import { scanDirectory } from "../scanner/index.js";
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
      const result = scanDirectory({ rootDir: path, verbose: options.verbose });

      if (options.format === "json") {
        const output = JSON.stringify(result, null, 2);
        if (options.output) {
          const { writeFileSync } = await import("node:fs");
          writeFileSync(options.output, output);
          console.log(`Written to ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        printSummary(result, options.verbose);
      }
    });

  return program;
}

function printSummary(
  result: ReturnType<typeof scanDirectory>,
  verbose: boolean
): void {
  console.log(pc.bold("\n📊 Repository Scan Summary\n"));
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

  if (verbose && result.files.length > 0) {
    console.log(pc.bold("\n📄 Scanned files:"));
    for (const file of result.files.slice(0, 50)) {
      console.log(`  ${pc.dim(file.relativePath)}`);
    }
    if (result.files.length > 50) {
      console.log(`  ${pc.dim(`... and ${result.files.length - 50} more`)}`);
    }
  }

  console.log();
}
