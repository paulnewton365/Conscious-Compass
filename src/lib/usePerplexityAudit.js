// Runs a Perplexity website or social audit on its step (v4.21.0). The run
// is a background research job: it keeps going if the assessor leaves the
// step, and is picked up again on return (the run id is saved with the step).
import { useEffect, useRef, useState } from 'react';
import { startMediaAudit, waitForMediaAudit } from './mediaAudit.js';
import { normalizeWebAudit, webAuditText } from './perplexityAudits.js';

export function usePerplexityAudit({ kind, data = {}, setData, input }) {
  const [text, setTextState] = useState(data.perplexityContent || '');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const stop = useRef(false);
  const inputRef = useRef(input);
  const setRef = useRef(setData);
  useEffect(() => { inputRef.current = input; setRef.current = setData; });

  const keep = (res) => {
    const ranAt = new Date().toISOString();
    const t = webAuditText(res.audit, kind, { ranAt });
    setTextState(t);
    setRef.current({ perplexityContent: t, perplexityAudit: { audit: res.audit, ranAt, cost: res.cost ?? null }, perplexityRun: null });
  };
  const follow = async (id, startedAt) => {
    setRunning(true);
    const res = await waitForMediaAudit(id, { startedAt, shouldStop: () => stop.current, onTick: (ms) => setElapsed(ms), normalize: (raw) => normalizeWebAudit(raw, kind) });
    if (res.status === 'stopped') return;
    setRunning(false);
    if (res.status === 'completed' && res.audit) keep(res);
    else { setError(res.error || 'The audit did not finish.'); setRef.current({ perplexityRun: null }); }
  };
  const run = async () => {
    if (text.trim() && !window.confirm('Run the Perplexity audit again? This replaces the current audit, including any corrections made to it.')) return;
    setError(null);
    setRunning(true);
    setElapsed(0);
    const start = await startMediaAudit({ kind, ...inputRef.current });
    if (start.status === 'completed' && start.audit) {
      setRunning(false);
      const audit = normalizeWebAudit(start.audit, kind);
      if (audit) keep({ ...start, audit }); else setError('The audit finished but could not be read.');
      return;
    }
    if (start.status === 'failed' || !start.id) {
      setRunning(false);
      setError(start.notConfigured ? 'Perplexity is not set up: PERPLEXITY_API_KEY needs adding in Vercel.' : `The audit could not start: ${start.error || 'unknown error'}.`);
      return;
    }
    const startedAt = Date.now();
    setRef.current({ perplexityRun: { id: start.id, startedAt } });
    follow(start.id, startedAt);
  };
  useEffect(() => {
    stop.current = false;
    const r = data.perplexityRun;
    const t = r?.id ? setTimeout(() => follow(r.id, r.startedAt || Date.now()), 0) : null;
    return () => { stop.current = true; if (t) clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    text,
    setText: (v) => { setTextState(v); setRef.current({ perplexityContent: v }); },
    running, elapsed, error, run,
    audit: normalizeWebAudit(data.perplexityAudit?.audit, kind),
    ranAt: data.perplexityAudit?.ranAt || null,
  };
}
