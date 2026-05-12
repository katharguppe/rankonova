import { BriefGenerator } from '../helpers/brief-generator';
import { BriefGenerationInput } from '../dto/weekly-brief.types';

describe('BriefGenerator Fallback', () => {
  let generator: BriefGenerator;

  beforeEach(() => {
    // Remove API key to test fallback
    delete process.env['ANTHROPIC_API_KEY'];
    generator = new BriefGenerator();
  });

  it('should generate brief without API key', async () => {
    const input: BriefGenerationInput = {
      client_id: 'test-client',
      client_name: 'Test Client',
      week_of: new Date('2026-05-12'),
      citation_score: 45.5,
      citation_delta: 2.3,
      actions: [
        {
          action_type: 'content_approval',
          draft_id: 'draft-1',
          title: 'Approve content draft',
          weight: 3,
          impact_score: 3.9,
          draft_preview: 'Sample content',
          draft_content_summary: 'This is a sample content for approval',
          effort_minutes: 20,
        },
        {
          action_type: 'reddit_reply',
          draft_id: 'thread-1',
          title: 'Reply to Reddit thread',
          weight: 2,
          impact_score: 2.3,
          draft_preview: 'Sample reply',
          draft_content_summary: 'This is a sample reply to a Reddit thread',
          effort_minutes: 15,
        },
      ],
    };

    const brief = await generator.generateBrief(input);

    // Verify the fallback brief was generated
    expect(brief).toBeDefined();
    expect(brief.headline).toContain('Your AEO Weekly Brief');
    expect(brief.intro).toContain('45.5');
    expect(brief.intro).toContain('2.3'); // Has arrow indicator
    expect(brief.sections).toHaveLength(2);
    expect(brief.sections[0].title).toBe('Approve content draft');
    expect(brief.sections[0].what_to_do).toContain('content approval');
    expect(brief.cta).toBe('Log in to your dashboard to action these recommendations');
    expect(brief.footer).toBe('Powered by AEO Suite');
  });

  it('should generate HTML from fallback brief', async () => {
    const input: BriefGenerationInput = {
      client_id: 'test-client',
      client_name: 'Test Client',
      week_of: new Date('2026-05-12'),
      citation_score: 50,
      citation_delta: 0,
      actions: [
        {
          action_type: 'pr_approval',
          draft_id: 'pr-1',
          title: 'Approve press release',
          weight: 2,
          impact_score: 2.3,
          draft_preview: 'Sample PR',
          draft_content_summary: 'This is a sample press release',
          effort_minutes: 15,
        },
      ],
    };

    const brief = await generator.generateBrief(input);
    const html = await generator.briefToHtml(brief, 'test-client');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('AEO Suite Weekly Brief');
    expect(html).toContain('Approve press release');
    expect(html).toContain('Review and pr approval');
  });

  it('should generate markdown from fallback brief', async () => {
    const input: BriefGenerationInput = {
      client_id: 'test-client',
      client_name: 'Test Client',
      week_of: new Date('2026-05-12'),
      citation_score: 35.2,
      citation_delta: -5.1,
      actions: [
        {
          action_type: 'review_request',
          draft_id: 'review-1',
          title: 'Respond to negative review',
          weight: 1,
          impact_score: 1.15,
          draft_preview: 'Sample review',
          draft_content_summary: 'This is a response to a negative review',
          effort_minutes: 10,
        },
      ],
    };

    const brief = await generator.generateBrief(input);
    const markdown = BriefGenerator.briefToMarkdown(brief);

    expect(markdown).toContain('# Your AEO Weekly Brief');
    expect(markdown).toContain('## Your Actions');
    expect(markdown).toContain('### Respond to negative review');
    expect(markdown).toContain('Review and review request');
  });
});
