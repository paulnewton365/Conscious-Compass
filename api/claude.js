// Vercel Serverless Function - Proxies requests to Anthropic API
// API key is stored securely in Vercel environment variables (not exposed to browser)

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from server-side environment variable (NOT prefixed with VITE_)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    const { messages, model, max_tokens, temperature, system, prompt, useWebSearch } = req.body;

    // Support simple prompt syntax (converts to messages format)
    const finalMessages = messages || [{ role: 'user', content: prompt }];

    // Build request body
    const requestBody = {
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: max_tokens || 4096,
      temperature: temperature ?? 0,
      messages: finalMessages,
      ...(system && { system }),
    };

    // Add web search tool if requested
    if (useWebSearch) {
      requestBody.tools = [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5
        }
      ];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        error: error.error?.message || `API error: ${response.status}` 
      });
    }

    const data = await response.json();
    
    // Extract text from response (handles both regular and tool-use responses)
    if (data.content && Array.isArray(data.content)) {
      const textBlocks = data.content.filter(block => block.type === 'text');
      if (textBlocks.length > 0) {
        data.text = textBlocks.map(b => b.text).join('\n');
      }
    }
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
