export interface ModelConfig {
  provider: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;
  xaiApiKey?: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
  customEndpoint?: string;
  customModel?: string;
  customApiKey?: string;
}

export function stripJsonFences(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  const objStart = t.indexOf('{');
  const arrStart = t.indexOf('[');
  const start =
    objStart === -1
      ? arrStart
      : arrStart === -1
        ? objStart
        : Math.min(objStart, arrStart);
  if (start > 0) t = t.slice(start);
  return t.trim();
}

export async function makeAiRequest(
  prompt: string,
  modelConfig: ModelConfig
): Promise<string> {
  const provider = modelConfig.provider || 'none';
  if (provider === 'none') throw new Error('No AI provider configured.');

  if (provider === 'gemini') {
    const key = modelConfig.geminiApiKey;
    if (!key) throw new Error('Gemini API key required.');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (provider === 'anthropic') {
    const key = modelConfig.anthropicApiKey;
    if (!key) throw new Error('Anthropic API key required.');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
    const data = await res.json();
    return data.content[0].text;
  }

  if (provider === 'openai') {
    const key = modelConfig.openaiApiKey;
    if (!key) throw new Error('OpenAI API key required.');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === 'groq') {
    const key = modelConfig.groqApiKey;
    if (!key) throw new Error('Groq API key required.');
    const res = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
      }
    );
    if (!res.ok) throw new Error(`Groq error: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === 'xai') {
    const key = modelConfig.xaiApiKey;
    if (!key) throw new Error('xAI API key required.');
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`xAI error: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === 'ollama') {
    const endpoint = (
      modelConfig.ollamaEndpoint || 'http://localhost:11434'
    ).replace(/\/$/, '');
    const res = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelConfig.ollamaModel || 'llama3',
        prompt,
        stream: false,
        format: 'json',
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
    const data = await res.json();
    return data.response;
  }

  if (provider === 'custom') {
    const endpoint = (modelConfig.customEndpoint || '').replace(/\/$/, '');
    const key = modelConfig.customApiKey;
    if (!endpoint) throw new Error('Custom endpoint required.');
    if (!key) throw new Error('Custom API key required.');
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: modelConfig.customModel || 'default',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`Custom API error: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function fetchRealPosts(queries: string[]): Promise<string> {
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const results: string[] = [];

  for (const rawQuery of queries.slice(0, 3)) {
    const query = rawQuery.trim();
    if (!query) continue;
    const encoded = encodeURIComponent(query);

    results.push(
      `[Reddit Search — use as sourceUrl]\n` +
        `URL: https://www.reddit.com/search/?q=${encoded}&sort=new&t=week\n` +
        `Subreddit: https://www.reddit.com/r/all/search/?q=${encoded}&sort=new&t=week&restrict_sr=0\n`
    );

    try {
      const h = await fetch(
        `https://hn.algolia.com/api/v1/search?query=${encoded}&tags=story&numericFilters=created_at_i>${weekAgo}&hitsPerPage=4`
      );
      if (h.ok) {
        const data = await h.json();
        for (const hit of data?.hits || []) {
          const ageH = Math.round(
            (Date.now() - new Date(hit.created_at).getTime()) / 3600000
          );
          const age =
            ageH < 24 ? `${ageH}h ago` : `${Math.round(ageH / 24)}d ago`;
          results.push(
            `[HackerNews | ${age} | ${hit.points || 0} pts]\n` +
              `Title: ${hit.title}\n` +
              `URL: ${hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`}\n` +
              `HN: https://news.ycombinator.com/item?id=${hit.objectID}\n`
          );
        }
      }
    } catch {}
  }

  return results.join('\n---\n');
}
