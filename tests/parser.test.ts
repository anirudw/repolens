import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { createParser } from '../src/parser/index';

describe('AST Language Parsers', () => {
  it('should parse JavaScript imports and React heuristics', async () => {
    const parser = createParser('.js');
    expect(parser).not.toBeNull();

    const content = readFileSync('tests/fixtures/dummy-repo/src/index.js', 'utf-8');
    const result = await parser!.parse('tests/fixtures/dummy-repo/src/index.js', content);
    
    expect(result.dependencies.length).toBe(3);
    expect(result.dependencies.map(d => d.rawSpecifier)).toContain('react');
    expect(result.metadata.heuristics.isReact).toBe(true);
  });

  it('should parse Python imports and Entry Point heuristics', async () => {
    const parser = createParser('.py');
    const content = readFileSync('tests/fixtures/dummy-repo/src/api.py', 'utf-8');
    const result = await parser!.parse('tests/fixtures/dummy-repo/src/api.py', content);
    
    expect(result.dependencies.length).toBe(3);
    expect(result.dependencies.map(d => d.rawSpecifier)).toContain('os');
    expect(result.metadata.heuristics.hasEntrypoint).toBe(true);
  });

  it('should parse Markdown links and wikilinks', async () => {
    const parser = createParser('.md');
    const content = readFileSync('tests/fixtures/dummy-repo/README.md', 'utf-8');
    const result = await parser!.parse('tests/fixtures/dummy-repo/README.md', content);
    
    expect(result.dependencies.length).toBe(2);
    expect(result.dependencies.map(d => d.type)).toContain('wikilink');
  });
});