import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built assets resolve correctly whether the site
  // ends up served from a domain root or a subpath (e.g. GitHub Pages
  // project sites at /<repo>/).
  base: './',
  // satellite.js ships an optional WASM/pthreads acceleration path that
  // spawns a Worker with top-level await; Vite's default 'iife' worker
  // output can't represent that, so switch worker bundling to ES modules.
  worker: {
    format: 'es',
  },
});
