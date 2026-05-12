import { Test, TestingModule } from '@nestjs/testing';
import { BriefGenerator } from '../helpers/brief-generator';
import { BriefGenerationInput, GeneratedBrief } from '../dto/weekly-brief.types';

// Mock the Anthropic module
jest.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

describe('BriefGenerator', () => {
  let generator: BriefGenerator;
  let mockAnthropicCreate: jest.Mock;

  beforeEach(async () => {
    // Mock ANTHROPIC_API_KEY for testing
    process.env['ANTHROPIC_API_KEY'] = 'test-key-xyz';

    const module: TestingModule = await Test.createTestingModule({
      providers: [BriefGenerator],
    }).compile();

    generator = module.get<BriefGenerator>(BriefGenerator);

    // Setup the mock for Anthropic API calls
    const anthropic = (generator as any).anthropic;
    mockAnthropicCreate = anthropic.messages.create;
  });

  it('should generate brief with headline, intro, sections, cta, footer', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            headline: 'Your AEO Weekly Brief — May 12-18, 2026',
            intro: 'Your citation score this week: 42.5 (↓2.1 from last week)',
            sections: [
              {
                title: 'Approve comparison page',
                what_to_do: 'Review and approve the draft for publication',
                expected_outcome: 'Boost citations by 3x impact',
                effort: '~20 min',
              },
            ],
            cta: 'Log in to your dashboard to action these recommendations',
            footer: 'Unsubscribe link',
          }),
        },
      ],
    };

    mockAnthropicCreate.mockResolvedValue(mockResponse);

    const input: BriefGenerationInput = {
      client_id: 'test-client',
      client_name: 'Test Motors',
      week_of: new Date('2026-05-12'),
      citation_score: 42.5,
      citation_delta: -2.1,
      actions: [
        {
          action_type: 'content_approval',
          draft_id: 'content-1',
          title: 'Approve comparison page',
          draft_preview: 'Compare BMW X5 vs Mercedes GLE',
          effort_minutes: 20,
          weight: 3,
          impact_score: 3.3,
          draft_content_summary: 'Comprehensive comparison of two popular luxury SUVs',
        },
      ],
    };

    const brief = await generator.generateBrief(input);

    expect(brief.headline).toContain('AEO Weekly Brief');
    expect(brief.headline).toContain('May 12-18, 2026');
    expect(brief.intro).toContain('42.5');
    expect(brief.intro).toContain('2.1');
    expect(brief.sections).toHaveLength(1);
    expect(brief.sections[0].title).toContain('Approve comparison page');
    expect(brief.cta).toContain('Log in to your dashboard');
    expect(brief.footer).toContain('Unsubscribe');
  });

  it('should convert brief to HTML with proper formatting', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            headline: 'Your AEO Weekly Brief — May 12-18, 2026',
            intro: 'Your citation score this week: 42.5 (↓2.1 from last week)',
            sections: [],
            cta: 'Log in to your dashboard to action these recommendations',
            footer: 'Unsubscribe link',
          }),
        },
      ],
    };

    mockAnthropicCreate.mockResolvedValue(mockResponse);

    const input: BriefGenerationInput = {
      client_id: 'test-client',
      client_name: 'Test Motors',
      week_of: new Date('2026-05-12'),
      citation_score: 42.5,
      citation_delta: -2.1,
      actions: [],
    };

    const brief = await generator.generateBrief(input);
    const html = await generator.briefToHtml(brief, 'test-client');

    expect(html).toContain('<html');
    expect(html).toContain('AEO Suite');
    expect(html).toContain('Your AEO Weekly Brief');
  });

  it('should convert brief to markdown', async () => {
    const brief: GeneratedBrief = {
      headline: 'Your AEO Weekly Brief — May 12-18, 2026',
      intro: 'Your citation score this week: 42.5 (↓2.1 from last week)',
      sections: [
        {
          title: 'Approve comparison page',
          what_to_do: 'Review and approve the draft',
          expected_outcome: 'Boost citations by 3x',
          effort: '~20 min',
        },
      ],
      cta: 'Log in to your dashboard to action these recommendations',
      footer: 'Unsubscribe link',
    };

    const markdown = BriefGenerator.briefToMarkdown(brief);

    expect(markdown).toContain('# Your AEO Weekly Brief');
    expect(markdown).toContain('Approve comparison page');
    expect(markdown).toContain('~20 min');
  });
});
