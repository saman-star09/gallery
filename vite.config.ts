import { defineConfig } from 'vite';

export default defineConfig({
  // satellite.js ships an optional WASM/pthreads acceleration path that
  // spawns a Worker with top-level await; Vite's default 'iife' worker
  // output can't represent that, so switch worker bundling to ES modules.
  worker: {
    format: 'es',
  },
});
