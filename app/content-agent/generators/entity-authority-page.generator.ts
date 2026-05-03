import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { GeneratedContent } from '../content-agent.types';

export interface EntityAuthorityInput {
  clientName: string;
  brandName: string;
  city: string;
  state: string;
  websiteUrl: string;
  verticalName: string;
  schemaOrgType: string;
  gapSummary?: string;
}

// Mapping from vertical slug to schema.org @type
export const VERTICAL_SCHEMA_TYPES: Record<string, string> = {
  automotive: 'AutoDealer',
  'real-estate': 'RealEstateAgent',
  'hr-services': 'EmploymentAgency',
  'gcc-advisory': 'ProfessionalService',
  healthcare: 'MedicalBusiness',
};

const SYSTEM_PROMPT = `You are an AEO content writer specialising in Answer Engine Optimization (AEO).
You produce Entity Authority Pages that establish a brand in AI knowledge graphs and earn citations when users search for the entity by name.

RULES — enforced without exception:
1. Open with a 2-3 sentence entity definition: who the client is, what they do, city/state, and years of operation.
2. Include a "Key Facts" block as a definition list (<dl>, <dt>, <dd>) with at least 8 facts: founded year, headquarters, service area (cities), specialisations, notable certifications or awards, approximate client base size, price range or engagement model, key personnel or brand spokesperson.
3. Add an HTML comment above each <dd> with the equivalent Wikidata property reference (e.g., <!-- P571: inception --> for founded year, <!-- P159: headquarters location --> for headquarters). This makes the facts Wikidata-compatible.
4. Use the specified schema.org type as the @type of the PRIMARY JSON-LD block. Fill in all standard properties: name, url, address, telephone, description, areaServed, foundingDate, numberOfEmployees (if known), and sameAs (website URL).
5. Add a secondary FAQPage JSON-LD schema with 3-5 Q&A about the entity (what it does, how to contact, service area, pricing model, credentials).
6. Entity density: include at least one named entity (person, place, certification, organisation) per 50 words of body text.
7. No promotional language. State facts only. If a fact is an estimate, write "approximately" before the number.
8. Total page length: 800-1200 words.
9. Page title: "[Brand Name] — [Vertical] in [City] | About" — under 70 characters.

OUTPUT FORMAT: complete HTML5 only. No markdown. No code fences.`;

@Injectable()
export class EntityAuthorityPageGeneratorService {
  private readonly logger = new Logger(EntityAuthorityPageGeneratorService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env['OPENROUTER_API_KEY'],
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async generate(input: EntityAuthorityInput): Promise<GeneratedContent> {
    const userMessage = this.buildUserMessage(input);

    let html: string;
    try {
      const response = await this.openai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      });
      html = response.choices[0]?.message.content?.trim() ?? '';
    } catch (err) {
      throw new Error(`Entity authority page generation failed: ${(err as Error).message}`);
    }

    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      throw new Error(`Entity authority generator returned non-HTML content (${html.length} chars)`);
    }

    const title = this.extractTitle(html);
    const schemaJson = this.extractFirstSchema(html);

    this.logger.log(
      `Entity authority page generated for ${input.brandName} (${input.schemaOrgType}) — ${html.length} chars`,
    );

    return { title, htmlContent: html, schemaJson, generationPrompt: userMessage };
  }

  private buildUserMessage(input: EntityAuthorityInput): string {
    const lines = [
      `Generate an Entity Authority Page for this business.`,
      ``,
      `CLIENT NAME: ${input.clientName}`,
      `BRAND: ${input.brandName}`,
      `LOCATION: ${input.city}, ${input.state}, India`,
      `WEBSITE: ${input.websiteUrl}`,
      `VERTICAL: ${input.verticalName}`,
      `PRIMARY SCHEMA TYPE: ${input.schemaOrgType} (use this as the @type in the primary JSON-LD block)`,
    ];

    if (input.gapSummary) {
      lines.push(
        ``,
        `CONTEXT — use to identify which entity facts to emphasise:`,
        input.gapSummary,
      );
    }

    lines.push(
      ``,
      `Return the complete HTML5 Entity Authority Page now. Follow every RULE in the system prompt exactly.`,
    );

    return lines.join('\n');
  }

  private extractTitle(html: string): string {
    const m =
      html.match(/<title[^>]*>([^<]+)<\/title>/i) ??
      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    return m ? m[1].trim().slice(0, 70) : 'About';
  }

  private extractFirstSchema(html: string): object {
    const m = html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!m) return {};
    try {
      return JSON.parse(m[1]) as object;
    } catch {
      return {};
    }
  }
}
