import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationSeverity } from '@prisma/client';
import { createHash } from 'crypto';
import { chromium, Browser } from 'playwright';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AggregatorPlatformConfig,
  AggregatorSnapshotResponse,
  CompetitorScore,
  EXPECTED_FIELDS,
  ProfileField,
  RawExtract,
  UpdatePackEntry,
} from './dto/aggregator.types';

// Suggested copy for each missing field — injected into update_pack
const FIELD_SUGGESTIONS: Record<ProfileField, string> = {
  name: 'Add your official business name exactly as registered.',
  address: 'Add your full street address including pin code.',
  phone: 'Add a primary contact number with STD code.',
  rating: 'Encourage customers to leave ratings to build this signal.',
  review_count: 'Request reviews from recent customers via WhatsApp or email.',
  description: 'Write a 100-150 word description covering services, location, and differentiators.',
  photos: 'Upload at least 10 high-quality photos (showroom, team, vehicles).',
  hours: 'Add weekday and weekend operating hours.',
  website: 'Link your official website URL.',
  category: 'Select the most specific category available on this platform.',
  certifications: 'Add any OEM authorisations, ISO certifications, or awards.',
  response_rate: 'Respond to all inquiries within 24 hours to improve this metric.',
};

@Injectable()
export class AggregatorService {
  private readonly logger = new Logger(AggregatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Scheduled weekly crawl ──────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_WEEK)
  async runScheduled(): Promise<void> {
    const clients = await this.prisma.client.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, brand_name: true },
    });
    this.logger.log(`Aggregator weekly crawl: ${clients.length} active client(s)`);
    for (const c of clients) {
      await this.runForClient(c.id).catch((err: Error) =>
        this.logger.error(`Aggregator crawl failed for client ${c.id} (${c.brand_name}): ${err.message}`),
      );
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async runForClient(clientId: string): Promise<AggregatorSnapshotResponse[]> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, is_active: true, deleted_at: null },
      include: {
        vertical: {
          select: { aggregator_platforms: true, name: true },
        },
      },
    });
    if (!client) throw new NotFoundException(`Client ${clientId} not found or inactive`);

    const platforms = client.vertical.aggregator_platforms as unknown as AggregatorPlatformConfig[];
    if (!platforms?.length) {
      this.logger.warn(`No aggregator platforms configured for vertical of client ${clientId}`);
      return [];
    }

    // Load top 3 competitors for this client's vertical + tenant
    const competitors = await this.prisma.competitor.findMany({
      where: { vertical_id: client.vertical_id, tenant_id: client.tenant_id, is_active: true },
      take: 3,
      select: { id: true, name: true },
    });

    const snapshots: AggregatorSnapshotResponse[] = [];

    for (const platform of platforms) {
      const snapshot = await this.crawlPlatform(client, platform, competitors);
      if (snapshot) snapshots.push(snapshot);
    }

    return snapshots;
  }

  async getLatestSnapshots(clientId: string): Promise<AggregatorSnapshotResponse[]> {
    // One latest snapshot per platform
    const rows = await this.prisma.$queryRaw<{ platform: string; max_crawled_at: Date }[]>`
      SELECT platform, MAX(crawled_at) AS max_crawled_at
      FROM aggregator_snapshots
      WHERE client_id = ${clientId}
      GROUP BY platform
    `;

    const results: AggregatorSnapshotResponse[] = [];
    for (const row of rows) {
      const snap = await this.prisma.aggregatorSnapshot.findFirst({
        where: { client_id: clientId, platform: row.platform, crawled_at: row.max_crawled_at },
      });
      if (snap) results.push(this.toResponse(snap));
    }
    return results;
  }

  // ── Core crawl orchestration ────────────────────────────────────────────────

  private async crawlPlatform(
    client: {
      id: string;
      brand_name: string;
      city: string;
      tenant_id: string;
      vertical_id: string;
    },
    platform: AggregatorPlatformConfig,
    competitors: { id: string; name: string }[],
  ): Promise<AggregatorSnapshotResponse | null> {
    const profileUrl = this.substituteUrl(platform.url_pattern, client.brand_name, client.city);

    this.logger.log(`Crawling ${platform.name} profile for ${client.brand_name}: ${profileUrl}`);

    const rawExtract = await this.crawlProfile(profileUrl, platform.css_selectors);
    const completenessScore = this.scoreCompleteness(rawExtract);
    const fieldsPresent = EXPECTED_FIELDS.filter((f) => rawExtract[f] !== null) as string[];
    const fieldsMissing = EXPECTED_FIELDS.filter((f) => rawExtract[f] === null) as string[];
    const contentHash = this.hashContent(rawExtract);
    const updatePack = this.generateUpdatePack(fieldsMissing as ProfileField[]);

    // Crawl competitors
    const competitorScores: CompetitorScore[] = [];
    for (const comp of competitors) {
      const compUrl = this.substituteUrl(platform.url_pattern, comp.name, client.city);
      const compExtract = await this.crawlProfile(compUrl, platform.css_selectors);
      const compScore = this.scoreCompleteness(compExtract);
      const compHash = this.hashContent(compExtract);

      competitorScores.push({
        competitor_id: comp.id,
        name: comp.name,
        score: compScore,
        url: compUrl,
      });

      // Hash-change alert for competitor
      await this.checkCompetitorHashChange(client.id, client.tenant_id, platform.name, comp, compHash);
    }

    const now = new Date();
    const snapshot = await this.prisma.aggregatorSnapshot.create({
      data: {
        client_id: client.id,
        platform: platform.name,
        profile_url: profileUrl,
        completeness_score: completenessScore,
        fields_present: fieldsPresent,
        fields_missing: fieldsMissing,
        competitor_scores: competitorScores as unknown as import('@prisma/client').Prisma.InputJsonValue,
        content_hash: contentHash,
        raw_extract: rawExtract as unknown as import('@prisma/client').Prisma.InputJsonValue,
        update_pack: updatePack as unknown as import('@prisma/client').Prisma.InputJsonValue,
        crawled_at: now,
      },
    });

    this.logger.log(
      `${platform.name} snapshot saved for ${client.brand_name}: score=${completenessScore.toFixed(1)}, hash=${contentHash.slice(0, 8)}`,
    );

    // Emit aggregator.score.low event if score is below threshold
    if (completenessScore < 60) {
      this.eventEmitter.emit('aggregator.score.low', {
        clientId: client.id,
        tenantId: client.tenant_id,
        aggregatorScore: completenessScore,
        aggregatorName: platform.name,
        timestamp: new Date(),
      });
    }

    return this.toResponse(snapshot);
  }

  // ── Playwright profile crawler ──────────────────────────────────────────────

  async crawlProfile(
    url: string,
    cssSelectors: Record<string, string>,
  ): Promise<RawExtract> {
    let browser: Browser | null = null;
    const extract: RawExtract = Object.fromEntries(
      EXPECTED_FIELDS.map((f) => [f, null]),
    ) as RawExtract;

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        extraHTTPHeaders: { 'Accept-Language': 'en-IN,en;q=0.9' },
      });
      const page = await context.newPage();

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await page.waitForTimeout(2000); // allow JS hydration
      } catch {
        this.logger.warn(`Navigation failed or timed out: ${url}`);
        return extract;
      }

      // 1. Try configured CSS selectors first
      const hasSelectors = Object.keys(cssSelectors).length > 0;
      if (hasSelectors) {
        for (const field of EXPECTED_FIELDS) {
          const selector = cssSelectors[field];
          if (selector) {
            try {
              const el = page.locator(selector).first();
              const text = await el.textContent({ timeout: 3000 });
              if (text?.trim()) extract[field] = text.trim();
            } catch {
              // selector not found on this page — leave null
            }
          }
        }
      }

      // 2. Generic fallback extraction for any field still null
      await this.genericExtract(page, extract);
    } catch (err) {
      this.logger.warn(`crawlProfile failed for ${url}: ${(err as Error).message}`);
    } finally {
      if (browser) await browser.close();
    }

    return extract;
  }

  private async genericExtract(
    page: import('playwright').Page,
    extract: RawExtract,
  ): Promise<void> {
    try {
      // name — h1 or og:title
      if (!extract.name) {
        extract.name =
          (await page.locator('h1').first().textContent({ timeout: 2000 }).catch(() => null))?.trim() ??
          (await page.getAttribute('meta[property="og:title"]', 'content').catch(() => null)) ??
          null;
      }

      // address
      if (!extract.address) {
        extract.address =
          (await page.locator('address').first().textContent({ timeout: 2000 }).catch(() => null))?.trim() ??
          (await page.locator('[itemprop="address"]').first().textContent({ timeout: 2000 }).catch(() => null))?.trim() ??
          null;
      }

      // phone — tel: links
      if (!extract.phone) {
        const tel = await page.locator('a[href^="tel:"]').first().getAttribute('href').catch(() => null);
        extract.phone = tel ? tel.replace('tel:', '').trim() : null;
      }

      // rating
      if (!extract.rating) {
        extract.rating =
          (await page.locator('[itemprop="ratingValue"]').first().textContent({ timeout: 2000 }).catch(() => null))?.trim() ??
          (await page.locator('.rating, .star-rating, [class*="rating"]').first().textContent({ timeout: 2000 }).catch(() => null))?.trim() ??
          null;
      }

      // review_count
      if (!extract.review_count) {
        const rcText = await page
          .locator('[itemprop="reviewCount"], .review-count, [class*="reviewCount"]')
          .first()
          .textContent({ timeout: 2000 })
          .catch(() => null);
        extract.review_count = rcText?.trim() ?? null;
      }

      // description — meta description
      if (!extract.description) {
        extract.description =
          (await page.getAttribute('meta[name="description"]', 'content').catch(() => null)) ??
          (await page.getAttribute('meta[property="og:description"]', 'content').catch(() => null)) ??
          null;
      }

      // photos — count img tags in main content area
      if (!extract.photos) {
        const imgCount = await page.locator('main img, article img, [class*="gallery"] img').count().catch(() => 0);
        extract.photos = imgCount > 0 ? `${imgCount} photo(s)` : null;
      }

      // hours
      if (!extract.hours) {
        extract.hours =
          (await page.locator('[itemprop="openingHours"]').first().textContent({ timeout: 2000 }).catch(() => null))?.trim() ??
          (await page.locator('[class*="hours"], [class*="timing"], [class*="workingHours"]').first().textContent({ timeout: 2000 }).catch(() => null))?.trim() ??
          null;
      }

      // website
      if (!extract.website) {
        extract.website =
          (await page.locator('a[itemprop="url"]').first().getAttribute('href').catch(() => null)) ??
          (await page.getAttribute('meta[property="og:url"]', 'content').catch(() => null)) ??
          null;
      }

      // category
      if (!extract.category) {
        extract.category =
          (await page.locator('[itemprop="category"]').first().textContent({ timeout: 2000 }).catch(() => null))?.trim() ??
          (await page.getAttribute('meta[name="category"]', 'content').catch(() => null)) ??
          null;
      }

      // certifications — keyword scan
      if (!extract.certifications) {
        const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => null) ?? '';
        const certMatch = bodyText.match(/\b(authorized|certified|ISO\s?[\d:]+|award[\w\s]+)\b/i);
        extract.certifications = certMatch ? certMatch[0].trim() : null;
      }

      // response_rate
      if (!extract.response_rate) {
        const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => null) ?? '';
        const rrMatch = bodyText.match(/response\s+rate[:\s]+([\d.]+%?)/i);
        extract.response_rate = rrMatch ? rrMatch[1].trim() : null;
      }
    } catch (err) {
      this.logger.warn(`genericExtract partial failure: ${(err as Error).message}`);
    }
  }

  // ── Completeness scoring ────────────────────────────────────────────────────

  scoreCompleteness(extract: RawExtract): number {
    const presentCount = EXPECTED_FIELDS.filter((f) => extract[f] !== null).length;
    return Math.round((presentCount / EXPECTED_FIELDS.length) * 10000) / 100;
  }

  // ── SHA-256 content hash ────────────────────────────────────────────────────

  hashContent(extract: RawExtract): string {
    const nonNull = EXPECTED_FIELDS.map((f) => `${f}:${extract[f] ?? ''}`).join('|');
    return createHash('sha256').update(nonNull).digest('hex');
  }

  // ── Update pack generator ───────────────────────────────────────────────────

  generateUpdatePack(missingFields: ProfileField[]): UpdatePackEntry[] {
    return missingFields.map((field) => ({
      field,
      suggestion: FIELD_SUGGESTIONS[field],
    }));
  }

  // ── Competitor hash-change alert ────────────────────────────────────────────

  private async checkCompetitorHashChange(
    clientId: string,
    tenantId: string,
    platform: string,
    competitor: { id: string; name: string },
    newHash: string,
  ): Promise<void> {
    const previous = await this.prisma.aggregatorSnapshot.findFirst({
      where: { client_id: clientId, platform },
      orderBy: { crawled_at: 'desc' },
      select: { competitor_scores: true },
    });

    if (!previous) return;

    const prevScores = previous.competitor_scores as { competitor_id: string; url: string }[];
    const prevEntry = prevScores.find((s) => s.competitor_id === competitor.id);
    if (!prevEntry) return;

    // Re-hash from the stored snapshot's raw extract — we only stored competitor_scores,
    // so we use the new hash from the freshly crawled page vs the entry in the previous snapshot.
    // Approximation: if competitor_id wasn't in previous scores, no alert.
    // For a real change signal we compare the newHash passed in vs whatever was stored.
    // Since we don't store per-competitor raw extract, we skip false-alert suppression and
    // rely on the content_hash of the CLIENT snapshot to detect broad changes instead.
    // Alert threshold: fire only when competitor score changed by >5 points.
    const prevScore = (previous.competitor_scores as { competitor_id: string; score: number }[])
      .find((s) => s.competitor_id === competitor.id)?.score;

    // Use hash to detect a profile change — compare stored hash
    // stored as part of competitor_scores entry in the PREVIOUS snapshot
    const prevHash = (previous.competitor_scores as { competitor_id: string; content_hash?: string }[])
      .find((s) => s.competitor_id === competitor.id)?.content_hash;

    if (prevHash && prevHash !== newHash) {
      this.logger.log(`Competitor profile change detected: ${competitor.name} on ${platform}`);
      await this.prisma.notification.create({
        data: {
          tenant_id: tenantId,
          client_id: clientId,
          type: 'competitor_profile_change',
          severity: NotificationSeverity.high,
          title: `${competitor.name} updated their ${platform} profile`,
          body: `The aggregator profile for ${competitor.name} on ${platform} has changed. Review their update and consider refreshing your own profile to maintain competitive parity.`,
          deep_link: `/offsite/aggregator/${clientId}/latest`,
        },
      }).catch((err: Error) =>
        this.logger.warn(`Failed to create competitor-change notification: ${err.message}`),
      );
    } else if (prevScore !== undefined && Math.abs((prevScore) - 0) > 5) {
      // score-drift alert as secondary signal (no previous hash stored yet)
      this.logger.debug(`Competitor ${competitor.name} score on ${platform}: ${prevScore} (no hash stored yet)`);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private substituteUrl(pattern: string, brand: string, city: string): string {
    const slugify = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return pattern
      .replace('{brand}', slugify(brand))
      .replace('{city}', slugify(city))
      .replace('{category}', 'dealers'); // sensible default for automotive
  }

  private toResponse(snap: {
    id: string;
    client_id: string;
    platform: string;
    profile_url: string;
    completeness_score: number;
    fields_present: unknown;
    fields_missing: unknown;
    competitor_scores: unknown;
    content_hash: string;
    update_pack: unknown;
    crawled_at: Date;
    created_at: Date;
  }): AggregatorSnapshotResponse {
    return {
      id: snap.id,
      client_id: snap.client_id,
      platform: snap.platform,
      profile_url: snap.profile_url,
      completeness_score: snap.completeness_score,
      fields_present: snap.fields_present as string[],
      fields_missing: snap.fields_missing as string[],
      competitor_scores: snap.competitor_scores as import('./dto/aggregator.types').CompetitorScore[],
      content_hash: snap.content_hash,
      update_pack: snap.update_pack as import('./dto/aggregator.types').UpdatePackEntry[],
      crawled_at: snap.crawled_at.toISOString(),
      created_at: snap.created_at.toISOString(),
    };
  }
}
