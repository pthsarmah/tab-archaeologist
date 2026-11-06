import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const artifactDir = resolve(projectRoot, 'web-ext-artifacts');
mkdirSync(artifactDir, { recursive: true });

function collectFiles(directory) {
  const files = {};
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const absolute = join(current, entry);
      if (statSync(absolute).isDirectory()) {
        walk(absolute);
      } else {
        const key = relative(directory, absolute).split('\\').join('/');
        files[key] = new Uint8Array(readFileSync(absolute));
      }
    }
  };
  walk(directory);
  return files;
}

for (const browser of ['chromium', 'firefox']) {
  const source = resolve(projectRoot, 'dist', browser);
  const output = resolve(artifactDir, `tab-archaeologist-${browser}.zip`);
  writeFileSync(output, zipSync(collectFiles(source), { level: 6 }));
  console.log(`Wrote ${output}`);
}
