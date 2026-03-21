# repolens

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
repolens

# Scan specific directory
repolens ./path/to/repo

# With verbose output
repolens --verbose

# Output formats
repolens --format json --output graph.json
repolens --format html --output graph.html
```

## Supported Languages

- JavaScript/JSX (.js, .jsx)
- TypeScript/TSX (.ts, .tsx)
- Python (.py)
- Java (.java)
- Markdown (.md)
