import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('manifest and privacy invariants', () => {
  it('keeps the base manifest minimal', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifests/base.json'), 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['tabs']);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.action.default_popup).toBe('popup/popup.html');
    expect(manifest.content_security_policy.extension_pages).toContain("script-src 'self'");
  });

  it('declares no data collection for Firefox', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifests/firefox.json'), 'utf8'));
    expect(manifest.browser_specific_settings.gecko.data_collection_permissions.required).toEqual([
      'none'
    ]);
  });

  it('does not use network, storage or HTML injection APIs in src', () => {
    const files = [
      'src/core/pipeline.ts',
      'src/core/similarity.ts',
      'src/core/normalizer.ts',
      'src/browser/adapter.ts',
      'src/popup/controller.ts',
      'src/popup/render.ts'
    ];
    const forbidden = [
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\b/,
      /\blocalStorage\b/,
      /\bindexedDB\b/,
      /\bchrome\.storage\b/,
      /\bbrowser\.storage\b/,
      /\binnerHTML\b/
    ];
    for (const file of files) {
      const content = readFileSync(resolve(root, file), 'utf8');
      for (const pattern of forbidden) {
        expect(content, `${file} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('uses relative asset paths in a built popup when available', () => {
    const popupPath = resolve(root, 'dist/chromium/popup/popup.html');
    if (!existsSync(popupPath)) return;
    const html = readFileSync(popupPath, 'utf8');
    expect(html).not.toMatch(/src="\//);
    expect(html).not.toMatch(/href="\//);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<script(?![^>]*src=)/);
  });
});
