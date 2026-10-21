// Builds data/portfolio.json and assets/data.js from content/*.json plus live
// UiPath Forum and Medium data. If a live source fails, the last good values are kept.
//   node scripts/build-data.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORUM = 'https://forum.uipath.com';
const FORUM_USER = 'ashokkarale';
const MEDIUM_USER = 'karaleashoks';

const p = (...parts) => join(ROOT, ...parts);

async function readJSON(file, fallback) {
  try {
    return JSON.parse(await readFile(p(file), 'utf8'));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Could not read ${file}: ${err.message}`);
  }
}

async function request(url, accept) {
  const res = await fetch(url, {
    headers: { Accept: accept, 'User-Agent': 'ashok-portfolio-data/1.0 (+https://forum.uipath.com/u/ashokkarale)' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

async function fetchForum() {
  const [userRes, summaryRes] = await Promise.all([
    request(`${FORUM}/u/${FORUM_USER}.json`, 'application/json'),
    request(`${FORUM}/u/${FORUM_USER}/summary.json`, 'application/json')
  ]);
  const { user } = await userRes.json();
  const { user_summary: s = {}, badges = [] } = await summaryRes.json();
  const avatar = user.avatar_template
    ? (user.avatar_template.startsWith('http') ? '' : FORUM) + user.avatar_template.replace('{size}', '360')
    : '';
  return {
    username: user.username,
    url: `${FORUM}/u/${user.username}`,
    title: user.title || 'Member',
    trustLevel: user.trust_level,
    moderator: Boolean(user.moderator) || user.primary_group_name === 'Forum_Moderators',
    joined: user.created_at?.slice(0, 10),
    location: user.location || '',
    avatar,
    badgeCount: user.badge_count,
    profileViews: user.profile_view_count,
    solutions: s.solved_count ?? user.accepted_answers ?? null,
    posts: s.post_count ?? null,
    topics: s.topic_count ?? null,
    likesReceived: s.likes_received ?? null,
    daysVisited: s.days_visited ?? null,
    badges: badges.map(b => b.name)
  };
}

const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
};

async function fetchMedium() {
  const xml = await (await request(`https://medium.com/feed/@${MEDIUM_USER}`, 'application/rss+xml, application/xml')).text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    let html = tag(item, 'content:encoded');
    let title = tag(item, 'title');
    // Medium repeats the title as the first heading of the body, sometimes longer than the
    // feed's <title>. Use that heading as the title and keep it out of the excerpt.
    const strip = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const lead = html.match(/^\s*(?:<figure[\s\S]*?<\/figure>\s*)?<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/);
    if (lead && strip(lead[1]).startsWith(title)) {
      title = strip(lead[1]);
      html = html.replace(lead[0], ' ');
    }
    const text = strip(html.replace(/<figure[\s\S]*?<\/figure>/g, ' '));
    return {
      date: new Date(tag(item, 'pubDate')).toISOString().slice(0, 10),
      title,
      short: title.split(/[:–—-]/)[0].trim().slice(0, 28),
      source: 'Medium',
      url: tag(item, 'link').split('?')[0],
      tags: [...item.matchAll(/<category>([\s\S]*?)<\/category>/g)].map(m => decode(m[1])),
      excerpt: text.slice(0, 220) + (text.length > 220 ? '…' : '')
    };
  });
}

async function live(name, fn, previous) {
  try {
    const value = await fn();
    console.log(`✓ ${name}`);
    return value;
  } catch (err) {
    console.warn(`! ${name} failed (${err.message}); keeping previous data`);
    return previous;
  }
}

const previous = await readJSON('data/portfolio.json', {});

const [forum, mediumNow] = await Promise.all([
  live('UiPath Forum', fetchForum, previous.forum ?? null),
  live('Medium RSS', fetchMedium, [])
]);

// Medium's feed only returns the 10 newest posts, so keep every post we have ever seen.
// Posts whose link is not a plain https:// URL are dropped, so a tampered feed can't inject links.
const archive = await readJSON('data/medium-archive.json', []);
const byUrl = new Map(archive.map(a => [a.url, a]));
for (const a of mediumNow) {
  if (!/^https:\/\/[^\s"'<>]+$/i.test(a.url)) { console.warn(`! Skipping Medium post with unsafe link: ${a.url}`); continue; }
  byUrl.set(a.url, { ...byUrl.get(a.url), ...a });
}
const medium = [...byUrl.values()].sort((a, b) => b.date.localeCompare(a.date));

const [profile, talks, community, writing, linkedinArticles, certifications, skills, experience, recommendations, mvp] = await Promise.all([
  readJSON('content/profile.json'),
  readJSON('content/talks.json'),
  readJSON('content/community.json'),
  readJSON('content/writing.json'),
  readJSON('content/linkedin-articles.json', []),
  readJSON('content/certifications.json'),
  readJSON('content/skills.json', { groups: [] }),
  readJSON('content/experience.json', []),
  readJSON('content/recommendations.json'),
  readJSON('content/mvp.json')
]);

const data = {
  generatedAt: new Date().toISOString(),
  profile,
  forum,
  talks,
  community,
  writing: [...medium, ...linkedinArticles, ...writing].sort((a, b) => b.date.localeCompare(a.date)),
  certifications,
  skills,
  experience,
  recommendations,
  mvp
};

await mkdir(p('data'), { recursive: true });
await writeFile(p('data/medium-archive.json'), JSON.stringify(medium, null, 2) + '\n');
await writeFile(p('data/portfolio.json'), JSON.stringify(data, null, 2) + '\n');
await writeFile(p('assets/data.js'), `// Generated by scripts/build-data.mjs on ${data.generatedAt}. Do not edit; edit content/*.json instead.\nwindow.PORTFOLIO = ${JSON.stringify(data)};\n`);

console.log(`Wrote data/portfolio.json and assets/data.js · forum solutions: ${forum?.solutions ?? 'n/a'} · articles: ${data.writing.length} · talks: ${talks.events.length}`);
