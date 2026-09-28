// Google Custom Search API Proxy - searches web for brand mentions, news, Wikipedia
export default async function handler(req, res) {
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

  const { query, type } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey) {
    return res.status(500).json({ error: 'Google Search API key not configured' });
  }

  if (!searchEngineId) {
    return res.status(500).json({ error: 'Google Search Engine ID not configured' });
  }

  try {
    // Build search query based on type
    let searchQuery = query;
    let dateRestrict = '';
    
    switch (type) {
      case 'news':
        // Search for recent news about the brand
        searchQuery = `"${query}" news OR press OR announcement`;
        dateRestrict = '&dateRestrict=m3'; // Last 3 months
        break;
      case 'wikipedia':
        // Search specifically for Wikipedia page
        searchQuery = `"${query}" site:wikipedia.org`;
        break;
      case 'reddit':
        // Search for Reddit discussions
        searchQuery = `"${query}" site:reddit.com`;
        break;
      case 'glassdoor':
        // Search for Glassdoor reviews
        searchQuery = `"${query}" site:glassdoor.com reviews`;
        break;
      case 'linkedin':
        // Search for LinkedIn company page
        searchQuery = `"${query}" site:linkedin.com/company`;
        break;
      default:
        // General brand search
        searchQuery = `"${query}"`;
    }

    const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&num=10${dateRestrict}`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.error) {
      console.error('Google Search API error:', data.error);
      return res.status(400).json({ 
        error: data.error.message || 'Search API error',
        code: data.error.code 
      });
    }

    // Process results
    const results = (data.items || []).map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink,
      source: item.displayLink?.replace('www.', '').split('/')[0] || 'Unknown'
    }));

    return res.status(200).json({
      query: searchQuery,
      type: type || 'general',
      totalResults: data.searchInformation?.totalResults || '0',
      results,
      fetchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Google Search proxy error:', error);
    return res.status(500).json({ error: error.message || 'Failed to perform search' });
  }
}
