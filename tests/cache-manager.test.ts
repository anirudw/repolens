import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CacheManager } from "../src/cache/CacheManager";

const tempDirs: string[] = [];

function createTempWorkspace(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("CacheManager", () => {
  it("returns cached metadata when mtime matches", () => {
    const workspace = createTempWorkspace("repolens-cache-hit-");
    const filePath = join(workspace, "src", "index.ts");
    const mtimeMs = 123456;
    const metadata = { id: "file", deps: ["./a"] };

    const writer = new CacheManager(workspace);
    writer.load();
    writer.set(filePath, mtimeMs, metadata);
    writer.save();

    const reader = new CacheManager(workspace);
    reader.load();

    expect(reader.get(filePath, mtimeMs)).toEqual(metadata);
  });

  it("returns null when mtime changes", () => {
    const workspace = createTempWorkspace("repolens-cache-miss-");
    const filePath = join(workspace, "src", "index.ts");

    const cache = new CacheManager(workspace);
    cache.load();
    cache.set(filePath, 1000, { parsed: true });
    cache.save();

    const reader = new CacheManager(workspace);
    reader.load();

    expect(reader.get(filePath, 2000)).toBeNull();
  });

  it("falls back to empty cache when cache file is invalid JSON", () => {
    const workspace = createTempWorkspace("repolens-cache-invalid-");
    const cachePath = join(workspace, ".repolens-cache.json");
    writeFileSync(cachePath, "{ invalid json", "utf-8");

    const cache = new CacheManager(workspace);
    cache.load();

    expect(cache.get("any-file", 1)).toBeNull();
  });

  it("uses isolated cache files per repository root", () => {
    const repoA = createTempWorkspace("repolens-repo-a-");
    const repoB = createTempWorkspace("repolens-repo-b-");
    const fileInA = join(repoA, "src", "a.ts");
    const mtimeMs = 777;
    const metadata = { repo: "A" };

    const cacheA = new CacheManager(repoA);
    cacheA.load();
    cacheA.set(fileInA, mtimeMs, metadata);
    cacheA.save();

    const cacheB = new CacheManager(repoB);
    cacheB.load();

    expect(cacheB.get(fileInA, mtimeMs)).toBeNull();
  });

  it("removes stale entries when prune is called", () => {
    const workspace = createTempWorkspace("repolens-cache-prune-");
    const liveFile = join(workspace, "src", "live.ts");
    const staleFile = join(workspace, "src", "stale.ts");

    const writer = new CacheManager(workspace);
    writer.load();
    writer.set(liveFile, 1, { name: "live" });
    writer.set(staleFile, 1, { name: "stale" });
    writer.save();

    const reader = new CacheManager(workspace);
    reader.load();
    reader.prune([liveFile]);
    reader.save();

    const verifier = new CacheManager(workspace);
    verifier.load();

    expect(verifier.get(liveFile, 1)).toEqual({ name: "live" });
    expect(verifier.get(staleFile, 1)).toBeNull();
  });
});