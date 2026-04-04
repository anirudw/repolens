import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Graph } from '../src/graph/network';
import type { ParsedFile } from '../src/parser/types';
import { exportGraphToJson } from '../src/renderers/json/exporter';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

function createFakeParsedFile(overrides: Partial<ParsedFile> = {}): ParsedFile {
  return {
    id: 'test/file.ts',
    relativePath: 'test/file.ts',
    language: 'typescript',
    dependencies: [],
    metadata: {
      sizeBytes: 100,
      heuristics: {},
      definedClasses: [],
      definedInterfaces: [],
      implementsInterfaces: [],
      ...overrides.metadata,
    },
    ...overrides,
  };
}

describe('Graph - Implementation Registry Plumbing', () => {
  it('should track interface implementations in registry', () => {
    const fakeFiles: ParsedFile[] = [
      createFakeParsedFile({
        id: 'src/Auth.ts',
        metadata: {
          sizeBytes: 500,
          heuristics: {},
          definedClasses: ['AuthService'],
          definedInterfaces: ['IUserAuth'],
          implementsInterfaces: ['IUserAuth'],
        },
      }),
      createFakeParsedFile({
        id: 'src/User.ts',
        metadata: {
          sizeBytes: 300,
          heuristics: {},
          definedClasses: ['UserService'],
          definedInterfaces: ['IUserAuth'],
          implementsInterfaces: ['IUserAuth'],
        },
      }),
    ];

    const graph = new Graph(fakeFiles);
    const registry = graph.getImplementationRegistry();

    expect(registry).toHaveProperty('IUserAuth');
    expect(registry['IUserAuth']).toContain('src/Auth.ts');
    expect(registry['IUserAuth']).toContain('src/User.ts');
  });

  it('should handle multiple interfaces on one class', () => {
    const fakeFiles: ParsedFile[] = [
      createFakeParsedFile({
        id: 'src/Service.ts',
        metadata: {
          sizeBytes: 200,
          heuristics: {},
          implementsInterfaces: ['ILogger', 'IDatabase', 'ICache'],
        },
      }),
    ];

    const graph = new Graph(fakeFiles);
    const registry = graph.getImplementationRegistry();

    expect(Object.keys(registry)).toHaveLength(3);
    expect(registry['ILogger']).toContain('src/Service.ts');
    expect(registry['IDatabase']).toContain('src/Service.ts');
    expect(registry['ICache']).toContain('src/Service.ts');
  });

  it('should return empty registry when no implementations', () => {
    const fakeFiles: ParsedFile[] = [
      createFakeParsedFile({
        id: 'src/Utils.ts',
        metadata: {
          sizeBytes: 100,
          heuristics: {},
        },
      }),
    ];

    const graph = new Graph(fakeFiles);
    const registry = graph.getImplementationRegistry();

    expect(Object.keys(registry)).toHaveLength(0);
  });

  it('should return clean object from getImplementationRegistry', () => {
    const fakeFiles: ParsedFile[] = [
      createFakeParsedFile({
        id: 'src/Auth.ts',
        metadata: {
          sizeBytes: 500,
          heuristics: {},
          implementsInterfaces: ['IUserAuth'],
        },
      }),
    ];

    const graph = new Graph(fakeFiles);
    const registry = graph.getImplementationRegistry();

    expect(typeof registry).toBe('object');
    expect(Array.isArray(registry)).toBe(false);
    expect(registry).toEqual(expect.any(Object));
  });

  it('should detect cycles in the graph', () => {
    const baseDir = resolve('tests/fixtures/temp/cycle-graph');
    const fakeFiles: ParsedFile[] = [
      createFakeParsedFile({
        id: resolve(baseDir, 'A.ts'),
        relativePath: 'A.ts',
        metadata: { sizeBytes: 100, heuristics: {}, definedClasses: [], definedInterfaces: [], implementsInterfaces: [] },
        dependencies: [{ rawSpecifier: './B', type: 'import', location: { line: 1, column: 1 } } as any],
      }),
      createFakeParsedFile({
        id: resolve(baseDir, 'B.ts'),
        relativePath: 'B.ts',
        metadata: { sizeBytes: 100, heuristics: {}, definedClasses: [], definedInterfaces: [], implementsInterfaces: [] },
        dependencies: [{ rawSpecifier: './C', type: 'import', location: { line: 1, column: 1 } } as any],
      }),
      createFakeParsedFile({
        id: resolve(baseDir, 'C.ts'),
        relativePath: 'C.ts',
        metadata: { sizeBytes: 100, heuristics: {}, definedClasses: [], definedInterfaces: [], implementsInterfaces: [] },
        dependencies: [{ rawSpecifier: './A', type: 'import', location: { line: 1, column: 1 } } as any],
      }),
    ];

    const graph = new Graph(fakeFiles);
    const cycles = graph.detectCycles();

    expect(cycles).toContainEqual([
      resolve(baseDir, 'A.ts'),
      resolve(baseDir, 'B.ts'),
      resolve(baseDir, 'C.ts'),
      resolve(baseDir, 'A.ts'),
    ]);
  });

  it('should return no cycles for an acyclic graph', () => {
    const baseDir = resolve('tests/fixtures/temp/acyclic-graph');
    const fakeFiles: ParsedFile[] = [
      createFakeParsedFile({
        id: resolve(baseDir, 'A.ts'),
        relativePath: 'A.ts',
        metadata: { sizeBytes: 100, heuristics: {}, definedClasses: [], definedInterfaces: [], implementsInterfaces: [] },
        dependencies: [{ rawSpecifier: './B', type: 'import', location: { line: 1, column: 1 } } as any],
      }),
      createFakeParsedFile({
        id: resolve(baseDir, 'B.ts'),
        relativePath: 'B.ts',
        metadata: { sizeBytes: 100, heuristics: {}, definedClasses: [], definedInterfaces: [], implementsInterfaces: [] },
        dependencies: [],
      }),
    ];

    const graph = new Graph(fakeFiles);
    const cycles = graph.detectCycles();

    expect(cycles).toHaveLength(0);
  });
});

describe('JSON Exporter - Implementations Block', () => {
  const outputDir = 'tests/fixtures/temp';
  const outputPath = join(outputDir, 'test-output.json');

  beforeAll(() => {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
  });

  afterAll(() => {
    try {
      unlinkSync(outputPath);
    } catch {
      // ignore
    }
  });

  it('should include implementations block in JSON output', async () => {
    const fakeFiles: ParsedFile[] = [
      createFakeParsedFile({
        id: 'src/Auth.ts',
        relativePath: 'src/Auth.ts',
        metadata: {
          sizeBytes: 500,
          heuristics: { isReact: true },
          definedClasses: ['AuthService'],
          implementsInterfaces: ['IUserAuth'],
        },
      }),
    ];

    const graph = new Graph(fakeFiles);

    await exportGraphToJson(graph, fakeFiles, outputPath);

    const { readFileSync } = await import('fs');
    const output = JSON.parse(readFileSync(outputPath, 'utf-8'));

    expect(output).toHaveProperty('nodes');
    expect(output).toHaveProperty('edges');
    expect(output).toHaveProperty('implementations');

    expect(output.implementations).toHaveProperty('IUserAuth');
    expect(output.implementations['IUserAuth']).toContain('src/Auth.ts');
  });

  it('should export multiple implementations correctly', async () => {
    const fakeFiles: ParsedFile[] = [
      createFakeParsedFile({
        id: 'src/Auth.ts',
        metadata: {
          sizeBytes: 500,
          heuristics: {},
          implementsInterfaces: ['IUserAuth'],
        },
      }),
      createFakeParsedFile({
        id: 'src/Admin.ts',
        metadata: {
          sizeBytes: 300,
          heuristics: {},
          implementsInterfaces: ['IUserAuth', 'IAdmin'],
        },
      }),
    ];

    const graph = new Graph(fakeFiles);

    await exportGraphToJson(graph, fakeFiles, outputPath);

    const { readFileSync } = await import('fs');
    const output = JSON.parse(readFileSync(outputPath, 'utf-8'));

    expect(Object.keys(output.implementations)).toContain('IUserAuth');
    expect(Object.keys(output.implementations)).toContain('IAdmin');
    expect(output.implementations['IUserAuth']).toHaveLength(2);
    expect(output.implementations['IAdmin']).toHaveLength(1);
    expect(output.implementations['IAdmin']).toContain('src/Admin.ts');
  });
});
