# Repolens

**A cross-platform, multi-lingual repository intelligence CLI.**

Repolens analyzes your codebase using tree-sitter ASTs to map dependency networks, identify architectural pillars, and calculate coupling metrics.

[![NPM Version](https://img.shields.io/npm/v/@anirudw/repolens)](https://www.npmjs.com/package/@anirudw/repolens)
[![License](https://img.shields.io/npm/l/@anirudw/repolens)](LICENSE)

## Install

```bash
npm install -g @anirudw/repolens
```

## Quick Start

```bash
# Analyze a repository
repolens ./my-project

# Export dependency graph
repolens ./my-project --format json --output graph.json

# Find implementations of an interface
repolens ./my-project --implements ILogger

# View architectural health metrics
repolens ./my-project --health
```

## Options

| Flag | Description |
|------|-------------|
| `-v, --verbose` | Enable verbose output |
| `-f, --format` | Output format: `text` (default) or `json` |
| `-o, --output <file>` | Output file path |
| `-i, --implements <name>` | Find files implementing an interface |
| `--health` | Display architectural health metrics |

## Features

- **Multi-lingual AST parsing** — JavaScript, TypeScript, Python, Java, Markdown
- **Path resolution** — Automatically resolves local imports
- **PageRank centrality** — Identifies the most relied-upon files
- **Entry-point detection** — Flags critical entry points
- **Interface registry** — Track class/interface relationships
- **Health metrics** — Coupling (Ca, Ce) and instability (I)

## Health Metrics

The `--health` flag calculates coupling metrics:

- **Ca (Afferent Coupling)** — Files that depend on this file
- **Ce (Efferent Coupling)** — Files this file depends on
- **Instability** — `I = Ce / (Ca + Ce)`

| Value | Meaning |
|-------|---------|
| ~0 | Stable core dependency |
| ~1 | Highly unstable (fragile) |

## License

MIT
