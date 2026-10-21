// Renders the portfolio from window.PORTFOLIO (assets/data.js).
(() => {
  const D = window.PORTFOLIO;
  const $ = s => document.querySelector(s);
  if (!D) {
    $('main').innerHTML = '<p style="padding:24px 0">The data file is missing. Run <code>npm run refresh</code> to build <code>assets/data.js</code>.</p>';
    return;
  }

  const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Only web links, in-page anchors and local asset paths may become link/image targets.
  // Anything else (javascript:, data:, vbscript:, …) is replaced with a harmless "#".
  const safeUrl = u => {
    const s = String(u ?? '').trim();
    return /^(https?:\/\/|#|assets\/)/i.test(s) && !/[\u0000-\u001f]/.test(s) ? s : '#';
  };
  const esc = escHtml;
  const num = v => (typeof v === 'number' ? v.toLocaleString('en-US') : v);
  const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
  // Profile text is escaped too; live values like {forum.solutions} are filled in afterwards.
  const fill = t => escHtml(t).replace(/\{([\w.]+)\}/g, (m, path) => { const v = get(D, path); return v == null ? '—' : escHtml(num(v)); });
  const ext = url => /^https?:/.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // Dates may be YYYY, YYYY-MM or YYYY-MM-DD.
  const parts = d => { const [y, m, day] = String(d).split('-').map(Number); return { y, m, day }; };
  const frac = d => { const { y, m, day } = parts(d); return y + (m ? (m - 1) / 12 : 0) + (day ? (day - 1) / 365 : 0); };
  const fmt = d => {
    const { y, m, day } = parts(d);
    if (!m) return String(y);
    const mon = new Date(y, m - 1, 1).toLocaleString('en', { month: 'short' });
    return day ? `${day} ${mon} ${y}` : `${mon} ${y}`;
  };

  // Shows two rows of a card grid per page. The page size follows the number of
  // columns the grid currently has, so it adapts to the screen width.
  function pager(gridSel, navSel, renderItem, label) {
    const grid = $(gridSel), nav = $(navSel);
    let items = [], page = 0, per = 0;
    const columns = () => {
      const tracks = getComputedStyle(grid).gridTemplateColumns;
      if (!tracks || /none|repeat/.test(tracks)) return Math.max(1, Math.floor(grid.clientWidth / 300));
      return Math.max(1, tracks.split(' ').filter(Boolean).length);
    };
    function draw() {
      per = columns() * 2;
      const pages = Math.max(1, Math.ceil(items.length / per));
      page = Math.min(page, pages - 1);
      grid.innerHTML = items.slice(page * per, (page + 1) * per).map(renderItem).join('');
      if (pages <= 1) { nav.hidden = true; nav.innerHTML = ''; return; }
      nav.hidden = false;
      const from = page * per + 1, to = Math.min(items.length, (page + 1) * per);
      nav.innerHTML =
        `<button data-p="${page - 1}" ${page === 0 ? 'disabled' : ''} aria-label="Previous page of ${label}">‹ Prev</button>` +
        Array.from({ length: pages }, (_, i) => `<button data-p="${i}" ${i === page ? 'aria-current="page"' : ''} aria-label="${label} page ${i + 1}">${i + 1}</button>`).join('') +
        `<button data-p="${page + 1}" ${page === pages - 1 ? 'disabled' : ''} aria-label="Next page of ${label}">Next ›</button>` +
        `<span class="pg-info">${from}–${to} of ${items.length}</span>`;
    }
    nav.addEventListener('click', e => {
      const b = e.target.closest('button[data-p]');
      if (!b || b.disabled) return;
      page = +b.dataset.p;
      draw();
      // Keep the top of the grid in view when the new page is shorter or taller.
      if (grid.getBoundingClientRect().top < 70) grid.scrollIntoView({ block: 'start' });
      nav.querySelector('[aria-current="page"]')?.focus();
    });
    let resizeTimer;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const firstShown = page * per, next = columns() * 2;
        if (next !== per) { page = Math.floor(firstShown / next); draw(); }
      }, 150);
    });
    return { set(list) { items = list; page = 0; draw(); } };
  }

  const P = D.profile, F = D.forum || {};
  const events = [...D.talks.events].sort((a, b) => frac(b.date) - frac(a.date));
  const sessions = events.filter(e => /speaker|host|guest|panel/i.test(e.role)).length;
  const organised = events.filter(e => /organi[sz]er/i.test(e.role)).length;

  /* ---------- profile ---------- */
  const photo = P.photo || F.avatar;
  $('#photo').innerHTML = photo
    ? `<img src="${esc(safeUrl(photo))}" alt="${esc(P.name)}" width="360" height="450">`
    : esc(P.name.split(' ').map(w => w[0]).join(''));
  $('#role').textContent = [P.role, P.company, P.location].filter(Boolean).join(' · ');
  $('#name').textContent = P.name;
  // Show the name in the top bar whenever the profile heading is out of view.
  $('#bar-name').textContent = P.name;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      const out = !e.isIntersecting;
      $('.bar').classList.toggle('scrolled', out);
      $('#bar-name').setAttribute('aria-hidden', String(!out));
    }, { rootMargin: '-56px 0px 0px 0px' }).observe($('#name'));
  }
  $('#headline').textContent = P.headline || '';
  $('#headline').hidden = !P.headline;
  $('#chips').innerHTML = P.chips.map((c, i) => `<span class="chip">${i === 0 ? '<i class="d"></i>' : ''}${fill(c.text)}</span>`).join('');
  $('#bio').innerHTML = P.bio.map(p => `<p>${fill(p)}</p>`).join('');
  // Headline counters, all derived from the data so they stay current.
  const firstRole = (D.experience || []).map(r => r.start).filter(Boolean).sort()[0];
  const yearsInIT = firstRole ? `${Math.floor((Date.now() - new Date(`${firstRole}-01`)) / 31557600000)}+` : null;
  const articleCount = (D.writing || []).filter(a => ['Medium', 'LinkedIn'].includes(a.source)).length;
  $('#stats').innerHTML = [
    [yearsInIT, 'years in IT'],
    [(D.certifications?.items || []).length || null, 'certifications', '+'],
    [events.length || null, 'Speaking, hosting and organising events', '+'],
    [F.solutions, 'UiPath Forum Leader & Moderator', '+', 'solutions'],
    [articleCount || null, 'Articles', '+']
  ].filter(([v]) => v != null).map(([v, t, plus = '', unit = '']) =>
    `<div><b>${esc(num(v))}${plus}${unit ? ` <small>${unit}</small>` : ''}</b><span>${t}</span></div>`).join('');

  // Calls to action in the hero, so visitors can act without scrolling to the end.
  $('#ctas').innerHTML = (P.ctas || []).map(c =>
    `<a class="cta${c.primary ? ' primary' : ''}" href="${esc(safeUrl(c.url))}"${ext(c.url)}>${esc(c.label)}${/^https?:/.test(c.url) ? ' ↗' : ''}</a>`).join('');
  $('#ctas').hidden = !(P.ctas || []).length;

  // Featured: the three strongest pieces of agentic-AI proof, right under the profile.
  $('#featured').innerHTML = (P.featured || []).map(f => `<a class="feat" href="${esc(safeUrl(f.url))}"${ext(f.url)}>
      <span class="lab">${esc(f.kicker)}</span><b>${esc(f.title)}</b><span class="fd">${esc(f.detail)}</span>
    </a>`).join('');
  $('#featured').hidden = !(P.featured || []).length;

  /* ---------- experience (company rail, newest first) ---------- */
  const roles = [...(D.experience || [])].sort((a, b) => String(b.start).localeCompare(String(a.start)));
  if (roles.length) {
    const ym = d => { const { y, m } = parts(d); return y * 12 + (m || 1) - 1; };
    const today = new Date(), nowM = today.getFullYear() * 12 + today.getMonth();
    const months = (s, e) => Math.max(1, (e ? ym(e) : nowM) - ym(s) + 1);
    const dur = n => { const y = Math.floor(n / 12), m = n % 12; return [y && `${y} yr${y > 1 ? 's' : ''}`, m && `${m} mo${m > 1 ? 's' : ''}`].filter(Boolean).join(' '); };
    const span = (s, e) => `${fmt(s)} – ${e ? fmt(e) : 'Present'}`;
    // Consecutive roles at the same company form one stop on the rail.
    const companies = [];
    roles.forEach(r => {
      const last = companies.at(-1);
      if (last && last.name === r.company) last.roles.push(r); else companies.push({ name: r.company, roles: [r] });
    });
    const hues = ['--l2', '--l4', '--l3', '--l5', '--l1'];
    const total = months(roles.at(-1).start, null);
    $('#experience').hidden = false;
    $('#nav-exp').hidden = false;
    $('#exp-count').textContent = `${Math.floor(total / 12)}+ years · ${plural(companies.length, 'company').replace('companys', 'companies')} · ${plural(roles.length, 'role')} · newest first`;
    $('#exp').innerHTML = companies.map((co, i) => {
      const start = co.roles.at(-1).start, end = co.roles[0].end;
      const n = months(start, end), yrs = n / 12;
      const size = Math.round(22 + Math.min(yrs, 6) * 4);
      return `<div class="cyr exp-co" style="--c:var(${hues[i % hues.length]})">
        <span class="cnode exp-node" style="width:${size}px;height:${size}px" aria-hidden="true">${yrs >= 1 ? Math.round(yrs) + 'y' : n + 'm'}</span>
        <div>
          <h3 class="cy">${esc(co.name)} <small>${esc(span(start, end))} · ${esc(dur(n))}</small></h3>
          <div class="roles">${co.roles.map(r => {
            // "Recognition: …" becomes an award badge next to the title; the first two
            // achievements show inline and the rest sit behind "Show all".
            const all = r.highlights || [];
            const award = all.find(h => /^recognition:/i.test(h));
            const items = all.filter(h => h !== award);
            const li = h => { const m = h.match(/^([^:]{2,40}):\s+(.+)$/); return `<li>${m ? `<b>${esc(m[1])}:</b> ${esc(m[2])}` : esc(h)}</li>`; };
            return `<article class="role-card">
            <div class="role-top"><b>${esc(r.title)}</b>${r.end ? '' : '<span class="now">Current</span>'}${award ? `<span class="award">★ ${esc(award.replace(/^recognition:\s*/i, ''))}</span>` : ''}</div>
            <div class="meta-line">${esc(span(r.start, r.end))} · ${esc(dur(months(r.start, r.end)))}${r.location ? ' · ' + esc(r.location) : ''}</div>
            ${items.length ? `<ul class="top-ach">${items.slice(0, 2).map(li).join('')}</ul>` : ''}
            ${items.length > 2 ? `<details><summary>Show all ${items.length} responsibilities</summary><ul>${items.slice(2).map(li).join('')}</ul></details>` : ''}
          </article>`;
          }).join('')}</div>
        </div>
      </div>`;
    }).join('');
  }

  /* ---------- topics I speak on ---------- */
  const topics = D.talks.topics
    .map(t => ({ ...t, ev: events.filter(e => e.topic === t.id) }))
    .filter(t => t.ev.length);
  const formats = [...new Set(events.map(e => e.format).filter(Boolean))].map(f => f.toLowerCase());
  $('#topics-count').textContent = `${plural(topics.length, 'topic')} · ${plural(events.length, 'session')} · ${formats.join(', ')}`;
  pager('#topics', '#topics-pager', t => {
    const formats = [...new Set(t.ev.map(e => e.format).filter(Boolean))];
    return `<article class="talk"><div class="fmt">${formats.map(f => `<span>${esc(f)}</span>`).join('')}<span>${plural(t.ev.length, 'session')}</span></div>
      <h3>${esc(t.title)}</h3><p>${esc(t.summary)}</p>
      <ul>${t.ev.slice(0, 3).map(e => `<li><a href="${esc(safeUrl(e.url))}"${ext(e.url)}>${esc(fmt(e.date))} · ${esc(e.event)}</a></li>`).join('')}</ul>
      ${t.ev.length > 3 ? `<a class="more-link" href="#sessions">+${t.ev.length - 3} more in Stages & sessions ↓</a>` : ''}</article>`;
  }, 'topics').set(topics);

  /* ---------- stages & sessions (filter by role) ---------- */
  // A role like "Speaker & Organizer" counts under both tags.
  const rolesOf = e => e.role.split(/\s*&\s*/).map(r => r.trim()).filter(Boolean);
  const tagCounts = new Map();
  events.forEach(e => rolesOf(e).forEach(r => tagCounts.set(r, (tagCounts.get(r) || 0) + 1)));
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  let roleFilter = 'All';
  const sessionPager = pager('#past', '#past-pager', e => `
    <article class="sess">
      <div class="sess-top"><span class="dt">${esc(fmt(e.date))}</span><span class="role">${esc(e.role)}</span></div>
      <h4>${esc(e.title)}</h4>
      <p>${esc(e.event)}${e.city ? ' · ' + esc(e.city) : ''}${e.format ? ' · ' + esc(e.format) : ''}</p>
      ${e.url ? `<a href="${esc(safeUrl(e.url))}"${ext(e.url)}>Event page ↗</a>` : ''}
    </article>`, 'sessions');
  function renderSessions() {
    const list = roleFilter === 'All' ? events : events.filter(e => rolesOf(e).includes(roleFilter));
    const years = list.map(e => parts(e.date).y);
    const span = years.length ? ` · ${Math.min(...years)}–${Math.max(...years)}` : '';
    $('#past-count').textContent = `${plural(list.length, 'session')}${roleFilter === 'All' ? '' : ' as ' + roleFilter}${span}`;
    $('#role-filters').innerHTML = [['All', events.length], ...tags]
      .map(([t, n]) => `<button aria-pressed="${t === roleFilter}" data-role="${esc(t)}">${esc(t)} <span>${n}</span></button>`).join('');
    sessionPager.set(list);
  }
  $('#role-filters').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    roleFilter = b.dataset.role;
    renderSessions();
    $('#role-filters').querySelector(`[data-role="${CSS.escape(roleFilter)}"]`)?.focus();
  });
  renderSessions();

  /* ---------- what colleagues say ---------- */
  // Recommenders are shown by designation and relationship only, never by name.
  // Tiles share one height: the opening is clamped and the full text opens in a dialog.
  const recs = [...(D.recommendations?.items || [])].sort((a, b) => frac(b.date || '0') - frac(a.date || '0'));
  if (recs.length) {
    $('#recs-wrap').hidden = false;
    $('#rec-count').textContent = `${recs.length} LinkedIn recommendation${recs.length === 1 ? '' : 's'}`;
    const paras = r => (Array.isArray(r.text) ? r.text : [r.text]);
    const cite = r => `<cite><b>${esc(r.designation || 'LinkedIn recommendation')}</b>${r.relation ? `<span>${esc(r.relation)}${r.date ? ' · ' + esc(fmt(r.date)) : ''}</span>` : ''}</cite>`;
    pager('#recs', '#recs-pager', ({ r, i }) => `<blockquote class="rec">
        <p class="lead">${esc(paras(r).join(' '))}</p>
        <button class="rec-toggle" data-i="${i}">Read full recommendation</button>
        ${cite(r)}
      </blockquote>`, 'recommendations').set(recs.map((r, i) => ({ r, i })));
    const dlg = $('#rec-dialog');
    $('#recs').addEventListener('click', e => {
      const b = e.target.closest('.rec-toggle'); if (!b) return;
      const r = recs[+b.dataset.i];
      $('#rec-dialog-body').innerHTML = paras(r).map(p => `<p>${esc(p)}</p>`).join('') + cite(r);
      dlg.showModal();
    });
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  }

  /* ---------- articles: Medium + LinkedIn (newest first) ---------- */
  const SOURCES = ['Medium', 'LinkedIn'];
  const articles = D.writing.filter(a => SOURCES.includes(a.source)).sort((a, b) => frac(b.date) - frac(a.date));
  if (articles.length) {
    $('#writing').hidden = false;
    $('#nav-writing').hidden = false;
    let source = 'All';
    const counts = SOURCES.map(s => [s, articles.filter(a => a.source === s).length]).filter(([, n]) => n);
    const articlePager = pager('#articles', '#articles-pager', a => `<article class="art src-${a.source.toLowerCase()}">
        <div class="art-top"><span class="dt">${esc(fmt(a.date))}</span><span class="src">${esc(a.source)}</span></div>
        <h3><a href="${esc(safeUrl(a.url))}"${ext(a.url)}>${esc(a.title)}</a></h3>
        ${a.excerpt ? `<p>${esc(a.excerpt)}</p>` : ''}
        ${a.tags?.length ? `<ul class="tags">${a.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <a class="more" href="${esc(safeUrl(a.url))}"${ext(a.url)}>Read on ${esc(a.source)} ↗</a>
      </article>`, 'articles');
    const renderArticles = () => {
      const list = source === 'All' ? articles : articles.filter(a => a.source === source);
      $('#art-count').textContent = `${plural(list.length, 'article')}${source === 'All' ? '' : ' on ' + source}`;
      $('#art-filters').innerHTML = [['All', articles.length], ...counts]
        .map(([s, n]) => `<button aria-pressed="${s === source}" data-src="${s}">${s} <span>${n}</span></button>`).join('');
      articlePager.set(list);
    };
    $('#art-filters').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      source = b.dataset.src;
      renderArticles();
      $('#art-filters').querySelector(`[data-src="${source}"]`)?.focus();
    });
    renderArticles();
  }

  /* ---------- skills & technologies ---------- */
  // Skill journey: career eras, newest first, each with the skills that entered then.
  // Skills not placed in an era are listed once underneath, so all of them stay visible.
  const groups = (D.skills?.groups || []).filter(g => g.items?.length);
  const journey = D.skills?.journey || [];
  if (groups.length || journey.length) {
    const all = [...new Set(groups.flatMap(g => g.items))];
    const placed = new Set(journey.flatMap(e => e.skills));
    const label = s => s.replace(/ \(Programming Language\)$/, '')
      .replace(/^Integration Platform as a Service \(iPaaS\)$/, 'iPaaS')
      .replace(/^Robotic Process Automation \(RPA\)$/, 'RPA')
      .replace(/^Optical Character Recognition \(OCR\)$/, 'OCR')
      .replace(/^Visual Basic for Applications \(VBA\)$/, 'VBA');
    const chip = s => `<li title="${esc(s)}">${esc(label(s))}</li>`;
    const rest = all.filter(s => !placed.has(s));
    $('#skills').hidden = false;
    $('#nav-skills').hidden = false;
    $('#skill-count').textContent = `${plural(all.length || placed.size, 'skill')} · newest first`;
    $('#skill-groups').innerHTML =
      `<div class="eras">${journey.map(e => `<div class="era" style="--c:var(${esc(e.color || '--l2')})">
          <small>${esc(e.years)}</small><b>${esc(e.title)}</b><p>${esc(e.summary)}</p>
          <ul>${e.skills.map(chip).join('')}</ul>
        </div>`).join('')}</div>` +
      (rest.length ? `<details class="skill-rest"><summary><span class="lab">Also skilled in</span> <span class="more-link">Show ${rest.length} more skills</span></summary><ul>${rest.map(chip).join('')}</ul></details>` : '');
  }

  /* ---------- credentials (newest first) ---------- */
  const certs = [...(D.certifications?.items || [])].sort((a, b) => frac(b.date || '0') - frac(a.date || '0'));
  if (certs.length) {
    $('#credentials').hidden = false;
    $('#nav-creds').hidden = false;
    const todayKey = new Date().toISOString().slice(0, 10);
    const isExpired = c => c.expires && c.expires < todayKey.slice(0, c.expires.length);
    const expiredCount = certs.filter(isExpired).length;
    $('#cred-count').textContent = `${plural(certs.length, 'credential')} · newest first${expiredCount ? ` · ${expiredCount} expired` : ''}`;
    const hue = issuer => /uipath/i.test(issuer) ? '--l1' : /microsoft|azure/i.test(issuer) ? '--l2' : /aws|amazon|google/i.test(issuer) ? '--l3' : /automation anywhere/i.test(issuer) ? '--l5' : '--l4';
    const issuerName = i => /amazon/i.test(i) ? 'AWS' : i;
    // Short display names; the full official name and all details stay in the tooltip.
    const short = c => c.name
      .replace(/^UiPath Certified Professional /, '').replace(/ Certification$/, '')
      .replace(/^Microsoft Certified: /, '').replace(/^Automation Anywhere Certified /, '')
      .replace(/^UiPath Community Most Valuable Professional \(MVP\)$/, `UiPath MVP ${parts(c.date).y}`);
    const tip = c => [c.name, issuerName(c.issuer), c.date && `Issued ${fmt(c.date)}`,
      c.expires ? `${isExpired(c) ? 'Expired' : 'Valid to'} ${fmt(c.expires)}` : 'No expiry',
      c.credentialId && `ID ${c.credentialId}`].filter(Boolean).join(' · ');
    const issuers = [...new Set(certs.map(c => issuerName(c.issuer)))];
    $('#cred-legend').innerHTML = issuers.map(i => {
      const n = certs.filter(c => issuerName(c.issuer) === i).length;
      return `<span><i class="cdot" style="--c:var(${hue(i)})"></i>${esc(i)} · ${n}</span>`;
    }).join('');
    // Classic rail: one row per year, newest first, with a node sized by that year's count.
    const years = [...new Set(certs.map(c => parts(c.date).y))].sort((a, b) => b - a);
    $('#creds').innerHTML = years.map(y => {
      const list = certs.filter(c => parts(c.date).y === y);
      const size = 18 + list.length * 5;
      return `<div class="cyr">
        <span class="cnode" style="width:${size}px;height:${size}px" aria-hidden="true">${list.length}</span>
        <div>
          <h3 class="cy">${y} <small>${plural(list.length, 'credential')}</small></h3>
          <div class="citems">${list.map(c => `<button class="cpill${isExpired(c) ? ' x' : ''}" style="--c:var(${hue(c.issuer || '')})" data-i="${certs.indexOf(c)}" aria-expanded="false" title="${esc(tip(c))}"><i class="cdot"></i>${esc(short(c))}</button>`).join('')}</div>
          <div class="cdetail" hidden aria-live="polite"></div>
        </div>
      </div>`;
    }).join('');
    // Tap or click a credential to see its full details under that year (works on touch screens too).
    $('#creds').addEventListener('click', e => {
      const b = e.target.closest('.cpill'); if (!b) return;
      const c = certs[+b.dataset.i], box = b.closest('.cyr').querySelector('.cdetail');
      const open = b.getAttribute('aria-expanded') !== 'true';
      $('#creds').querySelectorAll('.cpill').forEach(p => p.setAttribute('aria-expanded', 'false'));
      $('#creds').querySelectorAll('.cdetail').forEach(d => { d.hidden = true; });
      if (!open) return;
      b.setAttribute('aria-expanded', 'true');
      box.style.setProperty('--c', `var(${hue(c.issuer || '')})`);
      box.innerHTML = `<b>${esc(c.name)}</b>
        <span>${esc(issuerName(c.issuer || ''))} · Issued ${esc(fmt(c.date))} · ${c.expires ? `${isExpired(c) ? 'Expired' : 'Valid to'} ${esc(fmt(c.expires))}` : 'No expiry'}${c.credentialId ? ` · ID ${esc(c.credentialId)}` : ''}</span>
        ${c.url ? `<a href="${esc(safeUrl(c.url))}"${ext(c.url)}>Verify credential ↗</a>` : ''}`;
      box.hidden = false;
    });
  }

  /* ---------- colour scheme switcher ---------- */
  const SCHEMES = [
    ['Black & gold', [['signal-gold', 'Signal Gold', '#ffc629'], ['champagne', 'Champagne', '#e3c07b'], ['hazard', 'Hazard', '#ffd400'], ['antique-brass', 'Antique Brass', '#c9a227'], ['midnight-gold', 'Midnight Gold', '#f5b82e']]],
    ['Sci-fi', [['neon-grid', 'Neon Grid', '#3cf2ff'], ['cyberpunk', 'Cyberpunk', '#ff2fb3'], ['blade-runner', 'Blade Runner', '#ff7a1a'], ['nebula', 'Nebula', '#b794ff'], ['mission-control', 'Mission Control', '#39ff88']]]
  ];
  const ALL_SCHEMES = SCHEMES.flatMap(([, list]) => list);
  const tBtn = $('#theme-btn'), tMenu = $('#theme-menu');
  const current = () => document.documentElement.dataset.scheme || 'neon-grid';
  tMenu.innerHTML = SCHEMES.map(([group, list]) => `<div><div class="lab">${group}</div><div class="opts">${list.map(([id, name, c]) =>
    `<button class="theme-opt" role="radio" data-id="${id}" aria-checked="false"><i style="background:${c}"></i>${name}</button>`).join('')}</div></div>`).join('');
  const markScheme = () => {
    const id = current();
    tMenu.querySelectorAll('.theme-opt').forEach(b => b.setAttribute('aria-checked', b.dataset.id === id));
    const label = `Change colour theme (current: ${ALL_SCHEMES.find(s => s[0] === id)?.[1] || 'Neon Grid'})`;
    tBtn.setAttribute('aria-label', label);
    tBtn.title = label;
  };
  const setMenu = open => { tMenu.hidden = !open; tBtn.setAttribute('aria-expanded', open); if (open) tMenu.querySelector('[aria-checked="true"]')?.focus(); };
  tBtn.addEventListener('click', () => setMenu(tMenu.hidden));
  tMenu.addEventListener('click', e => {
    const b = e.target.closest('.theme-opt'); if (!b) return;
    if (b.dataset.id === 'neon-grid') delete document.documentElement.dataset.scheme;
    else document.documentElement.dataset.scheme = b.dataset.id;
    try { localStorage.setItem('scheme', b.dataset.id); } catch (err) { /* private mode: choice lasts for this visit */ }
    markScheme();
  });
  document.addEventListener('click', e => { if (!tMenu.hidden && !e.target.closest('.theme')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !tMenu.hidden) { setMenu(false); tBtn.focus(); } });
  markScheme();

  /* ---------- highlight the menu item for the section in view ---------- */
  const navLinks = [...document.querySelectorAll('.bar nav a[href^="#"]')];
  const spied = navLinks.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  const setActive = id => navLinks.forEach(a => {
    if (a.getAttribute('href') === `#${id}`) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
  const updateActive = () => {
    // The active section is the last one whose top has passed a line 35% down the screen;
    // at the very bottom of the page the last section wins.
    const line = innerHeight * 0.35;
    const visible = spied.filter(s => !s.hidden && s.offsetParent !== null);
    let active = visible[0];
    for (const s of visible) if (s.getBoundingClientRect().top <= line) active = s;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) active = visible.at(-1);
    if (active) setActive(active.id);
  };
  let spyFrame = 0;
  addEventListener('scroll', () => { cancelAnimationFrame(spyFrame); spyFrame = requestAnimationFrame(updateActive); }, { passive: true });
  addEventListener('resize', updateActive);
  updateActive();

  /* ---------- contact & footer ---------- */
  $('#contact-note').textContent = P.contactNote;
  $('#links').innerHTML = P.links.map(l => `<a href="${esc(safeUrl(l.url))}"${ext(l.url)} title="${esc(l.handle)}">${esc(l.label)}</a>`).join('');
  const updated = new Date(D.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  $('#foot').textContent = `Data refreshed on ${updated}`;

  /* ---------- scroll effects ---------- */
  // 1. A thin progress line under the top bar shows how far down the page you are.
  const bar = $('.bar');
  const progress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : 0);
  };
  addEventListener('scroll', () => requestAnimationFrame(progress), { passive: true });
  addEventListener('resize', progress);
  progress();

  // 2. Headings and cards rise into place as they scroll into view, with a short stagger.
  //    Skipped for visitors who prefer reduced motion; content is never hidden without script.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const targets = document.querySelectorAll(
      '.kit > *, .stats > div, .feat, section.blk .sh, .cyr, .era, .skill-rest, .talk, .sess, .rec, .art, .book');
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(el => {
      const i = [...el.parentElement.children].indexOf(el);
      el.style.setProperty('--d', `${Math.min(i, 6) * 70}ms`);
      el.classList.add('rv');
      io.observe(el);
    });
    document.documentElement.classList.add('js-reveal');
  }
})();
