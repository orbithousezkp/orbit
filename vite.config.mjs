import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * github pages spa fallback: copy dist/index.html → dist/404.html so any
 * unknown path (orbit.horse/inspect, /live, /roadmap) is served the spa,
 * which then routes via window.location.pathname on first paint.
 */
function spaFallback() {
  return {
    name: 'orbit-spa-fallback',
    closeBundle() {
      const out = resolve('dist');
      try {
        const html = readFileSync(resolve(out, 'index.html'), 'utf8');
        writeFileSync(resolve(out, '404.html'), html);
      } catch (e) {
        this.warn(`spa-fallback skipped: ${e.message}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), spaFallback()],
});
