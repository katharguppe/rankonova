import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { PageExtraction, HeadingStructure, SiteProfile } from './diagnostics.types';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const SKIP_EXT = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|zip|doc|docx|xls|xlsx|css|js|woff|woff2)(\?.*)?$/i;

@Injectable()
export class DiagnosticsCrawlerService {
  private readonly logger = new Logger(DiagnosticsCrawlerService.name);

  // Crawl a single URL — used for competitor cited pages.
  async crawlUrl(url: string): Promise<PageExtraction> {
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const { page, navOk } = await this.openPage(browser, url);
      if (!navOk) return this.emptyExtraction(url, 'navigation failed');
      return await this.extractPage(page, url);
    } catch (err) {
      this.logger.warn(`crawlUrl failed ${url}: ${(err as Error).message}`);
      return this.emptyExtraction(url, (err as Error).message);
    } finally {
      if (browser) await browser.close();
    }
  }

  // Crawl up to maxPages internal pages starting from baseUrl — used for client site.
  async crawlSite(baseUrl: string, maxPages = 10): Promise<PageExtraction[]> {
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const base = new URL(baseUrl);
      const visited = new Set<string>();
      const queue: string[] = [this.normalizeUrl(baseUrl)];
      const results: PageExtraction[] = [];

      while (queue.length > 0 && results.length < maxPages) {
        const url = queue.shift()!;
        if (visited.has(url)) continue;
        visited.add(url);

        try {
          const { page, navOk } = await this.openPage(browser, url);
          const extraction = navOk
            ? await this.extractPage(page, url)
            : this.emptyExtraction(url, 'navigation failed');
          results.push(extraction);

          if (results.length < maxPages) {
            const links = await this.collectInternalLinks(page, base.origin);
            for (const link of links) {
              if (!visited.has(link) && !queue.includes(link)) queue.push(link);
            }
          }

          await page.close();
        } catch (err) {
          this.logger.warn(`Site page failed ${url}: ${(err as Error).message}`);
          results.push(this.emptyExtraction(url, (err as Error).message));
        }
      }

      return results;
    } finally {
      if (browser) await browser.close();
    }
  }

  buildSiteProfile(pages: PageExtraction[]): SiteProfile {
    const successful = pages.filter((p) => !p.error);
    const count = successful.length || 1;

    const avgWordCount = successful.reduce((s, p) => s + p.wordCount, 0) / count;
    const avgEntityDensity = successful.reduce((s, p) => s + p.namedEntityDensity, 0) / count;
    const avgHeadingCount =
      successful.reduce((s, p) => {
        const h = p.headingStructure;
        return s + h.h1 + h.h2 + h.h3 + h.h4 + h.h5 + h.h6;
      }, 0) / count;

    const schemaTypeSet = new Set<string>(successful.flatMap((p) => p.schemaTypes));
    const faqPageCount = successful.filter((p) => p.hasFaqSchema).length;

    const pubDates = successful
      .map((p) => p.publicationDate)
      .filter((d): d is string => d !== null)
      .map((d) => {
        const ms = Date.now() - new Date(d).getTime();
        return Math.floor(ms / 86_400_000);
      })
      .filter((d) => d >= 0 && d < 36500);

    pubDates.sort((a, b) => a - b);
    const medianPublicationDays =
      pubDates.length > 0 ? pubDates[Math.floor(pubDates.length / 2)] : null;

    return {
      pages,
      avgWordCount: Math.round(avgWordCount),
      avgEntityDensity: Math.round(avgEntityDensity * 100) / 100,
      schemaTypeSet,
      faqPageCount,
      avgHeadingCount: Math.round(avgHeadingCount * 10) / 10,
      medianPublicationDays,
    };
  }

  // ── private helpers ──────────────────────────────────────────────────────────

  private async openPage(
    browser: Browser,
    url: string,
  ): Promise<{ page: Page; navOk: boolean }> {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'User-Agent': UA });
    let navOk = false;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      navOk = true;
    } catch {
      // DNS failure / network error — execution context is destroyed, skip evaluation
    }
    return { page, navOk };
  }

  private async extractPage(page: Page, url: string): Promise<PageExtraction> {
    const [schemaBlocks, bodyText, headingStructure, metaDate] = await Promise.all([
      page.$$eval('script[type="application/ld+json"]', (els) =>
        els
          .map((el) => {
            try {
              return JSON.parse(el.textContent ?? '{}') as unknown;
            } catch {
              return null;
            }
          })
          .filter(Boolean),
      ),
      // eslint-disable-next-line no-undef
      page.evaluate(() => (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim()),
       
      page.evaluate(
        (): HeadingStructure => ({
          // eslint-disable-next-line no-undef
          h1: document.querySelectorAll('h1').length,
          // eslint-disable-next-line no-undef
          h2: document.querySelectorAll('h2').length,
          // eslint-disable-next-line no-undef
          h3: document.querySelectorAll('h3').length,
          // eslint-disable-next-line no-undef
          h4: document.querySelectorAll('h4').length,
          // eslint-disable-next-line no-undef
          h5: document.querySelectorAll('h5').length,
          // eslint-disable-next-line no-undef
          h6: document.querySelectorAll('h6').length,
        }),
      ),
       
      page.evaluate((): string | null => {
        const selectors = [
          'meta[property="article:published_time"]',
          'meta[name="publication_date"]',
          'meta[itemprop="datePublished"]',
          'time[itemprop="datePublished"]',
          'time[datetime]',
        ];
        for (const sel of selectors) {
          // eslint-disable-next-line no-undef
          const el = document.querySelector(sel);
          if (el) return el.getAttribute('content') ?? el.getAttribute('datetime') ?? null;
        }
        return null;
      }),
    ]);

    const schemaTypes = this.extractSchemaTypes(schemaBlocks as object[]);
    const hasFaqSchema = schemaTypes.includes('FAQPage');

    const words = bodyText.split(' ').filter((w) => w.length > 0);
    const wordCount = words.length;
    const namedEntityDensity = this.computeEntityDensity(bodyText, wordCount);

    let publicationDate = metaDate ?? null;
    if (!publicationDate) {
      for (const block of schemaBlocks as object[]) {
        const found = this.findStringInObject(block, 'datePublished');
        if (found) { publicationDate = found; break; }
      }
    }

    return {
      url,
      schemaTypes,
      hasFaqSchema,
      wordCount,
      publicationDate,
      headingStructure,
      namedEntityDensity,
      crawledAt: new Date(),
    };
  }

  private extractSchemaTypes(blocks: object[]): string[] {
    const types = new Set<string>();
    const traverse = (val: unknown): void => {
      if (!val || typeof val !== 'object') return;
      if (Array.isArray(val)) { val.forEach(traverse); return; }
      const obj = val as Record<string, unknown>;
      const t = obj['@type'];
      if (typeof t === 'string') types.add(t);
      else if (Array.isArray(t)) t.forEach((v) => typeof v === 'string' && types.add(v));
      Object.values(obj).forEach(traverse);
    };
    blocks.forEach(traverse);
    return [...types];
  }

  // Heuristic: count unique sequences of 2+ Title-Case words.
  private computeEntityDensity(text: string, wordCount: number): number {
    if (wordCount === 0) return 0;
    const matches = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) ?? [];
    const unique = new Set(matches).size;
    return Math.round((unique / wordCount) * 100 * 100) / 100;
  }

  private findStringInObject(obj: unknown, key: string): string | null {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = this.findStringInObject(item, key);
        if (found) return found;
      }
      return null;
    }
    const rec = obj as Record<string, unknown>;
    if (key in rec && typeof rec[key] === 'string') return rec[key] as string;
    for (const val of Object.values(rec)) {
      const found = this.findStringInObject(val, key);
      if (found) return found;
    }
    return null;
  }

  private async collectInternalLinks(page: Page, origin: string): Promise<string[]> {
    const hrefs = await page.$$eval('a[href]', (els) =>
      els.map((el) => (el as HTMLAnchorElement).href),
    );
    const links: string[] = [];
    for (const href of hrefs) {
      try {
        const u = new URL(href);
        if (u.origin !== origin) continue;
        if (SKIP_EXT.test(u.pathname)) continue;
        links.push(this.normalizeUrl(href));
      } catch {
        // invalid URL — skip
      }
    }
    return [...new Set(links)];
  }

  private normalizeUrl(raw: string): string {
    try {
      const u = new URL(raw);
      u.hash = '';
      u.search = '';
      return u.toString().replace(/\/$/, '') || raw;
    } catch {
      return raw;
    }
  }

  private emptyExtraction(url: string, error: string): PageExtraction {
    return {
      url,
      schemaTypes: [],
      hasFaqSchema: false,
      wordCount: 0,
      publicationDate: null,
      headingStructure: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      namedEntityDensity: 0,
      crawledAt: new Date(),
      error,
    };
  }
}
