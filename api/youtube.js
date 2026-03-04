// YouTube Data API Proxy - fetches channel statistics
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

  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const apiKey = process.env.GOOGLE_YOUTUBE_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'YouTube API key not configured' });
  }

  try {
    // First, search for the channel
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${apiKey}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.error) {
      return res.status(400).json({ error: searchData.error.message });
    }

    if (!searchData.items || searchData.items.length === 0) {
      return res.status(200).json({ 
        found: false,
        message: `No YouTube channel found for "${query}"`
      });
    }

    const channelId = searchData.items[0].snippet.channelId;
    const channelTitle = searchData.items[0].snippet.channelTitle;

    // Now get channel statistics
    const statsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&id=${channelId}&key=${apiKey}`;
    
    const statsResponse = await fetch(statsUrl);
    const statsData = await statsResponse.json();

    if (statsData.error) {
      return res.status(400).json({ error: statsData.error.message });
    }

    if (!statsData.items || statsData.items.length === 0) {
      return res.status(200).json({ 
        found: false,
        message: 'Could not retrieve channel statistics'
      });
    }

    const channel = statsData.items[0];
    const stats = channel.statistics;
    const snippet = channel.snippet;

    return res.status(200).json({
      found: true,
      channelId,
      channelTitle: snippet.title,
      channelUrl: `https://www.youtube.com/channel/${channelId}`,
      description: snippet.description,
      customUrl: snippet.customUrl ? `https://www.youtube.com/${snippet.customUrl}` : null,
      publishedAt: snippet.publishedAt,
      country: snippet.country,
      subscriberCount: parseInt(stats.subscriberCount) || 0,
      videoCount: parseInt(stats.videoCount) || 0,
      viewCount: parseInt(stats.viewCount) || 0,
      subscriberCountHidden: stats.hiddenSubscriberCount || false,
      thumbnail: snippet.thumbnails?.default?.url,
      fetchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('YouTube API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch YouTube data' });
  }
}
