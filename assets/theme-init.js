// Applies the visitor's saved colour scheme before the page paints, to avoid a flash.
// Loaded as a normal file (not inline) so the Content Security Policy can forbid inline scripts.
try {
  const s = localStorage.getItem('scheme');
  if (s && /^[a-z-]{1,30}$/.test(s) && s !== 'neon-grid') document.documentElement.dataset.scheme = s;
} catch (e) { /* storage blocked: default scheme */ }
