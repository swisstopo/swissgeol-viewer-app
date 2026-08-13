/**
 * Copies Cesium static assets and @swissgeol/ui-core fonts from node_modules
 * into the public/ directory so Vite serves them correctly in dev mode.
 *
 * The previous vite-plugin-static-copy setup no longer serves these
 * runtime assets correctly in Vite 8 dev mode; requests fall through
 * to the SPA fallback and return index.html.
 */
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const cesiumBuild = resolve(root, 'node_modules/cesium/Build/Cesium');
const publicDir = resolve(root, 'public');

const copies = [
  {
    src: resolve(cesiumBuild, 'Workers'),
    dest: resolve(publicDir, 'cesium/Workers'),
  },
  {
    src: resolve(cesiumBuild, 'ThirdParty'),
    dest: resolve(publicDir, 'cesium/ThirdParty'),
  },
  {
    src: resolve(cesiumBuild, 'Assets'),
    dest: resolve(publicDir, 'cesium/Assets'),
  },
  {
    src: resolve(cesiumBuild, 'Widgets'),
    dest: resolve(publicDir, 'cesium/Widgets'),
  },
  {
    src: resolve(
      root,
      'node_modules/@swissgeol/ui-core/dist/swissgeol-ui-core/assets/fonts',
    ),
    dest: resolve(publicDir, 'assets/fonts'),
  },
];

for (const { src, dest } of copies) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}

console.log('[copy-cesium] Copied Cesium assets and ui-core fonts to public/');
