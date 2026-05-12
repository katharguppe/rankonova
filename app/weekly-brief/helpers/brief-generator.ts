import { Injectable, Logger } from '@nestjs/common';
import { Anthropic } from '@anthropic-ai/sdk';
import { BriefGenerationInput, GeneratedBrief } from '../dto/weekly-brief.types';

@Injectable()
export class BriefGenerator {
  private readonly logger = new Logger(BriefGenerator.name);
  private readonly anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
  }

  async generateBrief(input: BriefGenerationInput): Promise<GeneratedBrief> {
    const prompt = this.buildPrompt(input);

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Haiku');
      }

      return this.parseHaikuResponse(content.text, input);
    } catch (err) {
      this.logger.error(`BriefGenerator failed for client ${input.client_id}: ${(err as Error).message}`);
      throw err;
    }
  }

  async briefToHtml(brief: GeneratedBrief, _clientId: string): Promise<string> {
    const sectionsHtml = brief.sections
      .map(
        (s) => `
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #0066cc;">
        <h3 style="margin-top: 0; color: #0066cc;">${escapeHtml(s.title)}</h3>
        <p><strong>What to do:</strong> ${escapeHtml(s.what_to_do)}</p>
        <p><strong>Expected outcome:</strong> ${escapeHtml(s.expected_outcome)}</p>
        <p><em>${escapeHtml(s.effort)}</em></p>
      </div>
    `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>AEO Weekly Brief</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 20px; }
            .footer { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; }
            a { color: #0066cc; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AEO Suite Weekly Brief</h1>
            </div>
            <div class="content">
              <p><strong>${escapeHtml(brief.headline)}</strong></p>
              <p>${escapeHtml(brief.intro)}</p>
              ${sectionsHtml}
              <p>${escapeHtml(brief.cta)}</p>
            </div>
            <div class="footer">
              ${escapeHtml(brief.footer)}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  static briefToMarkdown(brief: GeneratedBrief): string {
    const sectionsMarkdown = brief.sections
      .map(
        (s) => `
### ${s.title}

**What to do:** ${s.what_to_do}

**Expected outcome:** ${s.expected_outcome}

${s.effort}
`,
      )
      .join('\n---\n\n');

    return `# ${brief.headline}

${brief.intro}

## Your Actions

${sectionsMarkdown}

---

## Next Steps

${brief.cta}

---

${brief.footer}
`;
  }

  private buildPrompt(input: BriefGenerationInput): string {
    const actionsSummary = input.actions
      .map(
        (a, i) =>
          `${i + 1}. [${a.action_type}] ${a.title} (~${a.effort_minutes} min, impact: ${a.weight}x)\n   Summary: ${a.draft_content_summary}`,
      )
      .join('\n');

    return `You are an expert at creating concise, scannable action digests.

Generate a weekly brief for ${input.client_name} for the week of ${input.week_of.toLocaleDateString()}.

This week's citation score: ${input.citation_score.toFixed(1)} (change: ${input.citation_delta > 0 ? '+' : ''}${input.citation_delta.toFixed(1)})

Pending actions to include (top ${input.actions.length}):
${actionsSummary}

Create a brief with:
1. Headline: "Your AEO Weekly Brief — [date range]"
2. Intro sentence: "Your citation score this week: X.X (${input.citation_delta > 0 ? '↑' : '↓'}Y.Y from last week)"
3. For each action:
   - Title
   - "What to do" (1 sentence)
   - "Expected outcome" (1 sentence)
   - Effort estimate (e.g., "~15 min")
4. Call-to-action: "Log in to your dashboard to action these recommendations"
5. Footer: "Unsubscribe link"

Format output as JSON with keys: headline, intro, sections (array of {title, what_to_do, expected_outcome, effort}), cta, footer.`;
  }

  private parseHaikuResponse(text: string, input: BriefGenerationInput): GeneratedBrief {
    try {
      const json = JSON.parse(text);
      return {
        headline: json.headline || `Your AEO Weekly Brief — ${input.week_of.toLocaleDateString()}`,
        intro: json.intro || `Citation score: ${input.citation_score.toFixed(1)}`,
        sections: json.sections || [],
        cta: json.cta || 'Log in to your dashboard to action these recommendations',
        footer: json.footer || 'Powered by AEO Suite',
      };
    } catch (err) {
      this.logger.warn(`Failed to parse Haiku JSON, using fallback structure: ${(err as Error).message}`);
      return {
        headline: `Your AEO Weekly Brief — ${input.week_of.toLocaleDateString()}`,
        intro: `Your citation score this week: ${input.citation_score.toFixed(1)} (${input.citation_delta > 0 ? '↑' : '↓'}${Math.abs(input.citation_delta).toFixed(1)} from last week)`,
        sections: input.actions.map((a) => ({
          title: a.title,
          what_to_do: `Review and ${a.action_type.replace('_', ' ')}`,
          expected_outcome: `Boost citation score by ${a.weight}x impact factor`,
          effort: `~${a.effort_minutes} min`,
        })),
        cta: 'Log in to your dashboard to action these recommendations',
        footer: 'Unsubscribe link',
      };
    }
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
