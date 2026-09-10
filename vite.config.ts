import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built assets resolve correctly whether the site
  // ends up served from a domain root or a subpath (e.g. GitHub Pages
  // project sites at /<repo>/).
  base: './',
});
