import fs from "fs";
import path from "path";

type CacheEntry = {
	mtimeMs: number;
	metadata: any;
};

type CacheData = Record<string, CacheEntry>;

export class CacheManager {
	private readonly cacheFilePath: string;
	private cache: CacheData;

	constructor(workspaceRoot: string) {
		this.cacheFilePath = path.join(workspaceRoot, ".repolens-cache.json");
		this.cache = {};
	}

	load(): void {
		if (!fs.existsSync(this.cacheFilePath)) {
			this.cache = {};
			return;
		}

		try {
			const raw = fs.readFileSync(this.cacheFilePath, "utf-8");
			const parsed = JSON.parse(raw);
			this.cache = parsed && typeof parsed === "object" ? (parsed as CacheData) : {};
		} catch {
			this.cache = {};
		}
	}

	get(filePath: string, currentMtimeMs: number): any | null {
		const entry = this.cache[filePath];
		if (!entry || entry.mtimeMs !== currentMtimeMs) {
			return null;
		}

		return entry.metadata;
	}

	set(filePath: string, mtimeMs: number, metadata: any): void {
		this.cache[filePath] = { mtimeMs, metadata };
	}

	prune(validFilePaths: Iterable<string>): void {
		const valid = new Set(validFilePaths);
		for (const cachedPath of Object.keys(this.cache)) {
			if (!valid.has(cachedPath)) {
				delete this.cache[cachedPath];
			}
		}
	}

	save(): void {
		fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.cache, null, 2), "utf-8");
	}
}
