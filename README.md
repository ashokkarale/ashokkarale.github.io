# Ashok Karale · Portfolio

A one-page portfolio: profile, career line map and UiPath Community MVP case file. It is a plain static site with no framework or dependencies. Open `index.html` in a browser to view it.

## How it works

```
content/*.json  (you edit these)  ─┐
UiPath Forum stats (live)         ─┼─► scripts/build-data.mjs ─► assets/data.js ─► index.html
Medium RSS (live, archived)       ─┘                           └► data/portfolio.json
```

- `npm run refresh` (or `node scripts/build-data.mjs`) rebuilds the data. If a live source is down, the last good values are kept.
- **Medium** only returns the 10 newest posts, so every post is saved to `data/medium-archive.json` the first time it is seen.
- **UiPath Forum** stats come from the public `/u/ashokkarale.json` and `/summary.json` endpoints.
- `.github/workflows/refresh-data.yml` runs the refresh every night once the repo is on GitHub.

## Editing content

| File | What it holds |
|---|---|
| `content/profile.json` | Name, role, bio, chips, contact links, optional `photo` path (falls back to the forum avatar) |
| `content/talks.json` | Topics and every event (date, role, title, link). `verify: true` marks a year inferred from the event page |
| `content/community.json` | Community milestones on the map |
| `content/writing.json` | Articles outside Medium, such as forum tutorials |
| `content/certifications.json` | Credentials, shown newest first. Import from LinkedIn (below) or add by hand |
| `content/skills.json` | Skill groups. Imported skills land in "More skills"; move them into the named groups |
| `content/recommendations.json` | LinkedIn recommendation text. Never add the recommender's name |
| `content/mvp.json` | The three MVP pillars and their evidence |

Text can use placeholders such as `{forum.solutions}`, which are replaced with live values when the page renders.

After editing, run `npm run refresh` and reload the page.

## Importing from LinkedIn

LinkedIn has no personal-profile API outside the EU/EEA, so use its data download instead: **Settings → Data privacy → Get a copy of your data**. Unzip the archive, then run:

```
npm run import:linkedin -- "C:\path\to\unzipped-export"
npm run refresh
```

This reads `Certifications.csv` and `Skills.csv`. Running it again updates existing entries without duplicating them.

## Publishing (GitHub Pages)

`.github/workflows/deploy.yml` does everything on GitHub:

1. **On every push to `main`, every night at 02:00 IST, or when run by hand:** refresh forum and Medium data.
2. **Validate the data** (`scripts/validate-data.mjs`). A bad link or a suspicious data size stops the deploy.
3. **Commit refreshed data** back to the repository, so the history keeps every version.
4. **Build `dist/`** (`scripts/build-site.mjs`) with only `index.html` and `assets/`, then deploy it to GitHub Pages.

`content/`, `data/` and `scripts/` live in the repository but are never published to the site.

One-time setup on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Locally, `npm run build` runs the same refresh, validate and build steps.

## Security

- Every link and image goes through an allow-list (`https://`, `#anchor`, `assets/`); anything else becomes `#`.
- A Content Security Policy in `index.html` allows scripts only from this site.
- GitHub Actions are pinned to exact commits, and each job gets only the permissions it needs.
- Recommenders are never named; personal data from the LinkedIn export (such as birth date) is not stored.
