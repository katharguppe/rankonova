import { Test, TestingModule } from '@nestjs/testing';
import { CitationCalculator } from '../helpers/citation-calculator';
import { PrismaService } from '../../prisma/prisma.service';

describe('CitationCalculator', () => {
  let calculator: CitationCalculator;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CitationCalculator,
        {
          provide: PrismaService,
          useValue: {
            brandMention: {
              count: jest.fn(),
            },
            promptRun: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    calculator = module.get<CitationCalculator>(CitationCalculator);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should calculate citation score for current week', async () => {
    const clientId = 'test-client-123';
    const monday = new Date('2026-05-12T00:00:00Z');

    (prisma.brandMention.count as jest.Mock).mockResolvedValue(5);
    (prisma.promptRun.count as jest.Mock).mockResolvedValue(10);

    const score = await calculator.calculateCitationScore(clientId, monday);

    expect(score).toBe(50); // (5 / 10) * 100
  });

  it('should handle zero prompts (avoid division by zero)', async () => {
    const clientId = 'test-client-123';
    const monday = new Date('2026-05-12T00:00:00Z');

    (prisma.brandMention.count as jest.Mock).mockResolvedValue(5);
    (prisma.promptRun.count as jest.Mock).mockResolvedValue(0);

    const score = await calculator.calculateCitationScore(clientId, monday);

    expect(score).toBe(0);
  });

  it('should calculate citation delta between two weeks', async () => {
    const clientId = 'test-client-123';
    const thisMonday = new Date('2026-05-12T00:00:00Z');
    const prevMonday = new Date('2026-05-05T00:00:00Z');

    (prisma.brandMention.count as jest.Mock)
      .mockResolvedValueOnce(5) // this week
      .mockResolvedValueOnce(3); // prev week

    (prisma.promptRun.count as jest.Mock)
      .mockResolvedValueOnce(10) // this week
      .mockResolvedValueOnce(10); // prev week

    const delta = await calculator.calculateCitationDelta(clientId, thisMonday);

    expect(delta).toBe(20); // 50 - 30
  });
});
