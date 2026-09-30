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

// Sections that fade up but never draw their data in. The trust lens draws
// its scale markers since v3.111.0 (all sliders and scales move); its columns
// stay still because no rule targets them.
const FADE_ONLY = ['#campaign-coherence'];

// Scores that count up from 0 (v3.111.0): whole numbers 0 to 100 in these
// places. The final value stays in the page until the count starts, is what
// printing, the Word export and reduced motion see, and is where every count
// ends.
const COUNT_SELECTOR = '.dc-stat-n, .dc-maturity-marker span, .dc-bm-v';
const COUNT_MS = 900;

function countTargets(section) {
  const out = [];
  section.querySelectorAll(COUNT_SELECTOR).forEach(el => {
    const node = [...el.childNodes].find(n => n.nodeType === 3 && /^\s*\d{1,3}\s*$/.test(n.nodeValue));
    if (!node) return;
    const final = Number(node.nodeValue.trim());
    if (final > 100) return;
    out.push({ el, node, final });
  });
  return out;
}

// Count one section's scores from 0 to their values, once.
function countUp(section, win) {
  if (section.__ccCounted) return;
  section.__ccCounted = true;
  const targets = countTargets(section);
  if (!targets.length) return;
  targets.forEach(t => { t.node.nodeValue = '0'; t.el.setAttribute('aria-label', String(t.final)); });
  const start = win.performance?.now?.() ?? Date.now();
  const raf = win.requestAnimationFrame?.bind(win) || ((f) => win.setTimeout(() => f(Date.now()), 16));
  const tick = (now) => {
    if (section.__ccFinish) {   // printing or exporting: jump to the final values
      targets.forEach(t => { t.node.nodeValue = String(t.final); t.el.removeAttribute('aria-label'); });
      return;
    }
    const p = Math.max(0, Math.min(1, ((now ?? Date.now()) - start) / COUNT_MS));   // the frame clock can run a hair behind the start
    const eased = 1 - Math.pow(1 - p, 3);
    targets.forEach(t => { t.node.nodeValue = String(Math.round(t.final * eased)); });
    if (p < 1) raf(tick);
    else targets.forEach(t => { t.node.nodeValue = String(t.final); t.el.removeAttribute('aria-label'); });
  };
  raf(tick);
}

// Draw a section's data: markers slide, bars grow, scores count.
function draw(section, win) {
  section.classList.add('is-drawn');
  countUp(section, win);
}

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
  // (root is the report root; used above to re-enable transitions)
  if (!root) return 0;
  let n = 0;
  root.querySelectorAll(SECTION_SELECTOR).forEach(el => {
    if (el.hasAttribute('data-reveal')) return;
    const fadeOnly = FADE_ONLY.some(sel => el.matches(sel) || el.querySelector(sel));
    el.setAttribute('data-reveal', fadeOnly ? 'fade' : 'draw');
    if (!observer) { el.classList.add('is-revealed', 'is-drawn'); return; }
    if (inViewport(el, win)) {
      // On screen when it appears: the section shows at once (no fade), and
      // its data draws a moment later, so the top of the report moves too.
      el.classList.add('is-revealed');
      const later = win.requestAnimationFrame?.bind(win) || ((f) => win.setTimeout(f, 16));
      later(() => later(() => {
        root.classList.remove('dc-motion-init');   // transitions back on first,
        void el.offsetWidth;                       // so the draw below animates
        draw(el, win);
      }));
    } else observer.observe(el);
    n += 1;
  });
  return n;
}

// Start motion on a report root. Returns a cleanup function.
export function startScrollMotion(root, win = typeof window !== 'undefined' ? window : null) {
  if (!root || !win) return () => {};
  if (!motionAllowed(win)) {
    root.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-revealed', 'is-drawn'));
    return () => {};
  }
  const observer = new win.IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); draw(entry.target, win); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
  // Motion on before anything is measured, with transitions held off while
  // sections are set up: measuring first fixed the markers' starting point at
  // their final place, so they jolted back to 0 and out again (v3.111.0).
  root.classList.add('dc-motion', 'dc-motion-init');
  tagSections(root, observer, win);
  root.__ccMotion = observer;
  const later = win.requestAnimationFrame?.bind(win) || ((f) => win.setTimeout(f, 16));
  later(() => later(() => root.classList.remove('dc-motion-init')));
  // Printing sees the finished report: markers in place, scores final.
  const onPrint = () => revealAll(win.document);
  win.addEventListener?.('beforeprint', onPrint);
  return () => { observer.disconnect(); win.removeEventListener?.('beforeprint', onPrint); };
}

// The finished state, at once: used before the Word export captures panels,
// so a section nobody scrolled to is never captured blank or half-drawn.
export function revealAll(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return;
  doc.querySelectorAll('.dc-motion').forEach(root => {
    root.querySelectorAll('[data-reveal]').forEach(el => {
      el.classList.add('is-revealed', 'is-drawn');
      el.__ccCounted = true;   // no count starts after this
      el.__ccFinish = true;    // and any count running stops at its final value
    });
    // Any count in progress jumps to its final value.
    root.querySelectorAll('[aria-label]').forEach(el => {
      const node = [...el.childNodes].find(n => n.nodeType === 3 && /^\s*\d{1,3}\s*$/.test(n.nodeValue));
      const final = el.getAttribute('aria-label');
      if (node && /^\d{1,3}$/.test(final)) { node.nodeValue = final; el.removeAttribute('aria-label'); }
    });
    root.classList.remove('dc-motion');
    root.classList.add('dc-motion-done');   // stops any slide mid-way
  });
}

// Pick up sections that appeared since the last render (a section opened,
// data arriving). Untagged sections are simply visible, never hidden.
export function retagSections(root, win = typeof window !== 'undefined' ? window : null) {
  if (!root || !win || !root.__ccMotion || !root.classList.contains('dc-motion')) return 0;
  return tagSections(root, root.__ccMotion, win);
}
