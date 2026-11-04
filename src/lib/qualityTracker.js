// The quality record's tracker (v4.19.0). Watches the open evidence step and
// keeps the record in a ref, so typing never re-renders the whole app. The
// record is written into assessments.quality when the step changes, every
// minute, and when the assessment is saved.
//
// What it watches, inside the element marked data-quality-step:
//   active time   focus, input, a click, a key or a scroll within two minutes
//   auto-filled   a field whose text the app set (no typing), or one carrying
//                 the app's own measured, verified or scraped marker, or an
//                 auto-checked panel
//   opened        focusing an auto-filled field, or opening a panel to correct
//   edited        typing into an auto-filled field
import { useEffect, useMemo, useRef } from 'react';
import {
  ACTIVE_WINDOW_MS, addActiveTime, isAutoText, newQualityRecord, noteField, setNotApplicable,
} from './assessmentQuality.js';

const TICK_MS = 15000;
const SCAN_MS = 1500;
const FLUSH_MS = 60000;
// Text the app sets that is shorter than this is a label or a status, not content.
const AUTO_MIN_CHARS = 20;

const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);

// A field's name: the title of the block it sits in, plus its place there.
export function fieldIdentity(el) {
  const panel = el.closest?.('.dc-autopanel');
  const target = panel || el;
  const block = target.closest?.('.dc-block, section, [data-field]');
  const title = (block?.querySelector?.('.dc-block-t, h2, h3, h4')?.textContent || '').replace(/\s+/g, ' ').trim()
    || el.getAttribute?.('aria-label') || '';
  if (!panel && el.id) return { key: el.id, label: title || el.id };
  const kind = panel ? '.dc-autopanel' : 'textarea';
  const siblings = block ? [...block.querySelectorAll(kind)] : [];
  const idx = Math.max(0, siblings.indexOf(target));
  const label = title || (panel ? 'Auto-checked content' : 'Field');
  return { key: `${panel ? 'auto' : 'field'}:${label}#${idx}`, label: idx ? `${label} (${idx + 1})` : label };
}

export function useQualityTracker({ stepId, record, name, getAssessments, onFlush, isPartial }) {
  const recRef = useRef(null);
  const flushedRef = useRef(undefined);
  const lastActive = useRef(0);
  const listeners = useRef(new Set());
  const seen = useRef(new WeakMap());
  const nameRef = useRef(name);
  const flushRef = useRef(onFlush);
  const partialRef = useRef(isPartial);
  const assessRef = useRef(getAssessments);
  useEffect(() => {
    nameRef.current = name;
    flushRef.current = onFlush;
    partialRef.current = isPartial;
    assessRef.current = getAssessments;
  });

  // A record loaded or replaced from outside (a saved assessment, a new one).
  // Declared before the step effect, so it runs first after the same render.
  useEffect(() => {
    if (record === flushedRef.current) return;
    flushedRef.current = record;
    recRef.current = record ? clone(record) : null;
    listeners.current.forEach(fn => { try { fn(); } catch { /* a closed box */ } });
  }, [record]);

  const ensure = () => {
    if (!recRef.current) recRef.current = newQualityRecord({ name: nameRef.current, partial: partialRef.current ? partialRef.current() : false });
    return recRef.current;
  };
  const emit = () => listeners.current.forEach(fn => { try { fn(); } catch { /* a closed box */ } });
  const flush = () => {
    if (!recRef.current) return;
    const out = clone(recRef.current);
    flushedRef.current = out;
    flushRef.current?.(out);
  };

  const store = useMemo(() => ({
    get: () => recRef.current,
    getAssessments: () => (assessRef.current ? assessRef.current() : {}),
    subscribe: (fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); },
    markNotApplicable: (sid, reason) => { setNotApplicable(ensure(), sid, reason, nameRef.current); emit(); flush(); },
    // handleSave reads the live record, not the last flush.
    snapshot: () => clone(recRef.current),
  }), []);

  useEffect(() => {
    if (!stepId || typeof window === 'undefined') return undefined;
    ensure();
    lastActive.current = Date.now();
    const root = () => document.querySelector('[data-quality-step]');
    const inside = (el) => { const r = root(); return r && el && r.contains(el) && !el.closest('[data-quality-box]'); };
    const mark = (el, patch) => {
      const { key, label } = fieldIdentity(el);
      noteField(ensure(), stepId, key, { label, ...patch });
    };
    const isAuto = (el) => {
      const { key } = fieldIdentity(el);
      return !!recRef.current?.steps?.[stepId]?.fields?.[key]?.auto;
    };

    const onActive = () => { lastActive.current = Date.now(); };
    const onFocus = (e) => {
      onActive();
      const el = e.target;
      if (!inside(el)) return;
      if (el.tagName === 'TEXTAREA' || el.closest('.dc-autopanel')) {
        if (isAuto(el) || el.closest('.dc-autopanel')) { mark(el, { opened: true }); emit(); }
      }
    };
    const onPointer = (e) => {
      onActive();
      const el = e.target;
      if (!inside(el)) return;
      // Opening an auto-checked panel to correct it.
      if (el.closest('.dc-autopanel')) { mark(el, { auto: true, opened: true }); emit(); }
    };
    const onInput = (e) => {
      onActive();
      const el = e.target;
      if (!inside(el) || el.tagName !== 'TEXTAREA') return;
      const st = seen.current.get(el) || {};
      seen.current.set(el, { ...st, typed: true });
      if (isAuto(el) || el.closest('.dc-autopanel')) mark(el, { opened: true, edited: true });
      // Observations and sources show on the checklist too.
      emit();
    };

    const scan = () => {
      const r = root();
      if (!r) return;
      let changed = false;
      r.querySelectorAll('textarea').forEach(el => {
        if (el.closest('[data-quality-box]')) return;
        const v = el.value || '';
        const st = seen.current.get(el);
        if (!st) {
          if (isAutoText(v)) { mark(el, { auto: true }); changed = true; }
        } else if (v !== st.value && !st.typed && v.trim().length >= AUTO_MIN_CHARS) {
          mark(el, { auto: true }); changed = true;
        }
        seen.current.set(el, { value: v, typed: false });
      });
      r.querySelectorAll('.dc-autopanel').forEach(p => {
        const { key } = fieldIdentity(p);
        if (!recRef.current?.steps?.[stepId]?.fields?.[key]) { mark(p, { auto: true }); changed = true; }
        if (p.classList.contains('is-edited') && !recRef.current.steps[stepId].fields[key].edited) { mark(p, { opened: true, edited: true }); changed = true; }
      });
      if (changed) emit();
    };

    let lastTick = Date.now();
    const tick = () => {
      const now = Date.now();
      const step = Math.min(now - lastTick, TICK_MS * 2);
      lastTick = now;
      const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
      if (visible && now - lastActive.current < ACTIVE_WINDOW_MS) {
        addActiveTime(ensure(), stepId, step, nameRef.current);
        emit();
      }
    };

    const opts = { capture: true, passive: true };
    window.addEventListener('focusin', onFocus, opts);
    window.addEventListener('pointerdown', onPointer, opts);
    window.addEventListener('input', onInput, opts);
    window.addEventListener('keydown', onActive, opts);
    window.addEventListener('scroll', onActive, opts);
    window.addEventListener('wheel', onActive, opts);
    window.addEventListener('pagehide', flush);
    const t1 = setInterval(tick, TICK_MS);
    const t2 = setInterval(scan, SCAN_MS);
    const t3 = setInterval(flush, FLUSH_MS);
    const t0 = setTimeout(scan, 300);
    return () => {
      tick();
      // Written after this commit's effects: if the assessment was replaced
      // (a new one, another loaded), the record has been swapped by then and
      // the old one is not written into it.
      setTimeout(flush, 0);
      window.removeEventListener('focusin', onFocus, opts);
      window.removeEventListener('pointerdown', onPointer, opts);
      window.removeEventListener('input', onInput, opts);
      window.removeEventListener('keydown', onActive, opts);
      window.removeEventListener('scroll', onActive, opts);
      window.removeEventListener('wheel', onActive, opts);
      window.removeEventListener('pagehide', flush);
      clearInterval(t1); clearInterval(t2); clearInterval(t3); clearTimeout(t0);
    };
  }, [stepId]);

  return store;
}
