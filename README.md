# repolens

![NPM Version](https://img.shields.io/npm/v/@anirudw/repolens?color=blue&style=for-the-badge)
![NPM Downloads](https://img.shields.io/npm/dt/@anirudw/repolens?style=for-the-badge)
![License](https://img.shields.io/npm/l/@anirudw/repolens?style=for-the-badge)

**A cross-platform, multi-lingual repository intelligence CLI.**

Repolens analyzes your codebase using native C++ Abstract Syntax Trees (ASTs) to map out dependency networks, resolve local imports, and run PageRank algorithms to identify the architectural pillars of your project.

## Features

* **Multi-Lingual AST Parsing:** Uses `tree-sitter` to deeply understand JavaScript, TypeScript, Python, Java, and Markdown.
* **Intelligent Path Resolution:** Automatically resolves complex, extensionless local imports into absolute file paths.
* **PageRank Centrality:** Calculates inbound and outbound connection graphs to identify the most heavily relied-upon "Hub" files in your repository.
* **Entry-Point Detection:** Uses language-specific heuristics (e.g., `__name__ == "__main__"`, `public static void main`, React imports) to flag critical entry points.
* **JSON Export:** Dump your entire repository graph to disk for external visualization or CI/CD integrations.
* **Safe Scanning:** Automatically respects `.gitignore` and safely skips `node_modules` and `.git` directories.

---

## Installation

You can run Repolens on-demand using `npx`, or install it globally to use it as a daily driver.

**Global Installation (Recommended):**
```bash
npm install -g @anirudw/repolens
