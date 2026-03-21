# repo-graph

A CLI tool to visualize repository dependency graphs by parsing ASTs across multiple languages.

## Features

- **Multi-language support**: JavaScript, TypeScript, Python, Java, and Markdown
- **Smart scanning**: Respects `.gitignore` rules and common build directories
- **Dependency analysis**: Builds a graph of imports and references
- **Multiple outputs**: Terminal summaries, JSON export, and interactive HTML visualization

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# Scan current directory
repo-graph

# Scan specific directory
repo-graph ./path/to/repo

# With verbose output
repo-graph --verbose

# Output formats
repo-graph --format json --output graph.json
repo-graph --format html --output graph.html
```

## Supported Languages

- JavaScript/JSX (.js, .jsx)
- TypeScript/TSX (.ts, .tsx)
- Python (.py)
- Java (.java)
- Markdown (.md)
