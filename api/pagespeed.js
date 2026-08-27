// PageSpeed API Proxy - avoids CORS issues and provides better error handling
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Build API URL with optional API key for higher rate limits
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
    let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=performance&category=accessibility&category=best-practices&category=seo&strategy=desktop`;
    
    if (apiKey) {
      apiUrl += `&key=${apiKey}`;
    }

    // A four-category desktop Lighthouse run can take well over a minute.
    // Abort a little short of the function ceiling so we can return a useful
    // error instead of letting the platform kill us with an HTML 504.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240000);

    let response;
    try {
      response = await fetch(apiUrl, { signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        return res.status(504).json({
          error: 'Google took too long to analyse this site. Large or slow pages sometimes time out, try again or use the Manual button.'
        });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    // Google does not always return JSON on failure. Parsing blind turns a
    // readable upstream error into an unreadable syntax error.
    const rawBody = await response.text();
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return res.status(502).json({
        error: `PageSpeed returned an unreadable response (HTTP ${response.status}). Try again shortly.`
      });
    }

    // Check for API errors
    if (data.error) {
      console.error('PageSpeed API error:', data.error);
      const code = data.error.code;
      let message = data.error.message || 'PageSpeed API error';
      if (code === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(message)) {
        message = 'PageSpeed rate limit reached. Wait a minute and try again.';
      } else if (code === 403) {
        message = 'PageSpeed rejected the request. The API key may be missing, invalid, or not enabled for the PageSpeed Insights API.';
      }
      return res.status(response.status || 500).json({ error: message, code });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `PageSpeed request failed (HTTP ${response.status}).`
      });
    }

    // Extract scores
    const categories = data.lighthouseResult?.categories;
    
    if (!categories) {
      return res.status(500).json({ 
        error: 'Could not analyze website - it may be blocking analysis or unreachable' 
      });
    }

    const scores = {
      performance: Math.round((categories.performance?.score || 0) * 100),
      accessibility: Math.round((categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
      seo: Math.round((categories.seo?.score || 0) * 100),
    };

    return res.status(200).json({ 
      scores,
      fetchedAt: new Date().toISOString(),
      url: data.id
    });

  } catch (error) {
    console.error('PageSpeed proxy error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch PageSpeed scores' 
    });
  }
}
