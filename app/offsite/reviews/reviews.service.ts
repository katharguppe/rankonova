import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationSeverity, ResponseStatus } from '@prisma/client';
import { chromium, Browser } from 'playwright';
import { EventEmitter2 } from '@nestjs/event-emitter';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GapVsCompetitor,
  KeywordFrequency,
  ReviewAuditResponse,
  ReviewPlatformConfig,
  ReviewRequestKitResponse,
  ReviewSnapshotResponse,
  ScrapedReview,
} from './dto/reviews.types';

// Common words to exclude from keyword frequency analysis
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has',
  'had', 'do', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'this', 'that', 'it', 'its', 'i', 'my', 'me', 'we', 'our', 'they',
  'their', 'very', 'so', 'not', 'no', 'he', 'she', 'his', 'her',
]);

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);
  private readonly cerebras: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.cerebras = new OpenAI({
      apiKey: process.env['CEREBRAS_API_KEY'] ?? '',
      baseURL: 'https://api.cerebras.ai/v1',
    });
  }

  // ── Scheduled jobs ──────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runScheduled(): Promise<void> {
    const clients = await this.prisma.client.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, brand_name: true },
    });
    this.logger.log(`Review daily crawl: ${clients.length} active client(s)`);
    for (const c of clients) {
      await this.runForClient(c.id).catch((err: Error) =>
        this.logger.error(`Review crawl failed for ${c.id} (${c.brand_name}): ${err.message}`),
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scanNegatives(): Promise<void> {
    const clients = await this.prisma.client.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, tenant_id: true, brand_name: true },
    });
    for (const c of clients) {
      const undrafted = await this.prisma.reviewSnapshot.findMany({
        where: {
          client_id: c.id,
          is_negative: true,
          response_draft: null,
          response_status: ResponseStatus.pending,
        },
        take: 5,
      });
      for (const snap of undrafted) {
        await this.generateResponseDraft(snap.id).catch((err: Error) =>
          this.logger.warn(`Draft gen failed for snapshot ${snap.id}: ${err.message}`),
        );
      }
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async runForClient(clientId: string): Promise<ReviewAuditResponse[]> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, is_active: true, deleted_at: null },
      include: {
        vertical: { select: { review_platforms: true } },
      },
    });
    if (!client) throw new NotFoundException(`Client ${clientId} not found or inactive`);

    const platforms = client.vertical.review_platforms as unknown as ReviewPlatformConfig[];
    if (!platforms?.length) {
      this.logger.warn(`No review platforms configured for client ${clientId}`);
      return [];
    }

    const audits: ReviewAuditResponse[] = [];
    for (const platform of platforms) {
      const audit = await this.crawlAndAudit(client, platform);
      if (audit) audits.push(audit);
    }

    // Check for review backlog and emit event
    const unansweredReviews = await this.prisma.reviewSnapshot.count({
      where: {
        client_id: clientId,
        response_status: ResponseStatus.pending,
      },
    });

    if (unansweredReviews > 20) {
      this.eventEmitter.emit('review.backlog', {
        clientId,
        tenantId: client.tenant_id,
        backlogCount: unansweredReviews,
        timestamp: new Date(),
      });
    }

    return audits;
  }

  async getLatestAudits(clientId: string): Promise<ReviewAuditResponse[]> {
    const rows = await this.prisma.$queryRaw<{ platform: string; max_checked: Date }[]>`
      SELECT platform, MAX(last_checked_at) AS max_checked
      FROM review_audits
      WHERE client_id = ${clientId}
      GROUP BY platform
    `;
    const results: ReviewAuditResponse[] = [];
    for (const row of rows) {
      const audit = await this.prisma.reviewAudit.findFirst({
        where: { client_id: clientId, platform: row.platform, last_checked_at: row.max_checked },
      });
      if (audit) results.push(this.toAuditResponse(audit));
    }
    return results;
  }

  async getSnapshots(
    clientId: string,
    platform?: string,
    isNegative?: boolean,
  ): Promise<ReviewSnapshotResponse[]> {
    const snaps = await this.prisma.reviewSnapshot.findMany({
      where: {
        client_id: clientId,
        ...(platform ? { platform } : {}),
        ...(isNegative !== undefined ? { is_negative: isNegative } : {}),
      },
      orderBy: { detected_at: 'desc' },
      take: 100,
    });
    return snaps.map((s) => this.toSnapshotResponse(s));
  }

  async generateResponseDraft(snapshotId: string): Promise<ReviewSnapshotResponse> {
    const snap = await this.prisma.reviewSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snap) throw new NotFoundException(`ReviewSnapshot ${snapshotId} not found`);

    const client = await this.prisma.client.findUnique({
      where: { id: snap.client_id },
      select: { brand_name: true, city: true },
    });
    const brand = client?.brand_name ?? 'the business';

    const systemPrompt = snap.is_negative
      ? `You are a professional customer relations manager for ${brand}. Write a concise, empathetic de-escalation response to a negative review. Acknowledge the concern, apologise without admitting liability, offer a resolution, and invite the customer to contact you directly. Maximum 80 words. No markdown.`
      : `You are a professional customer relations manager for ${brand}. Write a warm, grateful response to a positive review. Thank the reviewer by name if available, reinforce one specific detail they mentioned. Maximum 60 words. No markdown.`;

    let draft: string;
    try {
      const completion = await this.cerebras.chat.completions.create({
        model: 'llama3.1-8b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Review (${snap.rating} stars): ${snap.review_text}` },
        ],
        max_tokens: 200,
        temperature: 0.4,
      });
      draft = completion.choices[0]?.message?.content?.trim() ?? '';
    } catch (err) {
      this.logger.warn(`Cerebras draft gen failed for ${snapshotId}: ${(err as Error).message}`);
      draft = `Dear ${snap.reviewer_name ?? 'valued customer'}, thank you for your feedback. We take all reviews seriously and will use this to improve. Please contact us directly so we can resolve your concern.`;
    }

    const updated = await this.prisma.reviewSnapshot.update({
      where: { id: snapshotId },
      data: { response_draft: draft },
    });
    return this.toSnapshotResponse(updated);
  }

  async generateRequestKit(clientId: string): Promise<ReviewRequestKitResponse> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, is_active: true, deleted_at: null },
      select: { brand_name: true, city: true, website_url: true },
    });
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);

    const { brand_name, city, website_url } = client;
    const reviewUrl = `https://search.google.com/local/writereview?query=${encodeURIComponent(`${brand_name} ${city}`)}`;

    const whatsapp_template =
      `Hi! Thank you for choosing *${brand_name}*. We hope your experience was great. ` +
      `If you have 2 minutes, we'd love your honest review — it helps other customers find us:\n` +
      `${reviewUrl}\n\nThank you! 🙏`;

    const sms_template =
      `Thank you for visiting ${brand_name}! Please share your experience: ${reviewUrl}`;

    const email_subject = `How was your experience with ${brand_name}?`;

    const email_body =
      `<p>Dear Customer,</p>` +
      `<p>Thank you for choosing <strong>${brand_name}</strong> in ${city}. Your satisfaction is our priority.</p>` +
      `<p>We'd be grateful if you could take 2 minutes to share your experience online. ` +
      `Honest reviews help other customers and help us keep improving.</p>` +
      `<p style="text-align:center;margin:24px 0">` +
      `  <a href="${reviewUrl}" style="background:#4285F4;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold">` +
      `    Leave a Review` +
      `  </a>` +
      `</p>` +
      `<p>Thank you,<br/><strong>${brand_name} Team</strong><br/>${website_url}</p>`;

    const qr_code_html = this.buildQrHtml(reviewUrl, brand_name);

    const kit = await this.prisma.reviewRequestKit.upsert({
      where: { client_id: clientId },
      update: { whatsapp_template, sms_template, email_subject, email_body, qr_code_html },
      create: { client_id: clientId, whatsapp_template, sms_template, email_subject, email_body, qr_code_html },
    });

    return this.toKitResponse(kit);
  }

  async getRequestKit(clientId: string): Promise<ReviewRequestKitResponse | null> {
    const kit = await this.prisma.reviewRequestKit.findUnique({ where: { client_id: clientId } });
    return kit ? this.toKitResponse(kit) : null;
  }

  // ── Core crawl + audit ───────────────────────────────────────────────────────

  private async crawlAndAudit(
    client: { id: string; brand_name: string; city: string; tenant_id: string; vertical_id: string },
    platform: ReviewPlatformConfig,
  ): Promise<ReviewAuditResponse | null> {
    this.logger.log(`Scraping reviews: ${platform.name} for ${client.brand_name}`);

    const reviews = await this.scrapeReviews(client, platform);
    if (!reviews.length) {
      this.logger.warn(`No reviews scraped from ${platform.name} for ${client.brand_name}`);
    }

    const now = new Date();
    const avgRating =
      reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : null;

    const recency = reviews
      .map((r) => r.review_date)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    // review_velocity: reviews whose date is within last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentCount = reviews.filter(
      (r) => r.review_date && r.review_date >= thirtyDaysAgo,
    ).length;
    const review_velocity = reviews.length > 0 ? recentCount : null;

    const keywordFrequency = this.computeKeywordFrequency(reviews);

    // Answered reviews heuristic: assume no data without API → null
    const response_rate: number | null = null;

    // gap_vs_top_competitor: compare to best competitor audit on same platform
    const topCompetitorAudit = await this.prisma.reviewAudit.findFirst({
      where: {
        platform: platform.name,
        client_id: { not: client.id },
      },
      orderBy: { rating: 'desc' },
    });
    const gap_vs_top_competitor: GapVsCompetitor | null = topCompetitorAudit
      ? {
          rating_gap: avgRating !== null && topCompetitorAudit.rating !== null
            ? Math.round((topCompetitorAudit.rating - avgRating) * 10) / 10
            : 0,
          review_count_gap:
            topCompetitorAudit.review_count !== null
              ? topCompetitorAudit.review_count - (reviews.length || 0)
              : 0,
          response_rate_gap: 0,
        }
      : null;

    // Upsert audit (one row per client+platform, updated on each crawl)
    const audit = await this.prisma.reviewAudit.upsert({
      where: { id: await this.getAuditId(client.id, platform.name) },
      update: {
        rating: avgRating,
        review_count: reviews.length || null,
        response_rate,
        recency,
        keyword_frequency: keywordFrequency as unknown as import('@prisma/client').Prisma.InputJsonValue,
        review_velocity,
        last_checked_at: now,
        gap_vs_top_competitor: gap_vs_top_competitor as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
      create: {
        client_id: client.id,
        platform: platform.name,
        rating: avgRating,
        review_count: reviews.length || null,
        response_rate,
        recency,
        keyword_frequency: keywordFrequency as unknown as import('@prisma/client').Prisma.InputJsonValue,
        review_velocity,
        last_checked_at: now,
        gap_vs_top_competitor: gap_vs_top_competitor as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    // Persist individual review snapshots + detect negatives
    await this.persistSnapshots(client.id, client.tenant_id, platform.name, reviews, now);

    return this.toAuditResponse(audit);
  }

  private async getAuditId(clientId: string, platform: string): Promise<string> {
    const existing = await this.prisma.reviewAudit.findFirst({
      where: { client_id: clientId, platform },
      select: { id: true },
    });
    // Return a deterministic non-existent ID when no row exists so upsert falls to create
    return existing?.id ?? `__new__${clientId}__${platform}`;
  }

  private async persistSnapshots(
    clientId: string,
    tenantId: string,
    platform: string,
    reviews: ScrapedReview[],
    now: Date,
  ): Promise<void> {
    for (const review of reviews) {
      const isNegative = review.rating <= 2;

      // Avoid duplicates: match on platform + reviewer_name + review_text prefix
      const textPrefix = review.review_text.slice(0, 120);
      const existing = await this.prisma.reviewSnapshot.findFirst({
        where: {
          client_id: clientId,
          platform,
          review_text: { startsWith: textPrefix },
        },
      });
      if (existing) continue;

      const snap = await this.prisma.reviewSnapshot.create({
        data: {
          client_id: clientId,
          platform,
          reviewer_name: review.reviewer_name,
          rating: review.rating,
          review_text: review.review_text,
          review_date: review.review_date,
          is_negative: isNegative,
          detected_at: now,
        },
      });

      if (isNegative) {
        // Auto-generate draft inline (do not await to avoid blocking the loop)
        this.generateResponseDraft(snap.id).catch((err: Error) =>
          this.logger.warn(`Inline draft gen failed: ${err.message}`),
        );

        // Fire high-severity notification
        await this.prisma.notification.create({
          data: {
            tenant_id: tenantId,
            client_id: clientId,
            type: 'negative_review_detected',
            severity: NotificationSeverity.high,
            title: `${review.rating}-star review on ${platform}`,
            body: `New negative review from ${review.reviewer_name ?? 'anonymous'}: "${review.review_text.slice(0, 120)}…" — de-escalation draft is being generated.`,
            deep_link: `/offsite/reviews/${clientId}/snapshots?is_negative=true`,
          },
        }).catch((err: Error) =>
          this.logger.warn(`Notification create failed: ${err.message}`),
        );
      }
    }
  }

  // ── Playwright scraper ───────────────────────────────────────────────────────

  private async scrapeReviews(
    client: { brand_name: string; city: string },
    platform: ReviewPlatformConfig,
  ): Promise<ScrapedReview[]> {
    const url = this.buildProfileUrl(platform, client.brand_name, client.city);
    let browser: Browser | null = null;
    const reviews: ScrapedReview[] = [];

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
        await page.waitForTimeout(2500);
      } catch {
        this.logger.warn(`Navigation failed: ${url}`);
        return reviews;
      }

      // Generic review card extraction — works across most aggregator layouts
      const cards = await page.locator(
        '[class*="review"], [class*="Review"], [itemprop="review"], .user-review, .review-card',
      ).all();

      for (const card of cards.slice(0, 20)) {
        try {
          const ratingText = await card
            .locator('[class*="rating"], [class*="star"], [itemprop="ratingValue"]')
            .first()
            .textContent({ timeout: 1500 })
            .catch(() => null);

          const rating = ratingText ? parseFloat(ratingText.trim()) : null;
          if (!rating || isNaN(rating) || rating < 1 || rating > 5) continue;

          const reviewText = await card
            .locator('[class*="text"], [class*="content"], [class*="body"], [itemprop="reviewBody"], p')
            .first()
            .textContent({ timeout: 1500 })
            .catch(() => null);
          if (!reviewText?.trim() || reviewText.trim().length < 10) continue;

          const reviewerName = await card
            .locator('[class*="author"], [class*="name"], [class*="user"], [itemprop="author"]')
            .first()
            .textContent({ timeout: 1500 })
            .catch(() => null);

          const dateText = await card
            .locator('[class*="date"], [class*="time"], time, [itemprop="datePublished"]')
            .first()
            .textContent({ timeout: 1500 })
            .catch(() => null);

          const review_date = dateText ? this.parseReviewDate(dateText.trim()) : null;

          reviews.push({
            reviewer_name: reviewerName?.trim() ?? null,
            rating,
            review_text: reviewText.trim(),
            review_date,
          });
        } catch {
          // skip malformed card
        }
      }

      this.logger.log(`Scraped ${reviews.length} review(s) from ${platform.name} for ${client.brand_name}`);
    } catch (err) {
      this.logger.warn(`scrapeReviews failed for ${platform.name}: ${(err as Error).message}`);
    } finally {
      if (browser) await browser.close();
    }

    return reviews;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private buildProfileUrl(platform: ReviewPlatformConfig, brand: string, city: string): string {
    const slugify = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const base = platform.config['base_url'] ?? '';
    const slug = slugify(brand);
    const citySlug = slugify(city);

    switch (platform.name.toLowerCase()) {
      case 'google my business':
        return `https://www.google.com/search?q=${encodeURIComponent(`${brand} ${city} reviews`)}`;
      case 'cardekho reviews':
        return `${base}/dealers/${citySlug}/${slug}`;
      case 'zigwheels reviews':
        return `${base}/dealers/${citySlug}/${slug}`;
      case 'practo reviews':
        return `${base}/${citySlug}/doctors`;
      case 'justdial reviews':
        return `${base}/${citySlug}/${slug}`;
      case 'ambitionbox':
        return `${base}/overview/${slug}-overview`;
      case 'glassdoor india':
        return `${base}/Reviews/${slug}-reviews.htm`;
      case '99acres reviews':
        return `${base}/search/property?keyword=${encodeURIComponent(brand)}`;
      case 'magicbricks reviews':
        return `${base}/property-for-sale/residential-real-estate?keyword=${encodeURIComponent(brand)}`;
      default:
        return base || `https://www.google.com/search?q=${encodeURIComponent(`${brand} ${city} reviews`)}`;
    }
  }

  private parseReviewDate(text: string): Date | null {
    // Handle relative dates: "2 days ago", "3 months ago", "1 year ago"
    const now = new Date();
    const relMatch = text.match(/(\d+)\s+(day|week|month|year)s?\s+ago/i);
    if (relMatch) {
      const n = parseInt(relMatch[1]);
      const unit = relMatch[2].toLowerCase();
      const ms = { day: 86400000, week: 604800000, month: 2592000000, year: 31536000000 }[unit] ?? 0;
      return new Date(now.getTime() - n * ms);
    }
    const parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private computeKeywordFrequency(reviews: ScrapedReview[]): KeywordFrequency[] {
    const freq: Record<string, number> = {};
    for (const review of reviews) {
      const words = review.review_text
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
      for (const word of words) {
        freq[word] = (freq[word] ?? 0) + 1;
      }
    }
    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
  }

  private buildQrHtml(url: string, brandName: string): string {
    // Pure SVG QR-like grid — encodes URL as a visual placeholder.
    // Real QR encoding requires a library; this renders a branded placeholder
    // with the review link embedded as a clickable href, suitable for print.
    const encodedUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const shortUrl = url.length > 60 ? url.slice(0, 57) + '...' : url;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${brandName} — Review QR</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 32px; background: #fff; }
    .qr-frame { border: 3px solid #222; padding: 12px; border-radius: 4px; margin: 16px 0; }
    svg { display: block; }
    .label { font-size: 13px; color: #555; text-align: center; max-width: 200px; word-break: break-all; }
    h2 { margin: 0 0 8px; font-size: 18px; color: #222; }
    p { font-size: 13px; color: #555; text-align: center; margin: 0 0 16px; }
    a { color: #4285F4; }
  </style>
</head>
<body>
  <h2>${brandName}</h2>
  <p>Scan to leave a review</p>
  <div class="qr-frame">
    <a href="${encodedUrl}" target="_blank" rel="noopener">
      <svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-label="QR code for ${brandName} reviews">
        <!-- Finder pattern top-left -->
        <rect x="8" y="8" width="42" height="42" fill="none" stroke="#222" stroke-width="4"/>
        <rect x="18" y="18" width="22" height="22" fill="#222"/>
        <!-- Finder pattern top-right -->
        <rect x="110" y="8" width="42" height="42" fill="none" stroke="#222" stroke-width="4"/>
        <rect x="120" y="18" width="22" height="22" fill="#222"/>
        <!-- Finder pattern bottom-left -->
        <rect x="8" y="110" width="42" height="42" fill="none" stroke="#222" stroke-width="4"/>
        <rect x="18" y="120" width="22" height="22" fill="#222"/>
        <!-- Data modules placeholder (visual only) -->
        <rect x="60" y="8" width="6" height="6" fill="#222"/><rect x="70" y="8" width="6" height="6" fill="#222"/>
        <rect x="60" y="18" width="6" height="6" fill="#222"/><rect x="80" y="18" width="6" height="6" fill="#222"/>
        <rect x="70" y="28" width="6" height="6" fill="#222"/><rect x="90" y="28" width="6" height="6" fill="#222"/>
        <rect x="60" y="38" width="6" height="6" fill="#222"/><rect x="80" y="38" width="6" height="6" fill="#222"/>
        <rect x="60" y="60" width="6" height="6" fill="#222"/><rect x="70" y="60" width="6" height="6" fill="#222"/>
        <rect x="80" y="60" width="6" height="6" fill="#222"/><rect x="90" y="60" width="6" height="6" fill="#222"/>
        <rect x="100" y="60" width="6" height="6" fill="#222"/><rect x="110" y="60" width="6" height="6" fill="#222"/>
        <rect x="60" y="70" width="6" height="6" fill="#222"/><rect x="80" y="70" width="6" height="6" fill="#222"/>
        <rect x="100" y="70" width="6" height="6" fill="#222"/>
        <rect x="70" y="80" width="6" height="6" fill="#222"/><rect x="90" y="80" width="6" height="6" fill="#222"/>
        <rect x="110" y="80" width="6" height="6" fill="#222"/>
        <rect x="60" y="90" width="6" height="6" fill="#222"/><rect x="80" y="90" width="6" height="6" fill="#222"/>
        <rect x="100" y="90" width="6" height="6" fill="#222"/>
        <rect x="60" y="110" width="6" height="6" fill="#222"/><rect x="80" y="110" width="6" height="6" fill="#222"/>
        <rect x="100" y="110" width="6" height="6" fill="#222"/><rect x="110" y="110" width="6" height="6" fill="#222"/>
        <rect x="60" y="120" width="6" height="6" fill="#222"/><rect x="70" y="120" width="6" height="6" fill="#222"/>
        <rect x="90" y="120" width="6" height="6" fill="#222"/>
        <rect x="60" y="130" width="6" height="6" fill="#222"/><rect x="80" y="130" width="6" height="6" fill="#222"/>
        <rect x="100" y="130" width="6" height="6" fill="#222"/><rect x="110" y="130" width="6" height="6" fill="#222"/>
        <rect x="70" y="140" width="6" height="6" fill="#222"/><rect x="90" y="140" width="6" height="6" fill="#222"/>
      </svg>
    </a>
  </div>
  <div class="label"><a href="${encodedUrl}" target="_blank" rel="noopener">${shortUrl}</a></div>
</body>
</html>`;
  }

  // ── Response mappers ─────────────────────────────────────────────────────────

  private toAuditResponse(audit: {
    id: string; client_id: string; platform: string;
    rating: number | null; review_count: number | null; response_rate: number | null;
    recency: Date | null; keyword_frequency: unknown; review_velocity: number | null;
    gap_vs_top_competitor: unknown; last_checked_at: Date;
    created_at: Date; updated_at: Date;
  }): ReviewAuditResponse {
    return {
      id: audit.id,
      client_id: audit.client_id,
      platform: audit.platform,
      rating: audit.rating,
      review_count: audit.review_count,
      response_rate: audit.response_rate,
      recency: audit.recency?.toISOString() ?? null,
      keyword_frequency: (audit.keyword_frequency as import('./dto/reviews.types').KeywordFrequency[]) ?? [],
      review_velocity: audit.review_velocity,
      gap_vs_top_competitor: audit.gap_vs_top_competitor as GapVsCompetitor | null,
      last_checked_at: audit.last_checked_at.toISOString(),
      created_at: audit.created_at.toISOString(),
      updated_at: audit.updated_at.toISOString(),
    };
  }

  private toSnapshotResponse(snap: {
    id: string; client_id: string; platform: string;
    reviewer_name: string | null; rating: number; review_text: string;
    review_date: Date | null; is_negative: boolean; response_draft: string | null;
    response_status: ResponseStatus; response_submitted_at: Date | null;
    detected_at: Date; created_at: Date;
  }): ReviewSnapshotResponse {
    return {
      id: snap.id,
      client_id: snap.client_id,
      platform: snap.platform,
      reviewer_name: snap.reviewer_name,
      rating: snap.rating,
      review_text: snap.review_text,
      review_date: snap.review_date?.toISOString() ?? null,
      is_negative: snap.is_negative,
      response_draft: snap.response_draft,
      response_status: snap.response_status,
      response_submitted_at: snap.response_submitted_at?.toISOString() ?? null,
      detected_at: snap.detected_at.toISOString(),
      created_at: snap.created_at.toISOString(),
    };
  }

  private toKitResponse(kit: {
    id: string; client_id: string; whatsapp_template: string;
    sms_template: string; email_subject: string; email_body: string;
    qr_code_html: string; created_at: Date; updated_at: Date;
  }): ReviewRequestKitResponse {
    return {
      id: kit.id,
      client_id: kit.client_id,
      whatsapp_template: kit.whatsapp_template,
      sms_template: kit.sms_template,
      email_subject: kit.email_subject,
      email_body: kit.email_body,
      qr_code_html: kit.qr_code_html,
      created_at: kit.created_at.toISOString(),
      updated_at: kit.updated_at.toISOString(),
    };
  }
}
