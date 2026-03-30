# Repolens

[![NPM Version](https://img.shields.io/npm/v/@anirudw/repolens?style=for-the-badge)](https://www.npmjs.com/package/@anirudw/repolens)
[![NPM Downloads](https://img.shields.io/npm/dt/@anirudw/repolens?style=for-the-badge)](https://www.npmjs.com/package/@anirudw/repolens)
[![License](https://img.shields.io/npm/l/@anirudw/repolens?style=for-the-badge)](LICENSE)

Repolens is a repository intelligence CLI that scans source trees and builds a dependency graph to surface architectural signals such as hubs, coupling, instability, and implementation relationships.

It is designed for fast, practical analysis in real-world codebases and currently supports JavaScript, TypeScript, Python, Java, and Markdown.

## Why Repolens

- Identify critical files that many others depend on.
- Spot unstable files likely to create churn.
- Find concrete implementations of an interface or base class.
- Export graph data as JSON for custom dashboards and automation.
- Get a concise repository summary without heavyweight setup.

## Features

- Multi-language scanning using tree-sitter parsing.
- Dependency graph construction and ranking.
- Architectural health report:
	- Top core dependencies by afferent coupling ($Ca$)
	- Top unstable files by instability ($I = \frac{Ce}{Ca + Ce}$)
- Interface implementation lookup via `--implements`.
- JSON export for machine-readable output.
- Verbose mode for parser and scan diagnostics.

## Installation

Install globally from npm:

```bash
npm install -g @anirudw/repolens
```

Verify installation:

```bash
repolens --version
```

## Quick Start

Run in the current directory:

```bash
repolens
```

Run against a specific repository path:

```bash
repolens /path/to/repo
```

Print architectural health metrics:

```bash
repolens /path/to/repo --health
```

Export analysis as JSON:

```bash
repolens /path/to/repo --format json --output repolens-graph.json
```

Find files implementing an interface/base class:

```bash
repolens /path/to/repo --implements ILogger
```

## Command Reference

```text
repolens [path] [options]
```

- `[path]` optional directory to scan (defaults to current working directory)

### Options

- `-v, --verbose` enable verbose output
- `-f, --format <format>` output format: `text` or `json` (default: `text`)
- `-o, --output <file>` output file path for JSON export
- `-i, --implements <interfaceName>` list files implementing an interface/base class
- `--health` print architectural health metrics and exit
- `-V, --version` print CLI version
- `-h, --help` show help

## Example Output

### Summary mode (`repolens`)

```text
Repository Scan Summary
Repository composition and dependency centrality.
--------------------------------------------------------------

Total files found | 182
Files ignored     | 47

Files by Language
Detected source files by parser strategy.
	javascript   | 42
	typescript   | 88
	python       | 16

Top Hubs
Ranked by inbound dependencies.
	01 src/core/router.ts | 19 inbound
	02 src/core/config.ts | 14 inbound
```

### Health mode (`repolens --health`)

```text
Architectural Health Metrics
Dependency pressure and instability hotspots.
--------------------------------------------------------------

Top Core Dependencies
Highest Ca (afferent coupling): changes here can impact the most files
	01 src/core/config.ts       | 14 dependents

Most Unstable Files
Highest I = Ce / (Ca + Ce)
	01 src/features/experiments.ts | 1.000 instability
```

### Implementation Search (`repolens --implements <name>`)

```text
Implementation Search
Interface/Base: ILogger
--------------------------------------------------------------

Found 2 implementation(s)
Files implementing the requested contract
	01 src/loggers/console-logger.ts
	02 src/loggers/file-logger.ts
```

## Supported Languages

- JavaScript: `.js`, `.jsx`, `.mjs`, `.cjs`
- TypeScript: `.ts`, `.tsx`, `.mts`, `.cts`
- Python: `.py`
- Java: `.java`
- Markdown: `.md`, `.markdown`


## Development

Clone and install dependencies:

```bash
npm install
```

Run in dev mode:

```bash
npm run dev -- /path/to/repo --health
```

Build distributable CLI:

```bash
npm run build
```

Run tests:

```bash
npm test -- --run
```

Type check:

```bash
npm run lint
```

## Troubleshooting

- If a global install appears stale, reinstall the latest version:

```bash
npm uninstall -g @anirudw/repolens
npm install -g @anirudw/repolens@latest
```

- Use verbose mode to inspect parse warnings:

```bash
repolens /path/to/repo --verbose
```

- Use `--health` or `--implements` when you want focused output (they exit early by design and do not print summary mode).

## License

MIT. See [LICENSE](LICENSE).