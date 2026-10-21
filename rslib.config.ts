import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: { tsconfigPath: './tsconfig.build.json' },
  output: { target: 'node', minify: false },
  lib: [
    {
      format: 'esm',
      dts: { autoExtension: true },
      source: { entry: { index: './src/index.ts' } },
      output: { distPath: { root: 'dist/esm' } },
    },
    {
      format: 'cjs',
      dts: { autoExtension: true },
      source: { entry: { index: './src/index.ts' } },
      output: { distPath: { root: 'dist/cjs' } },
    },
  ],
});
