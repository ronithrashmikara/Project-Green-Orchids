#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const webDir = path.resolve(__dirname, '..', 'apps', 'web');
const rootDir = path.resolve(__dirname, '..');
const env = { ...process.env };

// Some Windows dev machines fail to load Next's native SWC package even when
// npm installs the correct win32/x64 artifact. Keep normal native SWC on other
// platforms, but make Windows builds deterministic by using the installed WASM
// fallback package.
if (process.platform === 'win32' && !env.NEXT_TEST_WASM_DIR) {
  const wasmDir = path.join(rootDir, 'node_modules', '@next', 'swc-wasm-nodejs');
  if (fs.existsSync(path.join(wasmDir, 'wasm.js'))) {
    env.NEXT_TEST_WASM_DIR = wasmDir;
  }
}

const nextBin = require.resolve('next/dist/bin/next', { paths: [webDir] });
const result = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: webDir,
  env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
