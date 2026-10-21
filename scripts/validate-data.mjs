// Checks data/portfolio.json before it is published. Exits with code 1 on any problem,
// which stops the GitHub deploy. Run locally with: npm run validate
//   - every link is https://, an in-page #anchor or a local assets/ path
//   - required profile fields are present
//   - the data file has not grown or shrunk suspiciously

import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(ROOT, 'data/portfolio.json');
const errors = [];

const { size } = await stat(file);
if (size < 5_000 || size > 2_000_000) errors.push(`data/portfolio.json is ${size} bytes, outside the expected 5 KB – 2 MB range`);

const data = JSON.parse(await readFile(file, 'utf8'));

for (const key of ['name', 'role', 'bio', 'links']) {
  if (!data.profile?.[key] || (Array.isArray(data.profile[key]) && !data.profile[key].length)) errors.push(`profile.${key} is missing`);
}

const SAFE = /^(https:\/\/[^\s"'<>]+|#[\w-]*|assets\/[\w./-]+)$/i;
// Walk every value; any key that holds a link (url, photo, avatar) must be safe.
(function walk(node, path) {
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (/^(url|photo|avatar|profileUrl)$/i.test(k) && typeof v === 'string' && v && !SAFE.test(v)) {
        errors.push(`${path}.${k} is not an allowed link: ${v.slice(0, 120)}`);
      }
      walk(v, `${path}.${k}`);
    }
  }
})(data, 'data');

if (errors.length) {
  console.error(`✗ Data validation failed (${errors.length} problem${errors.length > 1 ? 's' : ''}):`);
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}
console.log('✓ Data validation passed');
