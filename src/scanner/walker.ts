import { readdirSync, statSync } from "node:fs";
import { join, relative, isAbsolute, resolve } from "node:path";
import { createIgnoreRules, shouldIgnore } from "./ignore.js";
import {
  isTargetLanguage,
  SupportedLanguage,
  getLanguageFromPath,
} from "./file-types.js";

export interface ScannedFile {
  path: string;
  absolutePath: string;
  relativePath: string;
  language: SupportedLanguage;
}

export interface ScanResult {
  files: ScannedFile[];
  totalFiles: number;
  filesByLanguage: Record<SupportedLanguage, number>;
  ignoredCount: number;
}

export interface ScanOptions {
  rootDir: string;
  verbose?: boolean;
}

export function scanDirectory(options: ScanOptions): ScanResult {
  const { rootDir, verbose = false } = options;
  const absoluteRoot = isAbsolute(rootDir) ? rootDir : resolve(rootDir);

  if (verbose) {
    console.log(`Scanning directory: ${absoluteRoot}`);
  }

  const ig = createIgnoreRules(absoluteRoot);
  const files: ScannedFile[] = [];
  let ignoredCount = 0;

  function walk(dir: string, baseDir: string = dir): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch (err) {
      if (verbose) {
        console.warn(`Warning: Cannot read directory ${dir}: ${err}`);
      }
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = relative(baseDir, fullPath);

      let isDir: boolean;
      try {
        isDir = statSync(fullPath).isDirectory();
      } catch (err) {
        if (verbose) {
          console.warn(`Warning: Cannot stat ${fullPath}: ${err}`);
        }
        continue;
      }

      if (shouldIgnore(ig, relativePath, isDir)) {
        if (!isDir) {
          ignoredCount++;
        }
        continue;
      }

      if (isDir) {
        walk(fullPath, baseDir);
      } else {
        if (isTargetLanguage(entry)) {
          files.push({
            path: entry,
            absolutePath: fullPath,
            relativePath: normalizePath(relativePath),
            language: getLanguageFromFile(entry),
          });
        }
      }
    }
  }

  walk(absoluteRoot);

  const filesByLanguage = countByLanguage(files);

  if (verbose) {
    console.log(`Found ${files.length} target files`);
    for (const [lang, count] of Object.entries(filesByLanguage)) {
      if (count > 0) {
        console.log(`  ${lang}: ${count}`);
      }
    }
  }

  return {
    files,
    totalFiles: files.length,
    filesByLanguage,
    ignoredCount,
  };
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function getLanguageFromFile(filePath: string): SupportedLanguage {
  return getLanguageFromPath(filePath);
}

function countByLanguage(
  files: ScannedFile[]
): Record<SupportedLanguage, number> {
  const counts: Partial<Record<SupportedLanguage, number>> = {};
  for (const file of files) {
    counts[file.language] = (counts[file.language] ?? 0) + 1;
  }
  return counts as Record<SupportedLanguage, number>;
}
