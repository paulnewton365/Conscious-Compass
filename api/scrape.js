// Server-side proxy for Jina Reader.
//
// Fetching r.jina.ai straight from the browser is unreliable: CORS varies by
// response type, and a failed preflight is indistinguishable from an empty
// page. Going through the function keeps the failure legible and lets us cap
// the payload before it reaches the model.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url, maxChars } = req.query;
  if (!url) return res.status(400).json({ error: 'URL parameter is required' });

  // Reject a non-http scheme before the prefix below disguises it: without
  // this, "file:///etc/passwd" becomes "https://file:///etc/passwd", passes
  // the protocol check, and is only stopped by the upstream fetcher.
  if (/^[a-z][a-z0-9+.-]*:/i.test(String(url)) && !/^https?:/i.test(String(url))) {
    return res.status(400).json({ error: 'Only http and https URLs can be scraped.' });
  }

  const target = String(url).startsWith('http') ? String(url) : `https://${url}`;
  try {
    // Reject anything that is not a plain public web address before we hand it
    // to a fetcher: no internal hostnames, no non-http schemes.
    const parsed = new URL(target);
    if (!/^https?:$/.test(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http and https URLs can be scraped.' });
    }
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/i.test(parsed.hostname)) {
      return res.status(400).json({ error: 'That address cannot be scraped.' });
    }
  } catch {
    return res.status(400).json({ error: 'That is not a valid URL.' });
  }

  const cap = Math.min(Number(maxChars) || 12000, 30000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const headers = { 'Accept': 'text/plain', 'X-Return-Format': 'text' };
    // Optional. Without a key Jina still works but is rate limited by IP.
    if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;

    const r = await fetch(`https://r.jina.ai/${target}`, { headers, signal: controller.signal });

    if (!r.ok) {
      return res.status(502).json({
        error: r.status === 429
          ? 'The scraper is rate limited right now. Wait a moment and try again.'
          : `Could not read that page (HTTP ${r.status}).`,
      });
    }

    const text = await r.text();
    if (!text || text.trim().length < 40) {
      return res.status(422).json({ error: 'That page returned almost no readable text. It may be script-rendered or blocked.' });
    }

    const trimmed = text.length > cap ? text.slice(0, cap) : text;
    return res.status(200).json({
      url: target,
      chars: trimmed.length,
      truncated: text.length > cap,
      text: trimmed,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'The page took too long to read.' });
    }
    console.error('Scrape error:', err);
    return res.status(500).json({ error: err.message || 'Could not read that page.' });
  } finally {
    clearTimeout(timeout);
  }
}
