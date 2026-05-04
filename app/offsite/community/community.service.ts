import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationSeverity, ResponseStatus } from '@prisma/client';
import { chromium, Browser } from 'playwright';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CommunityPlatformConfig,
  CommunityThreadResponse,
  RawThread,
  ThreadSignals,
} from './dto/community.types';

const REDDIT_BASE = 'https://www.reddit.com';
const REDDIT_DELAY_MS = 500;
const URGENT_CITATION_THRESHOLD = 5;

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);
  private readonly cerebras: OpenAI;

  constructor(private readonly prisma: PrismaService) {
    this.cerebras = new OpenAI({
      apiKey: process.env['CEREBRAS_API_KEY'] ?? '',
      baseURL: 'https://api.cerebras.ai/v1',
    });
  }

  // ── Scheduled job ────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async runScheduled(): Promise<void> {
    const clients = await this.prisma.client.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, brand_name: true },
    });
    this.logger.log(`Community daily scan: ${clients.length} active client(s)`);
    for (const c of clients) {
      await this.runForClient(c.id).catch((err: Error) =>
        this.logger.error(`Community scan failed for ${c.id} (${c.brand_name}): ${err.message}`),
      );
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async runForClient(clientId: string): Promise<CommunityThreadResponse[]> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, is_active: true, deleted_at: null },
      include: {
        vertical: { select: { community_platforms: true, name: true } },
      },
    });
    if (!client) throw new NotFoundException(`Client ${clientId} not found or inactive`);

    const platforms = client.vertical.community_platforms as unknown as CommunityPlatformConfig[];
    if (!platforms?.length) {
      this.logger.warn(`No community platforms configured for client ${clientId}`);
      return [];
    }

    const competitors = await this.prisma.competitor.findMany({
      where: { vertical_id: client.vertical_id, tenant_id: client.tenant_id, is_active: true },
      select: { name: true, aliases: true },
    });

    const clientAliases = [
      client.brand_name,
      ...(client.aliases as string[]),
    ].map((a) => a.toLowerCase());

    const competitorMap = competitors.map((c) => ({
      name: c.name,
      aliases: [c.name, ...(c.aliases as string[])].map((a) => a.toLowerCase()),
    }));

    const allThreads: CommunityThreadResponse[] = [];

    for (const platform of platforms) {
      let threads: CommunityThreadResponse[];
      if (platform.platform === 'reddit') {
        threads = await this.scanReddit(
          client,
          clientAliases,
          competitorMap,
          platform,
        );
      } else {
        threads = await this.scanGeneric(
          client,
          clientAliases,
          competitorMap,
          platform,
        );
      }
      allThreads.push(...threads);
    }

    return allThreads;
  }

  async getThreads(
    clientId: string,
    platform?: string,
    status?: ResponseStatus,
    opportunitiesOnly?: boolean,
  ): Promise<CommunityThreadResponse[]> {
    const threads = await this.prisma.communityThread.findMany({
      where: {
        client_id: clientId,
        ...(platform ? { platform } : {}),
        ...(status ? { response_status: status } : {}),
        ...(opportunitiesOnly
          ? { is_competitor_recommended: true, is_client_mentioned: false }
          : {}),
      },
      orderBy: [{ ai_citation_count: 'desc' }, { detected_at: 'desc' }],
      take: 100,
    });
    return threads.map((t) => this.toResponse(t));
  }

  async regenerateDraft(threadId: string): Promise<CommunityThreadResponse> {
    const thread = await this.prisma.communityThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`CommunityThread ${threadId} not found`);

    const client = await this.prisma.client.findUnique({
      where: { id: thread.client_id },
      include: { vertical: { select: { name: true } } },
    });
    const draft = await this.generateDraft(
      thread.thread_title,
      thread.question_text ?? '',
      client?.brand_name ?? '',
      client?.vertical.name ?? '',
    );
    const updated = await this.prisma.communityThread.update({
      where: { id: threadId },
      data: { response_draft: draft },
    });
    return this.toResponse(updated);
  }

  async markPosted(threadId: string): Promise<CommunityThreadResponse> {
    const thread = await this.prisma.communityThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`CommunityThread ${threadId} not found`);
    const updated = await this.prisma.communityThread.update({
      where: { id: threadId },
      data: { response_status: ResponseStatus.posted, responded_at: new Date() },
    });
    return this.toResponse(updated);
  }

  async markSkipped(threadId: string): Promise<CommunityThreadResponse> {
    const thread = await this.prisma.communityThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`CommunityThread ${threadId} not found`);
    const updated = await this.prisma.communityThread.update({
      where: { id: threadId },
      data: { response_status: ResponseStatus.skipped },
    });
    return this.toResponse(updated);
  }

  // ── Reddit scanner (fetch-based) ─────────────────────────────────────────────

  private async scanReddit(
    client: { id: string; brand_name: string; city: string; tenant_id: string; vertical_id: string },
    clientAliases: string[],
    competitorMap: { name: string; aliases: string[] }[],
    platform: CommunityPlatformConfig,
  ): Promise<CommunityThreadResponse[]> {
    const newThreads: CommunityThreadResponse[] = [];

    for (const identifier of platform.identifiers) {
      const subreddit = identifier.replace(/^r\//, '');

      for (const keyword of platform.keywords) {
        await this.sleep(REDDIT_DELAY_MS);

        const url =
          `${REDDIT_BASE}/r/${subreddit}/search.json` +
          `?q=${encodeURIComponent(keyword)}&restrict_sr=1&sort=new&limit=10`;

        let raw: RawThread[];
        try {
          raw = await this.fetchRedditSearch(url, subreddit);
        } catch (err) {
          this.logger.warn(`Reddit fetch failed [${subreddit}/${keyword}]: ${(err as Error).message}`);
          continue;
        }

        for (const thread of raw) {
          const persisted = await this.persistThread(
            client, clientAliases, competitorMap, 'reddit', thread,
          );
          if (persisted) newThreads.push(persisted);
        }
      }
    }

    return newThreads;
  }

  private async fetchRedditSearch(url: string, subreddit: string): Promise<RawThread[]> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AEO-Suite/1.0 community-monitor (contact: admin@aeo-suite.com)',
        'Accept': 'application/json',
      },
    });

    if (res.status === 429) throw new Error('Reddit rate limit hit — back off');
    if (!res.ok) throw new Error(`Reddit API returned ${res.status}`);

    const json = await res.json() as {
      data?: { children?: Array<{ data: { permalink: string; title: string; selftext: string; score: number; subreddit: string } }> };
    };

    return (json.data?.children ?? []).map((child) => ({
      url: `${REDDIT_BASE}${child.data.permalink}`,
      title: child.data.title,
      body: child.data.selftext ?? '',
      score: child.data.score ?? 0,
      subreddit,
    }));
  }

  // ── Generic Playwright scanner (non-Reddit platforms) ────────────────────────

  private async scanGeneric(
    client: { id: string; brand_name: string; city: string; tenant_id: string; vertical_id: string },
    clientAliases: string[],
    competitorMap: { name: string; aliases: string[] }[],
    platform: CommunityPlatformConfig,
  ): Promise<CommunityThreadResponse[]> {
    const newThreads: CommunityThreadResponse[] = [];
    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });

      for (const identifier of platform.identifiers) {
        for (const keyword of platform.keywords) {
          const searchUrl = `https://www.google.com/search?q=site:${identifier}+${encodeURIComponent(keyword)}`;
          const page = await context.newPage();

          try {
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
            await page.waitForTimeout(1500);

            const results = await page.locator('h3').allTextContents().catch(() => [] as string[]);
            const links = await page.locator('a[href*="' + identifier + '"]')
              .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).href))
              .catch(() => [] as string[]);

            for (let i = 0; i < Math.min(results.length, links.length, 5); i++) {
              const thread: RawThread = {
                url: links[i],
                title: results[i],
                body: '',
                score: 0,
                subreddit: identifier,
              };
              const persisted = await this.persistThread(
                client, clientAliases, competitorMap, platform.platform, thread,
              );
              if (persisted) newThreads.push(persisted);
            }
          } catch (err) {
            this.logger.warn(`Generic scan failed [${identifier}/${keyword}]: ${(err as Error).message}`);
          } finally {
            await page.close();
          }

          await this.sleep(REDDIT_DELAY_MS);
        }
      }
    } catch (err) {
      this.logger.warn(`scanGeneric browser error: ${(err as Error).message}`);
    } finally {
      if (browser) await browser.close();
    }

    return newThreads;
  }

  // ── Thread persistence + signal detection ────────────────────────────────────

  private async persistThread(
    client: { id: string; brand_name: string; tenant_id: string; vertical_id: string },
    clientAliases: string[],
    competitorMap: { name: string; aliases: string[] }[],
    platformName: string,
    thread: RawThread,
  ): Promise<CommunityThreadResponse | null> {
    // Dedup by client_id + url
    const existing = await this.prisma.communityThread.findFirst({
      where: { client_id: client.id, url: thread.url },
    });
    if (existing) return null;

    const combined = `${thread.title} ${thread.body}`.toLowerCase();
    const signals = this.detectSignals(combined, clientAliases, competitorMap);

    const now = new Date();
    let draft: string | null = null;

    if (signals.is_competitor_recommended && !signals.is_client_mentioned) {
      draft = await this.generateDraft(
        thread.title,
        thread.body,
        client.brand_name,
        platformName,
      ).catch((err: Error) => {
        this.logger.warn(`Draft gen failed for ${thread.url}: ${err.message}`);
        return null;
      });

      // Opportunity alert
      await this.prisma.notification.create({
        data: {
          tenant_id: client.tenant_id,
          client_id: client.id,
          type: 'community_opportunity',
          severity: NotificationSeverity.medium,
          title: `Competitor mentioned without you on ${platformName}`,
          body: `"${thread.title.slice(0, 100)}" — ${signals.competitor_names_mentioned.join(', ')} recommended, ${client.brand_name} not mentioned.`,
          deep_link: `/offsite/community/${client.id}/threads?opportunities_only=true`,
        },
      }).catch((err: Error) =>
        this.logger.warn(`Notification failed: ${err.message}`),
      );
    }

    const saved = await this.prisma.communityThread.create({
      data: {
        client_id: client.id,
        platform: platformName,
        url: thread.url,
        thread_title: thread.title.slice(0, 500),
        question_text: thread.body || null,
        thread_score: thread.score,
        is_client_mentioned: signals.is_client_mentioned,
        is_competitor_recommended: signals.is_competitor_recommended,
        competitor_names_mentioned: signals.competitor_names_mentioned as unknown as import('@prisma/client').Prisma.InputJsonValue,
        response_draft: draft,
        detected_at: now,
      },
    });

    this.logger.log(
      `Saved thread [${platformName}]: "${thread.title.slice(0, 60)}" ` +
        `client=${signals.is_client_mentioned} comp=${signals.is_competitor_recommended}`,
    );

    return this.toResponse(saved);
  }

  // ── Signal detection ─────────────────────────────────────────────────────────

  private detectSignals(
    text: string,
    clientAliases: string[],
    competitorMap: { name: string; aliases: string[] }[],
  ): ThreadSignals {
    const is_client_mentioned = clientAliases.some((alias) => text.includes(alias));

    const mentionedCompetitors = competitorMap.filter((comp) =>
      comp.aliases.some((alias) => text.includes(alias)),
    );

    return {
      is_client_mentioned,
      is_competitor_recommended: mentionedCompetitors.length > 0,
      competitor_names_mentioned: mentionedCompetitors.map((c) => c.name),
    };
  }

  // ── Draft generation ─────────────────────────────────────────────────────────

  private async generateDraft(
    title: string,
    body: string,
    brandName: string,
    vertical: string,
  ): Promise<string> {
    const question = body.trim() || title;

    const systemPrompt =
      `You are a knowledgeable community member in the ${vertical} space. ` +
      `Answer the question helpfully and directly. Be specific and practical. ` +
      `Only mention ${brandName} if it genuinely answers the question — never lead with it. ` +
      `No marketing language, no superlatives, no promotional tone. ` +
      `Write in a natural Reddit comment style. Maximum 120 words.`;

    try {
      const completion = await this.cerebras.chat.completions.create({
        model: 'llama3.1-8b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Question: ${question}` },
        ],
        max_tokens: 250,
        temperature: 0.5,
      });
      return completion.choices[0]?.message?.content?.trim() ?? '';
    } catch (err) {
      this.logger.warn(`Cerebras draft failed: ${(err as Error).message}`);
      return `Great question. Based on experience in ${vertical}, the key factors to consider are quality of service, pricing transparency, and verified reviews. ${brandName} covers all three — worth checking out alongside the other options mentioned here.`;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toResponse(thread: {
    id: string; client_id: string; platform: string; url: string;
    thread_title: string; question_text: string | null; thread_score: number;
    is_client_mentioned: boolean; is_competitor_recommended: boolean;
    competitor_names_mentioned: unknown; ai_citation_count: number;
    response_draft: string | null; response_status: ResponseStatus;
    detected_at: Date; responded_at: Date | null; created_at: Date; updated_at: Date;
  }): CommunityThreadResponse {
    return {
      id: thread.id,
      client_id: thread.client_id,
      platform: thread.platform,
      url: thread.url,
      thread_title: thread.thread_title,
      question_text: thread.question_text,
      thread_score: thread.thread_score,
      is_client_mentioned: thread.is_client_mentioned,
      is_competitor_recommended: thread.is_competitor_recommended,
      competitor_names_mentioned: (thread.competitor_names_mentioned as string[]) ?? [],
      ai_citation_count: thread.ai_citation_count,
      response_draft: thread.response_draft,
      response_status: thread.response_status,
      detected_at: thread.detected_at.toISOString(),
      responded_at: thread.responded_at?.toISOString() ?? null,
      created_at: thread.created_at.toISOString(),
      updated_at: thread.updated_at.toISOString(),
    };
  }
}
