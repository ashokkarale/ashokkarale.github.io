// Copies only the public files (index.html and assets/) into dist/ for deployment.
// content/, data/, scripts/ and other internal files are never published.
//   node scripts/build-site.mjs

import { rm, mkdir, cp, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await cp(join(ROOT, 'index.html'), join(DIST, 'index.html'));
await cp(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });
// Tell GitHub Pages to serve files as-is (no Jekyll processing).
await writeFile(join(DIST, '.nojekyll'), '');
console.log('Built dist/ with index.html and assets/');
