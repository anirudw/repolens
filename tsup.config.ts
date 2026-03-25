import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  clean: true,
  external: [
    'tree-sitter',
    'tree-sitter-javascript',
    'tree-sitter-python',
    'tree-sitter-java',
    'tree-sitter-typescript'
  ],
  banner: {
    js: '#!/usr/bin/env node',
  },
});        