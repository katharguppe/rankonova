import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommunityService } from './community.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('playwright', () => ({
  chromium: { launch: jest.fn() },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

import { chromium } from 'playwright';

const THREAD_ROW = {
  id: 'thread-1',
  client_id: 'client-1',
  platform: 'reddit',
  url: 'https://reddit.com/r/indiancars/comments/xyz',
  thread_title: 'Best Toyota dealer in Bangalore?',
  question_text: null,
  thread_score: 5,
  is_client_mentioned: false,
  is_competitor_recommended: false,
  competitor_names_mentioned: [],
  ai_citation_count: 0,
  response_draft: null,
  response_status: 'pending' as const,
  detected_at: new Date(),
  responded_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const MOCK_CLIENT = {
  id: 'client-1',
  brand_name: 'Nandi Toyota',
  city: 'Bangalore',
  state: 'Karnataka',
  tenant_id: 'tenant-1',
  vertical_id: 'vertical-1',
  aliases: [],
  website_url: 'https://nanditoyota.com',
  vertical: {
    name: 'Automotive',
    community_platforms: [
      {
        platform: 'reddit',
        identifiers: ['r/indiancars'],
        keywords: ['Toyota dealer Bangalore'],
      },
    ],
  },
};

function makeBrowserMock(titles: string[] = [], links: string[] = []) {
  const mockPage = {
    goto: jest.fn().mockResolvedValue(null),
    waitForTimeout: jest.fn().mockResolvedValue(null),
    locator: jest.fn().mockReturnValue({
      allTextContents: jest.fn().mockResolvedValue(titles),
      evaluateAll: jest.fn().mockResolvedValue(links),
    }),
    close: jest.fn().mockResolvedValue(null),
  };
  const mockContext = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(null),
  };
  const mockBrowser = {
    newContext: jest.fn().mockResolvedValue(mockContext),
    close: jest.fn().mockResolvedValue(null),
  };
  return { mockBrowser, mockContext, mockPage };
}

function makeRedditJsonResponse(titles: string[] = []) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        children: titles.map((title, i) => ({
          data: {
            permalink: `/r/indiancars/comments/abc${i}`,
            title,
            selftext: '',
            score: 10,
            subreddit: 'indiancars',
          },
        })),
      },
    }),
  };
}

describe('CommunityService — Reddit Playwright fallback', () => {
  let service: CommunityService;
  let prisma: {
    client: { findFirst: jest.Mock };
    competitor: { findMany: jest.Mock };
    communityThread: { findFirst: jest.Mock; create: jest.Mock };
    notification: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      client: { findFirst: jest.fn().mockResolvedValue(MOCK_CLIENT) },
      competitor: { findMany: jest.fn().mockResolvedValue([]) },
      communityThread: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(THREAD_ROW),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
    jest.clearAllMocks();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('uses Reddit JSON API when fetch succeeds — Playwright not called', async () => {
    mockFetch.mockResolvedValueOnce(makeRedditJsonResponse(['Toyota review']));

    await service.runForClient('client-1');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  // ── 429 triggers Playwright ─────────────────────────────────────────────────

  it('launches Playwright fallback when Reddit returns 429', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const { mockBrowser } = makeBrowserMock(
      ['Best Toyota Dealer Bangalore'],
      ['https://reddit.com/r/indiancars/comments/xyz'],
    );
    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    await service.runForClient('client-1');

    expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('launches Playwright fallback when fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const { mockBrowser } = makeBrowserMock([], []);
    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    await service.runForClient('client-1');

    expect(chromium.launch).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  // ── Browser reuse across keywords ───────────────────────────────────────────

  it('reuses one browser across multiple failed keywords in same subreddit', async () => {
    const multiKeywordClient = {
      ...MOCK_CLIENT,
      vertical: {
        ...MOCK_CLIENT.vertical,
        community_platforms: [
          {
            platform: 'reddit',
            identifiers: ['r/indiancars'],
            keywords: ['Toyota dealer', 'Maruti vs Toyota'],
          },
        ],
      },
    };
    prisma.client.findFirst.mockResolvedValue(multiKeywordClient);

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: false, status: 429 });

    const { mockBrowser } = makeBrowserMock([], []);
    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    await service.runForClient('client-1');

    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  // ── Playwright also fails ───────────────────────────────────────────────────

  it('returns empty results without throwing when both Reddit API and Playwright fail', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
    (chromium.launch as jest.Mock).mockRejectedValue(new Error('Playwright not installed'));

    const result = await service.runForClient('client-1');

    expect(result).toEqual([]);
  });

  it('closes fallback browser even when Playwright page navigation fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const mockPage = {
      goto: jest.fn().mockRejectedValue(new Error('Timeout')),
      waitForTimeout: jest.fn(),
      locator: jest.fn(),
      close: jest.fn().mockResolvedValue(null),
    };
    const mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(null),
    };
    const mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn().mockResolvedValue(null),
    };
    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    await service.runForClient('client-1');

    expect(mockBrowser.close).toHaveBeenCalled();
  });

  // ── Client not found ────────────────────────────────────────────────────────

  it('throws NotFoundException when client does not exist', async () => {
    prisma.client.findFirst.mockResolvedValue(null);

    await expect(service.runForClient('unknown')).rejects.toThrow(NotFoundException);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(chromium.launch).not.toHaveBeenCalled();
  });
});
