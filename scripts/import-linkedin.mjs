// Imports certifications and skills from a LinkedIn data export.
//   node scripts/import-linkedin.mjs "C:\path\to\unzipped-export"          (whole folder)
//   node scripts/import-linkedin.mjs "C:\path\to\Certifications.csv"       (single file)
// LinkedIn: Settings → Data privacy → Get a copy of your data.
// Existing entries are updated, never duplicated; hand-added entries and skill groups are kept.

import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/import-linkedin.mjs <export folder | Certifications.csv | Skills.csv>');
  process.exit(1);
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim()));
}

async function readCSV(file) {
  const [header, ...rows] = parseCSV((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  const keys = header.map(h => h.trim().toLowerCase());
  return rows.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
// LinkedIn exports dates like "Mar 2025", "2025-03" or "3/14/2025".
function toDate(s) {
  s = (s || '').trim();
  if (!s) return '';
  let m = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[2]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (m) return m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})$/);
  return m ? m[1] : s;
}

const readContent = async name => JSON.parse(await readFile(join(ROOT, 'content', name), 'utf8'));
const writeContent = (name, data) => writeFile(join(ROOT, 'content', name), JSON.stringify(data, null, 2) + '\n');

async function importCertifications(file) {
  const imported = (await readCSV(file)).map(r => ({
    name: r['name'],
    issuer: r['authority'] || '',
    date: toDate(r['started on']),
    expires: toDate(r['finished on']),
    credentialId: r['license number'] || '',
    url: r['url'] || ''
  })).filter(c => c.name);
  const data = await readContent('certifications.json');
  // Same-named credentials can repeat (e.g. MVP each year), so prefer the credential ID.
  const key = c => (c.credentialId ? `id:${c.credentialId}` : `${c.name}|${c.issuer}|${c.date}`).toLowerCase();
  const merged = new Map((data.items || []).map(c => [key(c), c]));
  for (const c of imported) merged.set(key(c), { ...merged.get(key(c)), ...Object.fromEntries(Object.entries(c).filter(([, v]) => v)) });
  data.items = [...merged.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  await writeContent('certifications.json', data);
  console.log(`Certifications: imported ${imported.length}, ${data.items.length} total.`);
}

async function importSkills(file) {
  const imported = (await readCSV(file)).map(r => r['name']).filter(Boolean);
  const data = await readContent('skills.json');
  const known = new Set(data.groups.flatMap(g => g.items).map(s => s.toLowerCase()));
  const fresh = imported.filter(s => !known.has(s.toLowerCase()));
  if (fresh.length) {
    let inbox = data.groups.find(g => g.name === data.inboxGroup);
    if (!inbox) data.groups.push(inbox = { name: data.inboxGroup, items: [] });
    inbox.items.push(...fresh);
  }
  await writeContent('skills.json', data);
  console.log(`Skills: ${imported.length} in export, ${fresh.length} new (added to "${data.inboxGroup}").`);
}

const decodeHTML = s => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n));

// Exported LinkedIn articles: Articles/Articles/*.html, one published article per file.
async function importArticles(dir) {
  const files = (await readdir(dir)).filter(f => f.endsWith('.html'));
  const articles = [];
  for (const f of files) {
    const html = await readFile(join(dir, f), 'utf8');
    const h1 = html.match(/<h1>\s*(?:<a href="([^"]+)">)?([\s\S]*?)(?:<\/a>)?\s*<\/h1>/);
    const published = html.match(/<p class="published">Published on (\d{4}-\d{2}-\d{2})/);
    if (!h1 || !published) { console.warn(`Skipping ${f}: no title or not published`); continue; }
    const body = (html.split(/<p class="published">[^<]*<\/p>/)[1] || '')
      .replace(/<figure[\s\S]*?<\/figure>/g, ' ').replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<[^>]+>/g, ' ');
    const text = decodeHTML(body).replace(/\s+/g, ' ').trim();
    const title = decodeHTML(h1[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    articles.push({
      date: published[1],
      title,
      short: title.split(/[:–—]/)[0].trim().slice(0, 28),
      source: 'LinkedIn',
      url: h1[1] || `https://www.linkedin.com/pulse/${basename(f, '.html')}`,
      excerpt: text.slice(0, 220) + (text.length > 220 ? '…' : '')
    });
  }
  articles.sort((a, b) => b.date.localeCompare(a.date));
  await writeContent('linkedin-articles.json', articles);
  console.log(`LinkedIn articles: ${articles.length} imported.`);
}

// Positions.csv → content/experience.json (newest first). Descriptions become bullet lists.
async function importPositions(file) {
  const roles = (await readCSV(file)).map(r => ({
    company: r['company name'],
    title: r['title'],
    location: r['location'] || '',
    start: toDate(r['started on']),
    end: toDate(r['finished on']),
    highlights: (r['description'] || '')
      .replace(/Main Responsibilities:?/i, '').replace(/‾+/g, '')
      .split(/\s*•\s*/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  })).filter(r => r.company && r.title);
  roles.sort((a, b) => String(b.start).localeCompare(String(a.start)));
  // Keep hand-added highlights when LinkedIn has no description for that role.
  let existing = [];
  try { existing = await readContent('experience.json'); } catch { /* first import */ }
  for (const r of roles) {
    const prev = existing.find(e => e.company === r.company && e.title === r.title && e.start === r.start);
    if (!r.highlights.length && prev?.highlights?.length) r.highlights = prev.highlights;
  }
  await writeContent('experience.json', roles);
  console.log(`Experience: ${roles.length} roles imported.`);
}

const HANDLERS = { 'certifications.csv': importCertifications, 'skills.csv': importSkills, 'positions.csv': importPositions };

let files = [target];
if ((await stat(target)).isDirectory()) {
  files = (await readdir(target)).filter(f => HANDLERS[f.toLowerCase()]).map(f => join(target, f));
  for (const dir of [join(target, 'Articles', 'Articles'), join(target, 'Articles')]) {
    try {
      if ((await readdir(dir)).some(f => f.endsWith('.html'))) { await importArticles(dir); break; }
    } catch { /* folder not in this export */ }
  }
}
if (!files.length) {
  console.error(`No Certifications.csv or Skills.csv found in ${target}`);
  process.exit(1);
}
for (const f of files) {
  const handler = HANDLERS[basename(f).toLowerCase()];
  if (!handler) { console.warn(`Skipping ${basename(f)}: not a supported LinkedIn export file`); continue; }
  await handler(f);
}
console.log('Run "npm run refresh" to rebuild the site data.');
