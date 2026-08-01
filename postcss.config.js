/**
 * PostCSS configuration — El-Imtiyaz desktop.
 *
 * IMPORTANT: This file was previously excluded by the root .gitignore
 * (along with tailwind.config.js). Without it, Vite's CSS pipeline
 * silently left the `@tailwind base/components/utilities` directives
 * in src/index.css unprocessed, producing a 3.36 kB stylesheet that
 * contained only the @layer blocks — no utility classes. The result
 * was a "pure HTML, no design" rendering. Iteration 4 fix.
 *
 * Vite auto-detects this file when present in the project root.
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
