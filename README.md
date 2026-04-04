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
- Circular dependency detection via `--cycles` (CI-friendly exit codes).
- Architectural health report:
	- Top core dependencies by afferent coupling ($Ca$)
	- Top unstable files by instability ($I = \frac{Ce}{Ca + Ce}$)
- Interface implementation lookup via `--implements`.
- Persistent parse caching with automatic stale-entry pruning.
- JSON export for machine-readable output.
- Runtime indicator at command completion (seconds).
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

Check for circular dependencies (fails with exit code 1 if any are found):

```bash
repolens /path/to/repo --cycles
```

Use this mode in CI to fail builds when circular dependencies are introduced.

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
- `--cycles` detect circular dependencies and exit non-zero when cycles exist
- `--health` print architectural health metrics and exit
- `-V, --version` print CLI version
- `-h, --help` show help

## Example Output

#### Outputs after I ran `repolens` on nest repository of nestjs (https://github.com/nestjs/nest.git`)

### Summary mode (`repolens`)

<img width="842" height="576" alt="s1" src="https://github.com/user-attachments/assets/5d4f7ec6-91e7-44ca-bc89-f6e210f70711" />


### Health mode (`repolens --health`)

<img width="953" height="474" alt="s2" src="https://github.com/user-attachments/assets/d95e5b33-fd0b-4fa0-82d6-ca3cf69da32a" />


### Implementation Search (`repolens --implements <name>`)

<img width="1110" height="604" alt="s3" src="https://github.com/user-attachments/assets/58746a57-ee89-41a1-936b-3fdd34a3a353" />

### Circular Dependency Check (`repolens --cycles`)

```text
Found 1 circular dependencies.

a.ts -> b.ts -> c.ts -> a.ts
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
npm run test
```

Type check:

```bash
npm run lint
```

## Caching Behavior

Repolens stores parsed-file metadata in `.repolens-cache.json` at the scanned repository root.

- Cache hit: same file path and unchanged mtime reuse prior parse output.
- Cache miss: changed mtime triggers re-parse.
- Stale cleanup: entries for files no longer in the scan set are pruned automatically.
- Repository isolation: each scanned repo has its own independent cache file.

Practical expectation: the first run on a large repository is slower, while repeated runs on unchanged files are significantly faster due to cache hits.

## Exit Codes

- `repolens --cycles`: exits `0` when no cycles are found, exits `1` when cycles are detected.
- Other modes return normal CLI success/failure behavior.

## CI Integration (GitHub Actions)

Use `--cycles` in pull-request checks to prevent new circular dependencies:

```yaml
name: RepoLens Cycles Check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  cycles:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: node dist/index.js . --cycles
```

This job fails automatically when the cycle check exits with code `1`.

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
