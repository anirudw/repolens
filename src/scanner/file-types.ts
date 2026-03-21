export enum SupportedLanguage {
  JavaScript = "javascript",
  TypeScript = "typescript",
  Python = "python",
  Java = "java",
  Markdown = "markdown",
  Unknown = "unknown",
}

export const LANGUAGE_EXTENSIONS: Record<SupportedLanguage, string[]> = {
  [SupportedLanguage.JavaScript]: [".js", ".jsx", ".mjs", ".cjs"],
  [SupportedLanguage.TypeScript]: [".ts", ".tsx", ".mts", ".cts"],
  [SupportedLanguage.Python]: [".py"],
  [SupportedLanguage.Java]: [".java"],
  [SupportedLanguage.Markdown]: [".md", ".markdown"],
  [SupportedLanguage.Unknown]: [],
};

export const EXTENSION_TO_LANGUAGE: Map<string, SupportedLanguage> = new Map();

for (const [lang, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
  if (lang !== SupportedLanguage.Unknown) {
    for (const ext of extensions) {
      EXTENSION_TO_LANGUAGE.set(ext, lang as SupportedLanguage);
    }
  }
}

export function getLanguageFromPath(filePath: string): SupportedLanguage {
  const ext = getExtension(filePath);
  return EXTENSION_TO_LANGUAGE.get(ext) ?? SupportedLanguage.Unknown;
}

export function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filePath.slice(lastDot);
}

export function isTargetLanguage(filePath: string): boolean {
  return getLanguageFromPath(filePath) !== SupportedLanguage.Unknown;
}
