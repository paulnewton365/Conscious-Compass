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
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=performance&category=accessibility&category=best-practices&category=seo&strategy=desktop`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    // Check for API errors
    if (data.error) {
      console.error('PageSpeed API error:', data.error);
      return res.status(response.status).json({ 
        error: data.error.message || 'PageSpeed API error',
        code: data.error.code
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
