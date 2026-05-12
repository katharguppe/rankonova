import { Test, TestingModule } from '@nestjs/testing';
import { ActionRanker } from '../helpers/action-ranker';
import { PrismaService } from '../../prisma/prisma.service';

describe('ActionRanker', () => {
  let ranker: ActionRanker;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionRanker,
        {
          provide: PrismaService,
          useValue: {
            contentOutput: {
              findMany: jest.fn(),
            },
            prSignal: {
              findMany: jest.fn(),
            },
            communityThread: {
              findMany: jest.fn(),
            },
            reviewSnapshot: {
              findMany: jest.fn(),
            },
            aggregatorSnapshot: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    ranker = module.get<ActionRanker>(ActionRanker);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should collect all pending actions and rank by impact', async () => {
    const clientId = 'test-client-123';

    (prisma.contentOutput.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'content-1',
        title: 'Approve comparison page',
        html_content: '<p>Compare BMW vs Mercedes</p>',
        created_at: new Date('2026-05-10'),
      },
    ]);

    (prisma.prSignal.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'pr-1',
        news_title: 'New automotive tech',
        press_release_draft: 'We are excited to announce...',
        created_at: new Date('2026-05-09'),
      },
    ]);

    (prisma.communityThread.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reviewSnapshot.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.aggregatorSnapshot.findMany as jest.Mock).mockResolvedValue([]);

    const ranked = await ranker.rankActions(clientId);

    expect(ranked).toHaveLength(2);
    expect(ranked[0].action_type).toBe('content_approval');
    expect(ranked[0].weight).toBe(3);
    expect(ranked[1].action_type).toBe('pr_approval');
    expect(ranked[1].weight).toBe(2);
  });

  it('should select top 3 actions maximum', async () => {
    const clientId = 'test-client-123';

    (prisma.contentOutput.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'content-1',
        title: 'Content 1',
        html_content: '<p>draft 1</p>',
        created_at: new Date('2026-05-10'),
      },
      {
        id: 'content-2',
        title: 'Content 2',
        html_content: '<p>draft 2</p>',
        created_at: new Date('2026-05-11'),
      },
    ]);

    (prisma.prSignal.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'pr-1',
        news_title: 'PR 1',
        press_release_draft: 'Draft 1',
        created_at: new Date('2026-05-09'),
      },
      {
        id: 'pr-2',
        news_title: 'PR 2',
        press_release_draft: 'Draft 2',
        created_at: new Date('2026-05-08'),
      },
    ]);

    (prisma.communityThread.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reviewSnapshot.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.aggregatorSnapshot.findMany as jest.Mock).mockResolvedValue([]);

    const ranked = await ranker.rankActions(clientId);

    expect(ranked).toHaveLength(3); // exactly 3, not 4
  });

  it('should return fewer than 3 if fewer actions exist', async () => {
    const clientId = 'test-client-123';

    (prisma.contentOutput.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'content-1',
        title: 'Content 1',
        html_content: '<p>draft</p>',
        created_at: new Date('2026-05-10'),
      },
    ]);

    (prisma.prSignal.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.communityThread.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reviewSnapshot.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.aggregatorSnapshot.findMany as jest.Mock).mockResolvedValue([]);

    const ranked = await ranker.rankActions(clientId);

    expect(ranked).toHaveLength(1);
  });

  it('should return empty array if no actions exist', async () => {
    const clientId = 'test-client-123';

    (prisma.contentOutput.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.prSignal.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.communityThread.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reviewSnapshot.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.aggregatorSnapshot.findMany as jest.Mock).mockResolvedValue([]);

    const ranked = await ranker.rankActions(clientId);

    expect(ranked).toHaveLength(0);
  });
});
