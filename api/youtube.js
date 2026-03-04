// YouTube Data API Proxy - fetches branded channel AND third-party coverage
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

  const { query, website } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const apiKey = process.env.GOOGLE_YOUTUBE_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'YouTube API key not configured' });
  }

  try {
    // Extract domain from website for matching (e.g., "antennagroup" from "antennagroup.com")
    let domainHint = '';
    if (website) {
      try {
        const url = new URL(website.startsWith('http') ? website : 'https://' + website);
        domainHint = url.hostname.replace('www.', '').split('.')[0].toLowerCase();
      } catch (e) {}
    }

    // 1. SEARCH FOR BRANDED CHANNEL
    // Look for channels that match the brand name closely
    const channelSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=5&key=${apiKey}`;
    
    const channelSearchResponse = await fetch(channelSearchUrl);
    const channelSearchData = await channelSearchResponse.json();

    if (channelSearchData.error) {
      return res.status(400).json({ error: channelSearchData.error.message });
    }

    let brandedChannel = null;
    let brandedChannelStats = null;

    // Find the best matching channel (exact or close match to brand name)
    if (channelSearchData.items && channelSearchData.items.length > 0) {
      const queryLower = query.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Score each channel on how well it matches
      const scoredChannels = channelSearchData.items.map(item => {
        const titleLower = item.snippet.channelTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const descLower = (item.snippet.description || '').toLowerCase();
        
        let score = 0;
        
        // Exact match = highest score
        if (titleLower === queryLower) score += 100;
        // Title starts with brand name
        else if (titleLower.startsWith(queryLower)) score += 80;
        // Title contains brand name
        else if (titleLower.includes(queryLower)) score += 50;
        // Brand name contains title (for abbreviations)
        else if (queryLower.includes(titleLower) && titleLower.length > 3) score += 40;
        
        // Check if domain hint matches
        if (domainHint && titleLower.includes(domainHint)) score += 30;
        
        // Check description for official indicators
        if (descLower.includes('official') || descLower.includes('our channel')) score += 20;
        
        // Penalize if it looks like a third-party channel
        if (titleLower.includes('review') || titleLower.includes('news') || titleLower.includes('about')) score -= 30;
        
        return { item, score };
      });

      // Sort by score and get best match
      scoredChannels.sort((a, b) => b.score - a.score);
      
      // Only accept if score is reasonably high (indicates likely official channel)
      if (scoredChannels[0] && scoredChannels[0].score >= 50) {
        const bestMatch = scoredChannels[0].item;
        const channelId = bestMatch.snippet.channelId;

        // Get channel statistics
        const statsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&id=${channelId}&key=${apiKey}`;
        const statsResponse = await fetch(statsUrl);
        const statsData = await statsResponse.json();

        if (statsData.items && statsData.items.length > 0) {
          const channel = statsData.items[0];
          const stats = channel.statistics;
          const snippet = channel.snippet;

          brandedChannel = {
            channelId,
            channelTitle: snippet.title,
            channelUrl: `https://www.youtube.com/channel/${channelId}`,
            customUrl: snippet.customUrl ? `https://www.youtube.com/${snippet.customUrl}` : null,
            description: snippet.description,
            publishedAt: snippet.publishedAt,
            country: snippet.country,
            thumbnail: snippet.thumbnails?.default?.url,
            matchScore: scoredChannels[0].score
          };

          brandedChannelStats = {
            subscriberCount: parseInt(stats.subscriberCount) || 0,
            videoCount: parseInt(stats.videoCount) || 0,
            viewCount: parseInt(stats.viewCount) || 0,
            subscriberCountHidden: stats.hiddenSubscriberCount || false
          };
        }
      }
    }

    // 2. SEARCH FOR THIRD-PARTY COVERAGE (videos ABOUT the brand)
    const videoSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query + ' review OR ' + query + ' explained OR ' + query + ' news')}&maxResults=10&order=relevance&key=${apiKey}`;
    
    const videoSearchResponse = await fetch(videoSearchUrl);
    const videoSearchData = await videoSearchResponse.json();

    let thirdPartyCoverage = [];
    
    if (videoSearchData.items && videoSearchData.items.length > 0) {
      // Filter out videos from the branded channel itself
      const brandedChannelId = brandedChannel?.channelId;
      
      thirdPartyCoverage = videoSearchData.items
        .filter(item => item.snippet.channelId !== brandedChannelId)
        .slice(0, 5)
        .map(item => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          description: item.snippet.description?.slice(0, 200),
          thumbnail: item.snippet.thumbnails?.default?.url,
          videoUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
    }

    return res.status(200).json({
      query,
      // Branded Channel Results
      hasBrandedChannel: !!brandedChannel,
      brandedChannel,
      brandedChannelStats,
      // Third-Party Coverage Results
      thirdPartyCoverageCount: thirdPartyCoverage.length,
      thirdPartyCoverage,
      // Summary
      summary: {
        hasOfficialPresence: !!brandedChannel,
        subscriberTier: brandedChannelStats 
          ? (brandedChannelStats.subscriberCount >= 100000 ? 'Large (100K+)' 
            : brandedChannelStats.subscriberCount >= 10000 ? 'Medium (10K-100K)'
            : brandedChannelStats.subscriberCount >= 1000 ? 'Small (1K-10K)'
            : 'Minimal (<1K)')
          : 'No channel found',
        thirdPartyCoverage: thirdPartyCoverage.length >= 5 ? 'Strong' 
          : thirdPartyCoverage.length >= 2 ? 'Moderate' 
          : thirdPartyCoverage.length >= 1 ? 'Limited'
          : 'None found'
      },
      fetchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('YouTube API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch YouTube data' });
  }
}
