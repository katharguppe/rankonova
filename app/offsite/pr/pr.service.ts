import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationSeverity, PrSignalStatus } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { chromium } from 'playwright';
import { EventEmitter2 } from '@nestjs/event-emitter';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DistributionContact,
  PrSignalResponse,
  PrPickupResponse,
  RawNewsItem,
  RssFeedConfig,
} from './dto/pr.types';

const RELEVANCE_THRESHOLD = 0.3;
const PICKUP_MAX_AGE_DAYS = 30;

// Static journalist contacts per vertical slug
const JOURNALIST_CONTACTS: Record<string, Omit<DistributionContact, 'wire_service'>[]> = {
  automotive: [
    { outlet: 'Autocar India', journalist: 'Editorial Desk', contact: 'editorial@autocarindia.com' },
    { outlet: 'NDTV Auto', journalist: 'Auto Desk', contact: 'auto@ndtv.com' },
    { outlet: 'MotorBeam', journalist: 'News Desk', contact: 'news@motorbeam.com' },
    { outlet: 'CarWale', journalist: 'Content Team', contact: 'content@carwale.com' },
  ],
  healthcare: [
    { outlet: 'NDTV Health', journalist: 'Health Desk', contact: 'health@ndtv.com' },
    { outlet: 'Economic Times Health', journalist: 'ET Health Desk', contact: 'ethealth@timesinternet.in' },
    { outlet: 'Practo Blog', journalist: 'Editorial', contact: 'editorial@practo.com' },
  ],
  'real-estate': [
    { outlet: '99acres News', journalist: 'Realty Desk', contact: 'news@99acres.com' },
    { outlet: 'MagicBricks News', journalist: 'Property Desk', contact: 'news@magicbricks.com' },
    { outlet: 'Economic Times Realty', journalist: 'ET Realty Desk', contact: 'etrealty@timesinternet.in' },
  ],
  'hr-services': [
    { outlet: 'Economic Times HR', journalist: 'HR Desk', contact: 'etjobs@timesinternet.in' },
    { outlet: 'People Matters', journalist: 'Editorial Team', contact: 'editorial@peoplematters.in' },
    { outlet: 'Business Standard HR', journalist: 'HR Correspondent', contact: 'hr@business-standard.com' },
  ],
  'gcc-advisory': [
    { outlet: 'NASSCOM Insights', journalist: 'Research Desk', contact: 'insights@nasscom.in' },
    { outlet: 'Business Standard Tech', journalist: 'Tech Desk', contact: 'tech@business-standard.com' },
    { outlet: 'Economic Times CIO', journalist: 'CIO Desk', contact: 'etcio@timesinternet.in' },
  ],
};

const WIRE_SERVICES: Omit<DistributionContact, 'journalist'>[] = [
  { outlet: 'PRNewswire India', contact: 'indiasales@prnewswire.com', wire_service: true },
  { outlet: 'BusinessWire India', contact: 'info@businesswireindia.com', wire_service: true },
  { outlet: 'PRLog India', contact: 'support@prlog.org', wire_service: true },
];

@Injectable()
export class PrService {
  private readonly logger = new Logger(PrService.name);
  private readonly cerebras: OpenAI;
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    cdataPropName: '__cdata',
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.cerebras = new OpenAI({
      apiKey: process.env['CEREBRAS_API_KEY'] ?? '',
      baseURL: 'https://api.cerebras.ai/v1',
    });
  }

  // ── Scheduled jobs ───────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_6_HOURS)
  async runScheduled(): Promise<void> {
    const clients = await this.prisma.client.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, brand_name: true },
    });
    this.logger.log(`PR scan (6-hour): ${clients.length} active client(s)`);
    for (const c of clients) {
      await this.runForClient(c.id).catch((err: Error) =>
        this.logger.error(`PR scan failed for ${c.id} (${c.brand_name}): ${err.message}`),
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async pickupCheckScheduled(): Promise<void> {
    const cutoff = new Date(Date.now() - PICKUP_MAX_AGE_DAYS * 86_400_000);
    const signals = await this.prisma.prSignal.findMany({
      where: {
        status: { in: [PrSignalStatus.approved, PrSignalStatus.distributed] },
        created_at: { gte: cutoff },
      },
      select: { id: true },
    });
    this.logger.log(`Pickup check: ${signals.length} active signal(s)`);
    for (const s of signals) {
      await this.runPickupCheck(s.id).catch((err: Error) =>
        this.logger.warn(`Pickup check failed for ${s.id}: ${err.message}`),
      );
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async runForClient(clientId: string): Promise<PrSignalResponse[]> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, is_active: true, deleted_at: null },
      include: {
        vertical: {
          select: {
            name: true,
            slug: true,
            news_rss_feeds: true,
            trusted_domains: true,
            intent_categories: true,
          },
        },
      },
    });
    if (!client) throw new NotFoundException(`Client ${clientId} not found or inactive`);

    const feeds = (client.vertical.news_rss_feeds as unknown as RssFeedConfig[]) ?? [];
    if (!feeds.length) {
      this.logger.warn(`No RSS feeds configured for vertical ${client.vertical.slug}`);
      return [];
    }

    // Collect all news items across feeds
    const allItems: RawNewsItem[] = [];
    for (const feed of feeds) {
      const items = await this.fetchRssFeeds(feed).catch((err: Error) => {
        this.logger.warn(`RSS fetch failed [${feed.name}]: ${err.message}`);
        return [] as RawNewsItem[];
      });
      allItems.push(...items);
    }

    const keywords = [
      client.brand_name,
      client.city,
      client.vertical.name,
      ...(client.vertical.intent_categories as string[]),
    ].map((k) => k.toLowerCase());

    const created: PrSignalResponse[] = [];

    for (const item of allItems) {
      // Dedup: skip if this URL already has a signal for this client
      const existing = await this.prisma.prSignal.findFirst({
        where: { client_id: clientId, news_url: item.url },
      });
      if (existing) continue;

      const score = this.scoreRelevance(item, keywords);
      if (score < RELEVANCE_THRESHOLD) continue;

      const angle = await this.generatePrAngle(item, client.brand_name, client.vertical.name);
      const draft = await this.generatePressRelease(item, client, angle);
      const checklist = this.buildDistributionChecklist(client.vertical.slug);

      const signal = await this.prisma.prSignal.create({
        data: {
          client_id: clientId,
          news_title: item.title.slice(0, 500),
          news_url: item.url,
          news_source: item.source,
          published_at: item.publishedAt,
          relevance_score: score,
          pr_angle: angle,
          press_release_draft: draft,
          distribution_checklist: checklist as unknown as import('@prisma/client').Prisma.InputJsonValue,
        },
        include: { pickups: true },
      });

      // Notification for new PR opportunity
      await this.prisma.notification.create({
        data: {
          tenant_id: client.tenant_id,
          client_id: clientId,
          type: 'pr_opportunity',
          severity: NotificationSeverity.medium,
          title: `New PR opportunity for ${client.brand_name}`,
          body: `"${item.title.slice(0, 100)}" — relevance ${Math.round(score * 100)}%. Press release draft ready.`,
          deep_link: `/offsite/pr/${clientId}/signals`,
        },
      }).catch((err: Error) => this.logger.warn(`Notification failed: ${err.message}`));

      // Emit pr.opportunity event for notification handler
      this.eventEmitter.emit('pr.opportunity', {
        clientId: clientId,
        tenantId: client.tenant_id,
        prTitle: item.title.slice(0, 100),
        domain: item.source,
        prUrl: item.url,
        timestamp: new Date(),
      });

      created.push(this.toResponse(signal));
      this.logger.log(`PR signal created: "${item.title.slice(0, 60)}" score=${score.toFixed(2)}`);
    }

    return created;
  }

  async getSignals(clientId: string, status?: PrSignalStatus): Promise<PrSignalResponse[]> {
    const signals = await this.prisma.prSignal.findMany({
      where: {
        client_id: clientId,
        ...(status ? { status } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: 50,
      include: { pickups: true },
    });
    return signals.map((s) => this.toResponse(s));
  }

  async approveSignal(signalId: string): Promise<PrSignalResponse> {
    const signal = await this.prisma.prSignal.findUnique({ where: { id: signalId } });
    if (!signal) throw new NotFoundException(`PrSignal ${signalId} not found`);
    const updated = await this.prisma.prSignal.update({
      where: { id: signalId },
      data: { status: PrSignalStatus.approved, approved_at: new Date() },
      include: { pickups: true },
    });
    return this.toResponse(updated);
  }

  async markDistributed(signalId: string): Promise<PrSignalResponse> {
    const signal = await this.prisma.prSignal.findUnique({ where: { id: signalId } });
    if (!signal) throw new NotFoundException(`PrSignal ${signalId} not found`);
    const updated = await this.prisma.prSignal.update({
      where: { id: signalId },
      data: { status: PrSignalStatus.distributed },
      include: { pickups: true },
    });
    return this.toResponse(updated);
  }

  async archiveSignal(signalId: string): Promise<PrSignalResponse> {
    const signal = await this.prisma.prSignal.findUnique({ where: { id: signalId } });
    if (!signal) throw new NotFoundException(`PrSignal ${signalId} not found`);
    const updated = await this.prisma.prSignal.update({
      where: { id: signalId },
      data: { status: PrSignalStatus.archived },
      include: { pickups: true },
    });
    return this.toResponse(updated);
  }

  async runPickupCheck(signalId: string): Promise<PrPickupResponse[]> {
    const signal = await this.prisma.prSignal.findUnique({
      where: { id: signalId },
      include: {
        client: {
          include: { vertical: { select: { trusted_domains: true } } },
        },
      },
    });
    if (!signal) throw new NotFoundException(`PrSignal ${signalId} not found`);

    const trustedDomains = (signal.client.vertical.trusted_domains as string[]) ?? [];
    // Headline words for the site-search query (first 8 words)
    const headlineQuery = signal.news_title.split(/\s+/).slice(0, 8).join(' ');

    const results: PrPickupResponse[] = [];
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });

      for (const domain of trustedDomains) {
        const searchUrl = `https://www.google.com/search?q=site:${domain}+${encodeURIComponent(`"${headlineQuery}"`)}`;
        const page = await context.newPage();

        try {
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
          await page.waitForTimeout(1500);

          // Detect any result link pointing to the domain
          const links = await page
            .locator(`a[href*="${domain}"]`)
            .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).href))
            .catch(() => [] as string[]);

          const hasResult = links.length > 0;

          if (hasResult) {
            const pickup = await this.prisma.prPickup.upsert({
              where: {
                // use a compound unique via findFirst+update pattern (no compound unique in schema)
                id: (
                  await this.prisma.prPickup.findFirst({
                    where: { pr_signal_id: signalId, domain },
                    select: { id: true },
                  })
                )?.id ?? 'new',
              },
              update: { indexed_url: links[0] ?? null, detected_at: new Date() },
              create: {
                pr_signal_id: signalId,
                domain,
                indexed_url: links[0] ?? null,
                is_ai_trusted: true,
              },
            });
            results.push(this.toPickupResponse(pickup));
            this.logger.log(`Pickup detected: ${domain} for signal ${signalId}`);
          }
        } catch (err) {
          this.logger.warn(`Pickup check failed [${domain}]: ${(err as Error).message}`);
        } finally {
          await page.close();
        }

        await this.sleep(1000);
      }
    } finally {
      await browser.close();
    }

    return results;
  }

  // ── RSS fetch + parse ────────────────────────────────────────────────────────

  private async fetchRssFeeds(feed: RssFeedConfig): Promise<RawNewsItem[]> {
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': 'AEO-Suite/1.0 pr-monitor (contact: admin@aeo-suite.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`RSS fetch ${res.status} for ${feed.url}`);

    const xml = await res.text();
    const parsed = this.xmlParser.parse(xml) as Record<string, unknown>;

    // Support both RSS 2.0 (rss.channel.item) and Atom (feed.entry)
    const rssChannel = (parsed['rss'] as Record<string, unknown> | undefined)?.['channel'] as Record<string, unknown> | undefined;
    const atomFeed = parsed['feed'] as Record<string, unknown> | undefined;

    const rawItems: unknown[] =
      (rssChannel?.['item'] as unknown[]) ??
      (atomFeed?.['entry'] as unknown[]) ??
      [];

    const items = Array.isArray(rawItems) ? rawItems : [rawItems];
    const source = new URL(feed.url).hostname;

    return items.slice(0, 15).map((item) => {
      const i = item as Record<string, unknown>;
      const title = this.extractText(i['title']) ?? '';
      const link = this.extractText(i['link']) ?? this.extractText(i['id']) ?? '';
      const description = this.extractText(i['description']) ?? this.extractText(i['summary']) ?? '';
      const pubDateStr = this.extractText(i['pubDate']) ?? this.extractText(i['published']) ?? null;

      return {
        title: title.slice(0, 500),
        url: link,
        source,
        description: description.slice(0, 1000),
        publishedAt: pubDateStr ? new Date(pubDateStr) : null,
      };
    }).filter((item) => item.title && item.url);
  }

  private extractText(val: unknown): string | null {
    if (!val) return null;
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      // CDATA content from fast-xml-parser
      if (obj['__cdata']) return String(obj['__cdata']).trim();
      // Atom link: { '@_href': '...' }
      if (obj['@_href']) return String(obj['@_href']).trim();
      // text content
      if (obj['#text']) return String(obj['#text']).trim();
    }
    return String(val).trim();
  }

  // ── Relevance scoring ────────────────────────────────────────────────────────

  private scoreRelevance(item: RawNewsItem, keywords: string[]): number {
    const haystack = `${item.title} ${item.description}`.toLowerCase();
    const matched = keywords.filter((kw) => kw.length > 2 && haystack.includes(kw));
    return keywords.length > 0 ? matched.length / keywords.length : 0;
  }

  // ── AI generation ────────────────────────────────────────────────────────────

  private async generatePrAngle(
    item: RawNewsItem,
    brandName: string,
    verticalName: string,
  ): Promise<string> {
    const prompt =
      `News headline: "${item.title}"\n` +
      `Brand: ${brandName} (${verticalName} sector)\n\n` +
      `Write a 1-2 sentence PR newsjacking angle that connects this news to ${brandName}'s positioning. ` +
      `Be specific and factual. No marketing language. Max 50 words.`;

    try {
      const res = await this.cerebras.chat.completions.create({
        model: 'llama3.1-8b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.4,
      });
      return res.choices[0]?.message?.content?.trim() ?? this.fallbackAngle(item, brandName);
    } catch {
      return this.fallbackAngle(item, brandName);
    }
  }

  private fallbackAngle(item: RawNewsItem, brandName: string): string {
    return `As ${item.title.toLowerCase().includes('growth') ? 'the sector grows' : 'this news develops'}, ${brandName} is positioned to address the evolving needs of customers in this space.`;
  }

  private async generatePressRelease(
    item: RawNewsItem,
    client: { brand_name: string; city: string; vertical: { name: string } },
    angle: string,
  ): Promise<string> {
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    const prompt =
      `Write a press release for ${client.brand_name} responding to this news:\n` +
      `Headline: "${item.title}"\n` +
      `PR Angle: ${angle}\n\n` +
      `Use inverted pyramid structure:\n` +
      `1. HEADLINE (all caps, max 12 words)\n` +
      `2. DATELINE: ${client.city}, ${today} —\n` +
      `3. Lead paragraph (who/what/when/where/why, 40-60 words)\n` +
      `4. Body paragraph (supporting facts, 60-80 words)\n` +
      `5. Quote: [PRINCIPAL_NAME], [TITLE], ${client.brand_name} said: "[QUOTE_PLACEHOLDER]"\n` +
      `6. Boilerplate: About ${client.brand_name} (2 sentences)\n\n` +
      `Be factual, no superlatives, no promotional language. Max 300 words.`;

    try {
      const res = await this.cerebras.chat.completions.create({
        model: 'llama3.1-8b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      });
      return res.choices[0]?.message?.content?.trim() ?? this.fallbackPressRelease(item, client, today);
    } catch {
      return this.fallbackPressRelease(item, client, today);
    }
  }

  private fallbackPressRelease(
    item: RawNewsItem,
    client: { brand_name: string; city: string; vertical: { name: string } },
    today: string,
  ): string {
    return [
      `${client.brand_name.toUpperCase()} RESPONDS TO LATEST ${client.vertical.name.toUpperCase()} DEVELOPMENTS`,
      '',
      `${client.city}, ${today} — ${client.brand_name}, a leading ${client.vertical.name} provider, ` +
        `today commented on recent industry developments following reports of ${item.title.toLowerCase()}.`,
      '',
      `The company noted that these developments reflect broader trends in the ${client.vertical.name} sector ` +
        `and reaffirmed its commitment to delivering quality service to customers across the region.`,
      '',
      `[PRINCIPAL_NAME], [TITLE], ${client.brand_name} said: "[QUOTE_PLACEHOLDER]"`,
      '',
      `About ${client.brand_name}: ${client.brand_name} is a ${client.vertical.name} company based in ${client.city}, ` +
        `serving customers with a focus on quality, transparency, and customer satisfaction.`,
    ].join('\n');
  }

  // ── Distribution checklist ───────────────────────────────────────────────────

  private buildDistributionChecklist(verticalSlug: string): DistributionContact[] {
    const journalists = JOURNALIST_CONTACTS[verticalSlug] ?? JOURNALIST_CONTACTS['hr-services'];
    const verticalContacts: DistributionContact[] = journalists.map((j) => ({
      ...j,
      wire_service: false,
    }));
    const wireContacts: DistributionContact[] = WIRE_SERVICES.map((w) => ({
      outlet: w.outlet,
      journalist: 'Wire Service Desk',
      contact: w.contact,
      wire_service: true,
    }));
    return [...verticalContacts, ...wireContacts];
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toResponse(signal: {
    id: string; client_id: string; news_title: string; news_url: string;
    news_source: string; published_at: Date | null; relevance_score: number;
    pr_angle: string; press_release_draft: string; distribution_checklist: unknown;
    status: PrSignalStatus; approved_at: Date | null;
    created_at: Date; updated_at: Date;
    pickups: Array<{
      id: string; pr_signal_id: string; domain: string; indexed_url: string | null;
      is_ai_trusted: boolean; detected_at: Date;
    }>;
  }): PrSignalResponse {
    return {
      id: signal.id,
      client_id: signal.client_id,
      news_title: signal.news_title,
      news_url: signal.news_url,
      news_source: signal.news_source,
      published_at: signal.published_at?.toISOString() ?? null,
      relevance_score: signal.relevance_score,
      pr_angle: signal.pr_angle,
      press_release_draft: signal.press_release_draft,
      distribution_checklist: (signal.distribution_checklist as DistributionContact[]) ?? [],
      status: signal.status as PrSignalResponse['status'],
      approved_at: signal.approved_at?.toISOString() ?? null,
      pickups: signal.pickups.map((p) => this.toPickupResponse(p)),
      created_at: signal.created_at.toISOString(),
      updated_at: signal.updated_at.toISOString(),
    };
  }

  private toPickupResponse(pickup: {
    id: string; pr_signal_id: string; domain: string;
    indexed_url: string | null; is_ai_trusted: boolean; detected_at: Date;
  }): PrPickupResponse {
    return {
      id: pickup.id,
      pr_signal_id: pickup.pr_signal_id,
      domain: pickup.domain,
      indexed_url: pickup.indexed_url,
      is_ai_trusted: pickup.is_ai_trusted,
      detected_at: pickup.detected_at.toISOString(),
    };
  }
}
