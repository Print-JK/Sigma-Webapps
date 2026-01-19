
// vite.config.js
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './', // important for file:// usage
  plugins: [
    // This inlines JS & CSS into dist/index.html
    viteSingleFile({
      // keep defaults; they already set recommended build config
      // see plugin README if you want to tweak further
    }),
  ],
  build: {
    // These help avoid extra files and absolute paths
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 100000000, // push assets toward inlining when possible
    rollupOptions: {
      output: {
        inlineDynamicImports: true, // collapse chunks to a single bundle
      },
    },
  },
});
