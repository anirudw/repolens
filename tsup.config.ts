import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});