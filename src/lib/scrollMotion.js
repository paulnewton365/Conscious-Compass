// ─────────────────────────────────────────────────────────────
// SCROLL MOTION for the three reports (v3.108.0).
//
// One IntersectionObserver per report tags each section as it enters the
// screen; CSS does all the movement, so nothing re-renders frame by frame.
// Each section fades up once. Sections marked "draw" also grow their data:
// bars, tracks and bands from zero, markers settling after, radar polygons
// from the centre. Campaign coherence and the trust lens only fade up, as
// their design packets asked for no motion in the data. Numbers never count.
//
// Guards: no motion when the device asks for reduced motion or has no
// observer; sections already on screen at load are revealed before motion is
// switched on, so nothing flashes empty; printing and the Word export see the
// finished state (revealAll). Content is only faded, never hidden, so screen
// readers and search-in-page find everything.
// ─────────────────────────────────────────────────────────────

// Sections that fade up but never draw their data in.
const FADE_ONLY = ['#campaign-coherence', '#trust-lens'];

// What counts as a section inside each report root.
const SECTION_SELECTOR = ':scope > section, :scope > .dc-reveal, :scope > header, :scope > figure, :scope > ul, :scope > div, :scope > footer';

export function motionAllowed(win = typeof window !== 'undefined' ? window : null) {
  if (!win || typeof win.IntersectionObserver === 'undefined') return false;
  try { return !win.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
}

const inViewport = (el, win) => {
  const r = el.getBoundingClientRect();
  const h = win.innerHeight || win.document.documentElement.clientHeight;
  return r.top < h && r.bottom > 0;
};

// Tag any sections in the root that aren't tagged yet. Safe to call on every
// render: new sections (a section expanded, data arriving) are picked up.
export function tagSections(root, observer, win = window) {
  if (!root) return 0;
  let n = 0;
  root.querySelectorAll(SECTION_SELECTOR).forEach(el => {
    if (el.hasAttribute('data-reveal')) return;
    const fadeOnly = FADE_ONLY.some(sel => el.matches(sel) || el.querySelector(sel));
    el.setAttribute('data-reveal', fadeOnly ? 'fade' : 'draw');
    // Already on screen when it appears: show it as it is, no animation.
    if (!observer || inViewport(el, win)) el.classList.add('is-revealed');
    else observer.observe(el);
    n += 1;
  });
  return n;
}

// Start motion on a report root. Returns a cleanup function.
export function startScrollMotion(root, win = typeof window !== 'undefined' ? window : null) {
  if (!root || !win) return () => {};
  if (!motionAllowed(win)) {
    root.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-revealed'));
    return () => {};
  }
  const observer = new win.IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
  tagSections(root, observer, win);
  root.__ccMotion = observer;
  // Switched on only after the on-screen sections are revealed, so nothing
  // visible at load ever starts hidden.
  root.classList.add('dc-motion');
  return () => observer.disconnect();
}

// The finished state, at once: used before the Word export captures panels,
// so a section nobody scrolled to is never captured blank or half-drawn.
export function revealAll(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return;
  doc.querySelectorAll('.dc-motion').forEach(root => {
    root.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-revealed'));
    root.classList.remove('dc-motion');
  });
}

// Pick up sections that appeared since the last render (a section opened,
// data arriving). Untagged sections are simply visible, never hidden.
export function retagSections(root, win = typeof window !== 'undefined' ? window : null) {
  if (!root || !win || !root.__ccMotion || !root.classList.contains('dc-motion')) return 0;
  return tagSections(root, root.__ccMotion, win);
}
