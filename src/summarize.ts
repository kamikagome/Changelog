import Anthropic from '@anthropic-ai/sdk';
import { CommitInfo, DigestSection } from './types';

const AUDIENCE_PROMPTS: Record<string, string> = {
  general: 'Write for a general business audience.',
  sales: 'Write for a sales team. Emphasize customer-facing features and competitive advantages.',
  ops: 'Write for an operations team. Emphasize reliability, performance, and process improvements.',
  cx: 'Write for a customer experience team. Emphasize user-facing changes and support-related fixes.',
};

/**
 * Summarize commits using Claude API
 */
export async function summarizeCommits(
  commits: CommitInfo[],
  audience: string = 'general'
): Promise<DigestSection[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY environment variable.\n' +
        'Please set it in your .env file or export it in your shell:\n' +
        '  export ANTHROPIC_API_KEY=your-api-key-here'
    );
  }

  const client = new Anthropic({ apiKey });

  const audienceGuidance = AUDIENCE_PROMPTS[audience] || AUDIENCE_PROMPTS.general;

  const prompt = `You are a technical writer who translates git commits into plain English for non-technical teams.

Given these git commits, create a summary with these sections:
- features: New Features (things users can now do)
- fixes: Bug Fixes (problems that were solved)
- improvements: Improvements (things that work better)
- other: Other Changes (internal/technical updates)

Rules:
- Write for someone who doesn't code
- Focus on user/business impact, not technical details
- Keep each item to 1-2 sentences
- Skip merge commits and version bumps
- If a commit is unclear, summarize what you can infer
- ${audienceGuidance}

Respond ONLY with valid JSON in this exact format:
{
  "features": ["item 1", "item 2"],
  "fixes": ["item 1"],
  "improvements": ["item 1"],
  "other": ["item 1"]
}

If a category has no items, use an empty array.

Commits:
${JSON.stringify(commits, null, 2)}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    const parsed = parseClaudeResponse(content.text);
    return parsed;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error(
        'Claude API rate limit exceeded. Please wait a moment and try again.'
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error(
        'Invalid ANTHROPIC_API_KEY. Please check your API key and try again.'
      );
    }
    throw error;
  }
}

/**
 * Parse Claude's JSON response into DigestSection array
 */
function parseClaudeResponse(text: string): DigestSection[] {
  // Extract JSON from response (in case there's extra text)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse Claude response as JSON');
  }

  const data = JSON.parse(jsonMatch[0]);

  const sections: DigestSection[] = [
    { category: 'features', items: data.features || [] },
    { category: 'fixes', items: data.fixes || [] },
    { category: 'improvements', items: data.improvements || [] },
    { category: 'other', items: data.other || [] },
  ];

  return sections;
}
