import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { OnSiteGaps, OffSiteGaps, RecommendedAction, SiteProfile } from './diagnostics.types';

export interface SummaryInput {
  clientName: string;
  clientWebsite: string;
  competitorDomain: string;
  onSiteGaps: OnSiteGaps;
  offSiteGaps: OffSiteGaps;
  recommendedActions: RecommendedAction[];
  clientProfile: SiteProfile;
  competitorProfile: SiteProfile;
}

const SYSTEM_PROMPT = `You are an AEO (Answer Engine Optimization) analyst. \
Your job is to explain why a competitor gets cited by AI engines (ChatGPT, Perplexity, Gemini, etc.) \
and what a client must do to close that gap.

Write in plain English. Be direct and specific. No fluff, no jargon, no bullet-point overload.
Target length: 400-600 words.
Structure: opening (diagnosis), body (3 key gaps explained with why they matter to AI citation), \
closing (prioritised next step).
Never use the phrase "In conclusion". Never start a sentence with "Furthermore" or "Moreover".`;

@Injectable()
export class DiagnosticsSummaryService {
  private readonly logger = new Logger(DiagnosticsSummaryService.name);
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env['CEREBRAS_API_KEY'],
      baseURL: 'https://api.cerebras.ai/v1',
    });
  }

  async generateSummary(input: SummaryInput): Promise<string> {
    const userMessage = this.buildUserMessage(input);

    let text = '';
    try {
      const response = await this.client.chat.completions.create({
        model: 'llama3.1-8b',
        max_tokens: 1200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      });
      text = response.choices[0]?.message.content?.trim() ?? '';
    } catch (err) {
      this.logger.warn(
        `Summary API call failed for ${input.clientName}: ${(err as Error).message} — using fallback`,
      );
      return this.fallbackSummary(input);
    }

    if (text.length === 0) {
      this.logger.warn(`Summary returned empty for client ${input.clientName}`);
      return this.fallbackSummary(input);
    }

    this.logger.log(
      `Summary generated for ${input.clientName} vs ${input.competitorDomain} — ${text.split(/\s+/).length} words`,
    );
    return text;
  }

  // ── private ─────────────────────────────────────────────────────────────────

  private buildUserMessage(input: SummaryInput): string {
    const { clientName, clientWebsite, competitorDomain, onSiteGaps, clientProfile, competitorProfile, recommendedActions } = input;

    const topActions = recommendedActions.slice(0, 3);

    const schemaSection =
      onSiteGaps.missingSchemaTypes.length > 0
        ? `Missing schema types (competitor has, client lacks): ${onSiteGaps.missingSchemaTypes.join(', ')}`
        : `No missing schema types detected`;

    const freshSection =
      onSiteGaps.freshnessGap > 0
        ? `Client content is ${onSiteGaps.freshnessGap} days older (median) than competitor content`
        : onSiteGaps.freshnessGap < 0
          ? `Client content is ${Math.abs(onSiteGaps.freshnessGap)} days fresher than competitor`
          : `No significant freshness gap detected`;

    const entitySection =
      onSiteGaps.entityDensityGap > 0
        ? `Competitor has ${onSiteGaps.entityDensityGap} more named entities per 100 words`
        : `Client has comparable or higher entity density`;

    const wordSection = `Client avg word count: ${clientProfile.avgWordCount} | Competitor avg: ${competitorProfile.avgWordCount}`;

    const faqSection = clientProfile.faqPageCount > 0
      ? `Client has FAQ schema on ${clientProfile.faqPageCount} page(s) (${onSiteGaps.faqCoverageScore}% coverage)`
      : competitorProfile.faqPageCount > 0
        ? `Client has NO FAQ schema. Competitor has it on ${competitorProfile.faqPageCount} page(s)`
        : `Neither client nor competitor uses FAQ schema`;

    const actionsText = topActions
      .map((a, i) => `  ${i + 1}. [${a.estimatedImpact.toUpperCase()}] ${a.action}`)
      .join('\n');

    return `Write an AEO gap analysis report for the following client vs competitor comparison.

CLIENT: ${clientName}
CLIENT WEBSITE: ${clientWebsite}
COMPETITOR DOMAIN: ${competitorDomain}

--- FINDINGS ---

Schema & Structured Data:
${schemaSection}
${faqSection}

Content Quality:
${wordSection}
${entitySection}
Heading structure gap: competitor averages ${onSiteGaps.internalLinkGap > 0 ? onSiteGaps.internalLinkGap : 0} more headings per page

Content Freshness:
${freshSection}

Top Recommended Actions:
${actionsText}

--- END FINDINGS ---

Write the 400-600 word plain English summary now. Explain WHY each gap matters for AI citation, not just what it is.`;
  }

  // Deterministic fallback if API call fails — never throws, always returns something useful.
  private fallbackSummary(input: SummaryInput): string {
    const top = input.recommendedActions[0];
    const gaps = input.onSiteGaps;
    const parts: string[] = [
      `Gap analysis for ${input.clientName} vs ${input.competitorDomain}.`,
    ];

    if (gaps.missingSchemaTypes.length > 0) {
      parts.push(
        `Structured data: ${input.clientName} is missing ${gaps.missingSchemaTypes.length} schema type(s) present on the competitor site (${gaps.missingSchemaTypes.slice(0, 3).join(', ')}). AI engines rely on structured data to extract citable facts.`,
      );
    }
    if (gaps.freshnessGap > 180) {
      parts.push(
        `Content freshness: pages are a median ${Math.round(gaps.freshnessGap / 30)} months older than competitor content. AI engines favour recently updated sources.`,
      );
    }
    if (top) {
      parts.push(`Priority action: ${top.action}`);
    }

    return parts.join('\n\n');
  }
}
