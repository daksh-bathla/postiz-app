import { makeAiRequest, fetchRealPosts, stripJsonFences, ModelConfig } from './byok-ai';

export interface ProductContext {
  name: string;
  description: string;
  targetAudience: string;
  painPoints: string;
  tone: string;
  competitors: string;
  uniqueAngle: string;
}

export interface Opportunity {
  id: string;
  platform: string;
  context: string;
  targetUserIntent: string;
  emotionalTrigger?: string;
  suggestedResponse: string;
  suggestedAction?: string;
  confidenceScore: number;
  expectedOutcome: string;
  riskScore: number;
  status: 'pending' | 'review' | 'ready';
  sourceUrl?: string;
  postTitle?: string;
  postSnippet?: string;
  postedAt?: string;
  isRealPost?: boolean;
}

function buildDiscoveryPrompt(product: ProductContext, searchData: string): string {
  return `You are the Discovery Agent — a senior intelligence analyst extracting HIGH-SIGNAL opportunities from raw internet data.

Find posts where someone is in active pain, actively searching, or about to make a decision. Not old complaints. Live, fresh, unresolved situations.

## PRODUCT INTELLIGENCE
Name: ${product.name}
Description: ${product.description}
Solves: ${product.painPoints}
Target audience: ${product.targetAudience}
Competitors they're fleeing: ${product.competitors}
Unique angle: ${product.uniqueAngle}

## RAW SEARCH DATA
${searchData}

## EXTRACTION RULES
Extract ONLY posts passing ALL filters:
- Recency: last 7 days
- Intent: TIER 1 (active decision maker) or TIER 2 (frustrated, not yet searching)
- Thread opportunity: space for a valuable reply
- Author: experiencing the pain themselves, specific language, decision-making role
- URL: REAL direct URLs only — NEVER fabricate

Extract top 3-5 posts as JSON:
{
  "extractedPosts": [
    {
      "platform": "Reddit|X|LinkedIn|HackerNews|IndieHackers|Discord|YouTube",
      "sourceUrl": "direct URL — NEVER fabricated",
      "postTitle": "exact title",
      "postSnippet": "2-3 sentences quoting their actual pain",
      "postedAt": "3h ago / 2 days ago",
      "intentTier": "TIER 1|TIER 2",
      "threadOpportunity": "HIGH|MEDIUM",
      "authorSignals": "brief note on author type and pain specificity"
    }
  ]
}

Output ONLY raw JSON. No markdown.`;
}

function buildScoringPrompt(product: ProductContext, post: any): string {
  return `You are the Scoring Agent — behavioral psychologist and conversion specialist.

Determine if this post is a genuine, high-value engagement opportunity.

## PRODUCT
Name: ${product.name}
Solves: ${product.painPoints}
Target: ${product.targetAudience}

## POST
Platform: ${post.platform}
Title: ${post.postTitle}
Content: ${post.postSnippet}
Posted: ${post.postedAt || 'unknown'}
Author signals: ${post.authorSignals || 'unknown'}

Score this opportunity:
- confidenceScore: 0-100 weighted average
- isHighValue: true only if confidenceScore >= 55 AND painDepth >= 40 AND riskScore <= 6
- targetUserIntent: what they want RIGHT NOW
- emotionalTrigger: frustration/urgency/FOMO/overwhelm/embarrassment/aspiration
- audienceType: specific persona

Output JSON:
{
  "targetUserIntent": "string",
  "emotionalTrigger": "string",
  "audienceType": "string",
  "confidenceScore": 0,
  "riskScore": 1,
  "painDepthScore": 0,
  "decisionProximityScore": 0,
  "isHighValue": false
}`;
}

function buildWriterPrompt(product: ProductContext, post: any): string {
  return `You are the Writer Agent. Your output is what the user will post publicly. It MUST be indistinguishable from something a real, intelligent, internet-native human wrote.

One job: write a response that gets a genuine reply. NOT a sale. A real human reply.

## PRODUCT
Name: ${product.name}
What it does: ${product.description}
Who it's for: ${product.targetAudience}
Core pain: ${product.painPoints}
Voice/tone: ${product.tone}
Why it beats competitors: ${product.uniqueAngle}
Competitors: ${product.competitors}

## TARGET POST
Platform: ${post.platform}
Title: ${post.postTitle}
Content: ${post.postSnippet}
Author type: ${post.audienceType || 'unknown'}
Emotional trigger: ${post.emotionalTrigger || 'unknown'}
What they want: ${post.targetUserIntent || 'unknown'}
Intent tier: ${post.intentTier || 'TIER 2'}

## ANTI-AI RULES
NEVER use: supercharge, unlock, leverage, delve, seamless, comprehensive, innovative, game-changer, streamline, robust, scalable, synergy, empower, elevate, transform
NEVER open with a question, "I think", "I believe", "As someone who"
NEVER list as "First... Second... Third..."
NEVER use perfect parallel structure 3x in a row
NEVER mention the product by name unless they explicitly asked for tool recommendations

Make it human: start mid-thought, use contractions, include one specific detail showing you read the post, occasional fragment

## PLATFORM VOICE
Reddit: lowercase ok, fragments ok, match thread depth, no "Great question"
Twitter/X: 2-3 sentences max, punchy, no hedging
LinkedIn: professional but human, first sentence crucial, short paragraphs
HackerNews: extremely technical, zero marketing language, show deep understanding
IndieHackers: founder-to-founder, first-person stories, numbers if you have them

## PRODUCT MENTION RULE
Only mention ${product.name} if they explicitly asked for recommendations. When you do: one mention max, as personal experience "ended up using X for this", add caveat "might not be for everyone".

Output JSON:
{
  "suggestedResponse": "final response text, raw, no quotes",
  "toneUsed": "brief description",
  "angleSelected": "which engagement angle and why"
}`;
}

async function executeAgent<T>(
  prompt: string,
  modelConfig: ModelConfig,
  maxRetries = 2
): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const raw = await makeAiRequest(prompt, modelConfig);
      const cleaned = stripJsonFences(raw);
      return JSON.parse(cleaned) as T;
    } catch (e: any) {
      if (i === maxRetries) throw new Error(`Agent failed after ${maxRetries} retries: ${e.message}`);
    }
  }
  throw new Error('Unreachable');
}

export async function runGrowthScan(
  product: ProductContext,
  targetTopic: string,
  modelConfig: ModelConfig,
  onLog: (msg: string) => void
): Promise<Opportunity[]> {
  const queries = targetTopic
    ? targetTopic.split(',').map((q) => q.trim()).filter(Boolean)
    : [product.painPoints, product.name];

  onLog('Fetching real posts from HackerNews + building Reddit search URLs...');
  const realPosts = await fetchRealPosts(queries);

  onLog('Running Discovery Agent...');
  const discovery = await executeAgent<{ extractedPosts: any[] }>(
    buildDiscoveryPrompt(product, realPosts),
    modelConfig
  );

  const posts = discovery.extractedPosts || [];
  onLog(`Discovered ${posts.length} posts. Scoring and writing responses...`);

  const results: Opportunity[] = [];

  await Promise.all(
    posts.map(async (post, idx) => {
      try {
        const scoring = await executeAgent<any>(
          buildScoringPrompt(product, post),
          modelConfig
        );

        if (!scoring.isHighValue) {
          onLog(`Post ${idx + 1}: scored low, skipping.`);
          return;
        }

        const enriched = { ...post, ...scoring };
        const writer = await executeAgent<any>(
          buildWriterPrompt(product, enriched),
          modelConfig
        );

        results.push({
          id: `op-${Date.now()}-${idx}`,
          platform: post.platform,
          postTitle: post.postTitle,
          postSnippet: post.postSnippet,
          sourceUrl: post.sourceUrl,
          postedAt: post.postedAt || 'Recently',
          isRealPost: true,
          context: `${post.intentTier} — ${post.authorSignals || ''}`,
          targetUserIntent: scoring.targetUserIntent,
          emotionalTrigger: scoring.emotionalTrigger,
          suggestedResponse: writer.suggestedResponse,
          confidenceScore: scoring.confidenceScore,
          riskScore: scoring.riskScore,
          expectedOutcome: `Pain depth: ${scoring.painDepthScore ?? 'n/a'} | Decision proximity: ${scoring.decisionProximityScore ?? 'n/a'}`,
          suggestedAction: post.intentTier === 'TIER 1' ? 'reply_now' : 'monitor',
          status: 'pending',
        });
        onLog(`Post ${idx + 1}: response written for ${post.platform}`);
      } catch (e: any) {
        onLog(`Post ${idx + 1}: failed — ${e.message}`);
      }
    })
  );

  return results;
}

export async function autoFillProduct(
  url: string,
  modelConfig: ModelConfig
): Promise<Partial<ProductContext>> {
  const proxyRes = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const proxyData = await proxyRes.json();
  if (!proxyRes.ok) throw new Error(proxyData.error || `Scrape failed: ${proxyRes.status}`);
  const text = proxyData.text as string;

  const prompt = `Analyze this website and extract product context as JSON (no markdown):
{"name":"","description":"","targetAudience":"","painPoints":"","tone":"","competitors":"","uniqueAngle":""}

Website content: ${text}`;

  const raw = await makeAiRequest(prompt, modelConfig);
  return JSON.parse(stripJsonFences(raw));
}
