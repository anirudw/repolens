import { readFileSync } from "node:fs";
import ignore, { Ignore } from "ignore";

export const DEFAULT_IGNORES = [
  "node_modules",
  "bower_components",
  "dist",
  "build",
  "out",
  "target",
  ".git",
  ".svn",
  ".hg",
  ".DS_Store",
  "Thumbs.db",
  "*.pyc",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".next",
  ".nuxt",
  ".cache",
  ".parcel-cache",
  "coverage",
  ".nyc_output",
  ".turbo",
];

export function createIgnoreRules(rootDir: string): Ignore {
  const ig = ignore();

  for (const pattern of DEFAULT_IGNORES) {
    ig.add(pattern);
  }

  const gitignorePath = `${rootDir}/.gitignore`;
  try {
    const content = readFileSync(gitignorePath, "utf-8");
    const rules = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    ig.add(rules);
  } catch {
    // .gitignore doesn't exist, continue with defaults
  }

  return ig;
}

export function shouldIgnore(
  ig: Ignore,
  relativePath: string,
  isDirectory: boolean
): boolean {
  const pathWithTrailingSlash = isDirectory ? `${relativePath}/` : relativePath;
  return ig.test(pathWithTrailingSlash).ignored;
}
