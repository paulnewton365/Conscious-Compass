// Google Knowledge Graph API Proxy - checks if brand is a known entity
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

  const apiKey = process.env.GOOGLE_KNOWLEDGE_GRAPH_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Knowledge Graph API key not configured' });
  }

  try {
    const apiUrl = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(query)}&key=${apiKey}&limit=5&indent=true`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.error) {
      console.error('Knowledge Graph API error:', data.error);
      return res.status(400).json({ 
        error: data.error.message || 'Knowledge Graph API error' 
      });
    }

    // Process entities
    const entities = (data.itemListElement || []).map(item => {
      const entity = item.result;
      return {
        name: entity.name,
        type: entity['@type'] || [],
        description: entity.description,
        detailedDescription: entity.detailedDescription?.articleBody,
        url: entity.detailedDescription?.url,
        image: entity.image?.contentUrl,
        score: item.resultScore
      };
    });

    // Find best match (highest score that matches query closely)
    const bestMatch = entities.find(e => 
      e.name?.toLowerCase().includes(query.toLowerCase()) ||
      query.toLowerCase().includes(e.name?.toLowerCase())
    ) || entities[0];

    return res.status(200).json({
      query,
      found: entities.length > 0,
      entityCount: entities.length,
      bestMatch: bestMatch || null,
      allEntities: entities,
      // Indicate if brand is recognized by Google Knowledge Graph
      isKnownEntity: entities.length > 0 && entities[0].score > 100,
      knowledgeGraphSignal: entities.length > 0 
        ? (entities[0].score > 500 ? 'Strong' : entities[0].score > 100 ? 'Moderate' : 'Weak')
        : 'Not Found',
      fetchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Knowledge Graph proxy error:', error);
    return res.status(500).json({ error: error.message || 'Failed to query Knowledge Graph' });
  }
}
