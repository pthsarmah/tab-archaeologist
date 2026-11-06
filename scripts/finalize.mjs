import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
const base = JSON.parse(readFileSync(resolve(projectRoot, 'manifests/base.json'), 'utf8'));
const targets = (process.argv[2] ?? 'both') === 'both' ? ['chromium', 'firefox'] : [process.argv[2]];

function merge(baseManifest, overrides) {
  return {
    ...baseManifest,
    ...overrides
  };
}

for (const browser of targets) {
  const targetPath = resolve(projectRoot, `manifests/${browser}.json`);
  if (!existsSync(targetPath)) {
    throw new Error(`Unknown browser target: ${browser}`);
  }

  const overrides = JSON.parse(readFileSync(targetPath, 'utf8'));
  const manifest = merge(base, overrides);
  manifest.version = packageJson.version;

  const outputDir = resolve(projectRoot, 'dist', browser);
  if (!existsSync(outputDir)) {
    throw new Error(`Build output missing for ${browser}. Run the Vite build first.`);
  }

  mkdirSync(resolve(outputDir, 'icons'), { recursive: true });
  cpSync(resolve(projectRoot, 'public/icons'), resolve(outputDir, 'icons'), {
    recursive: true
  });

  const expectedPermissions = browser === 'chromium' ? ['tabs', 'tabGroups'] : ['tabs'];
  if (JSON.stringify(manifest.permissions) !== JSON.stringify(expectedPermissions)) {
    throw new Error(`Manifest permission check failed for ${browser}.`);
  }
  if (manifest.content_scripts) {
    throw new Error('Manifest must not contain content scripts.');
  }
  if (manifest.host_permissions) {
    throw new Error('Manifest must not contain host permissions.');
  }
  if (!existsSync(resolve(outputDir, manifest.action.default_popup))) {
    throw new Error(`Popup entry is missing: ${manifest.action.default_popup}`);
  }

  writeFileSync(resolve(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote dist/${browser}/manifest.json (v${manifest.version})`);
}
