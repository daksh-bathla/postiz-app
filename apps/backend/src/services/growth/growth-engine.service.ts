import { Injectable } from '@nestjs/common';

const PROVIDERS_MAP: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5',
  groq: 'llama-3.3-70b-versatile',
  xai: 'grok-3',
};

function stripJsonFences(text: string): string {
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

@Injectable()
export class GrowthEngineService {

  async makeAiRequest(
    prompt: string,
    modelConfig: any
  ): Promise<string> {
    const provider = modelConfig?.provider || 'none';
    if (provider === 'none') throw new Error('No AI provider configured.');

    if (provider === 'gemini') {
      const apiKey = modelConfig.geminiApiKey;
      if (!apiKey) throw new Error('Gemini API key required.');
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const endpoints: Record<string, string> = {
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      groq: 'https://api.groq.com/openai/v1/chat/completions',
      xai: 'https://api.x.ai/v1/chat/completions',
      ollama: `${(modelConfig.ollamaEndpoint || 'http://localhost:11434').replace(/\/$/, '')}/api/generate`,
      custom: `${(modelConfig.customEndpoint || '').replace(/\/$/, '')}/chat/completions`,
    };

    if (provider === 'ollama') {
      const res = await fetch(endpoints.ollama, {
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

    if (provider === 'anthropic') {
      const apiKey = modelConfig.anthropicApiKey;
      if (!apiKey) throw new Error('Anthropic API key required.');
      const res = await fetch(endpoints.anthropic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
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

    const keyMap: Record<string, string> = {
      openai: modelConfig.openaiApiKey,
      groq: modelConfig.groqApiKey,
      xai: modelConfig.xaiApiKey,
      custom: modelConfig.customApiKey,
    };

    const apiKey = keyMap[provider];
    if (!apiKey && provider !== 'custom')
      throw new Error(`${provider} API key required.`);

    const body: any = {
      model:
        PROVIDERS_MAP[provider] ||
        modelConfig.customModel ||
        'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    };

    const res = await fetch(endpoints[provider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${provider} error: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  async fetchRealPosts(queries: string[]): Promise<string> {
    const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const results: string[] = [];
    for (const rawQuery of queries.slice(0, 3)) {
      const query = rawQuery.trim();
      if (!query) continue;
      const encoded = encodeURIComponent(query);
      results.push(
        `[Reddit Search — use as sourceUrl]\nURL: https://www.reddit.com/search/?q=${encoded}&sort=new&t=week\n`
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
            const age = ageH < 24 ? `${ageH}h ago` : `${Math.round(ageH / 24)}d ago`;
            results.push(
              `[HackerNews | ${age} | ${hit.points || 0} points]\nTitle: ${hit.title}\nURL: ${hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`}\nHN: https://news.ycombinator.com/item?id=${hit.objectID}\n`
            );
          }
        }
      } catch {}
    }
    return results.join('\n---\n');
  }

  async generateOpportunities(
    orgId: string,
    product: any,
    targetTopic: string,
    modelConfig: any
  ): Promise<any> {
    if (!modelConfig || modelConfig.provider === 'none') {
      throw new Error('No AI provider configured.');
    }
    if (!product?.name) {
      throw new Error('Product info required.');
    }

    const queries = targetTopic
      ? targetTopic.split(',').map((q: string) => q.trim()).filter(Boolean)
      : [product.painPoints];

    const realPosts = await this.fetchRealPosts(queries);

    const discoveryPrompt = `You are a Discovery Agent. Find HIGH-SIGNAL internet opportunities for this product.

PRODUCT: ${product.name}
Description: ${product.description}
Solves: ${product.painPoints}
Target: ${product.targetAudience}
Competitors: ${product.competitors}
Unique angle: ${product.uniqueAngle}

SEARCH DATA:
${realPosts}

Extract 3-5 real opportunities. Output JSON:
{
  "extractedPosts": [
    {
      "platform": "Reddit|X|LinkedIn|Discord|HackerNews|IndieHackers|YouTube",
      "postTitle": "...",
      "postSnippet": "...",
      "sourceUrl": "...",
      "intentTier": "TIER 1|TIER 2",
      "authorSignals": "...",
      "postedAt": "..."
    }
  ]
}`;

    let discoveryResult: any;
    try {
      const raw = await this.makeAiRequest(discoveryPrompt, modelConfig);
      discoveryResult = JSON.parse(stripJsonFences(raw));
    } catch (e: any) {
      throw new Error(`Discovery failed: ${e.message}`);
    }

    const posts = discoveryResult?.extractedPosts || [];
    const opportunities = await Promise.all(
      posts.map(async (post: any) => {
        try {
          const writerPrompt = `You are an expert growth writer. Write a platform-native response for this opportunity.

PRODUCT: ${product.name} — ${product.description}
PLATFORM: ${post.platform}
POST: ${post.postTitle}
SNIPPET: ${post.postSnippet}
INTENT: ${post.intentTier}
AUTHOR SIGNALS: ${post.authorSignals}

Write a response that:
- Sounds human, not promotional
- Addresses the specific pain
- Naturally mentions ${product.name} only if highly relevant
- Fits ${post.platform} culture

Output JSON:
{
  "suggestedResponse": "...",
  "confidenceScore": 0.0-1.0,
  "riskScore": 1-10,
  "emotionalTrigger": "...",
  "targetUserIntent": "...",
  "expectedOutcome": "..."
}`;

          const raw = await this.makeAiRequest(writerPrompt, modelConfig);
          const result = JSON.parse(stripJsonFences(raw));
          return {
            platform: post.platform,
            postTitle: post.postTitle,
            postSnippet: post.postSnippet,
            sourceUrl: post.sourceUrl,
            postedAt: post.postedAt || 'Recently',
            isRealPost: true,
            context: `${post.intentTier} — ${post.authorSignals || ''}`,
            suggestedResponse: result.suggestedResponse,
            confidenceScore: result.confidenceScore || 0.7,
            riskScore: result.riskScore || 3,
            emotionalTrigger: result.emotionalTrigger,
            targetUserIntent: result.targetUserIntent,
            expectedOutcome: result.expectedOutcome,
            suggestedAction: post.intentTier === 'TIER 1' ? 'reply_now' : 'monitor',
            status: 'pending',
          };
        } catch {
          return null;
        }
      })
    );

    return opportunities.filter(Boolean);
  }

  async extractProductContext(url: string, modelConfig: any): Promise<any> {
    if (!url) throw new Error('URL required');
    if (!url.startsWith('http')) url = 'https://' + url;

    try {
      const parsed = new URL(url);
      const h = parsed.hostname;
      if (
        h === 'localhost' ||
        h === '127.0.0.1' ||
        h.startsWith('192.168.') ||
        h.startsWith('10.')
      ) {
        throw new Error('Private URLs not allowed.');
      }
    } catch {
      throw new Error('Invalid URL.');
    }

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const html = await res.text();
      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 15000);

      const prompt = `Analyze this website and extract product context as JSON:
{"name":"...","description":"...","targetAudience":"...","painPoints":"...","tone":"...","competitors":"...","uniqueAngle":"..."}

Website: ${text}`;

      const raw = await this.makeAiRequest(prompt, modelConfig);
      return JSON.parse(stripJsonFences(raw));
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}
