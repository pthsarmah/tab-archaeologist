import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./src', import.meta.url));
const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, 'package.json'), 'utf8')
) as { version: string };

export default defineConfig(({ mode }) => {
  const browser = mode === 'firefox' ? 'firefox' : 'chromium';

  return {
    root,
    base: './',
    publicDir: false,
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version)
    },
    build: {
      outDir: resolve(projectRoot, 'dist', browser),
      emptyOutDir: true,
      sourcemap: false,
      target: 'es2022',
      rollupOptions: {
        input: resolve(root, 'popup/popup.html'),
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  };
});
