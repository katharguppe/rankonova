import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationSeverity } from '@prisma/client';
import { chromium } from 'playwright';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EntityCheckResponse,
  GkpSnapshot,
  WikidataSubmissionDraft,
} from './dto/knowledge-graph.types';

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const NOTABLE_INLINKS_THRESHOLD = 5;

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Scheduled job (1st of month, 05:00) ─────────────────────────────────────

  @Cron('0 5 1 * *')
  async runScheduled(): Promise<void> {
    const clients = await this.prisma.client.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, brand_name: true },
    });
    this.logger.log(`Entity check monthly run: ${clients.length} active client(s)`);
    for (const c of clients) {
      await this.runForClient(c.id).catch((err: Error) =>
        this.logger.error(`Entity check failed for ${c.id} (${c.brand_name}): ${err.message}`),
      );
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async runForClient(clientId: string): Promise<EntityCheckResponse> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, is_active: true, deleted_at: null },
      include: { vertical: { select: { name: true, wikidata_entity_type: true } } },
    });
    if (!client) throw new NotFoundException(`Client ${clientId} not found or inactive`);

    const entityType = client.vertical.wikidata_entity_type ?? 'Q4830453'; // default: business

    const [wikidataResult, gkpResult, wikipediaResult] = await Promise.allSettled([
      this.checkWikidata(client.brand_name, client.city, entityType),
      this.checkGoogleKnowledgePanel(client.brand_name, client.city),
      this.checkWikipedia(client.brand_name),
    ]);

    const wikidata = wikidataResult.status === 'fulfilled'
      ? wikidataResult.value
      : { found: false, qid: null };

    const gkp = gkpResult.status === 'fulfilled'
      ? gkpResult.value
      : { detected: false, snapshot: null };

    const wikipedia = wikipediaResult.status === 'fulfilled'
      ? wikipediaResult.value
      : { notable: false, url: null, flag: 'not_notable' as const };

    if (wikidataResult.status === 'rejected')
      this.logger.warn(`Wikidata check failed for ${clientId}: ${(wikidataResult.reason as Error).message}`);
    if (gkpResult.status === 'rejected')
      this.logger.warn(`GKP check failed for ${clientId}: ${(gkpResult.reason as Error).message}`);
    if (wikipediaResult.status === 'rejected')
      this.logger.warn(`Wikipedia check failed for ${clientId}: ${(wikipediaResult.reason as Error).message}`);

    const submissionDraft = !wikidata.found
      ? this.buildWikidataSubmissionDraft(client, entityType)
      : null;

    const previous = await this.prisma.entityCheck.findFirst({
      where: { client_id: clientId },
      orderBy: { checked_at: 'desc' },
    });

    const statusChanged = previous
      ? (previous.wikidata_found !== wikidata.found ||
         previous.gkp_detected !== gkp.detected ||
         previous.wikipedia_notable !== wikipedia.notable)
      : false;

    return this.persistCheck(clientId, client, {
      wikidata,
      gkp,
      wikipedia,
      submissionDraft,
      statusChanged,
      previousCheckId: previous?.id ?? null,
    });
  }

  async getLatestCheck(clientId: string): Promise<EntityCheckResponse | null> {
    const check = await this.prisma.entityCheck.findFirst({
      where: { client_id: clientId },
      orderBy: { checked_at: 'desc' },
    });
    return check ? this.toResponse(check) : null;
  }

  async getCheckHistory(clientId: string): Promise<EntityCheckResponse[]> {
    const checks = await this.prisma.entityCheck.findMany({
      where: { client_id: clientId },
      orderBy: { checked_at: 'desc' },
      take: 12,
    });
    return checks.map((c) => this.toResponse(c));
  }

  // ── Wikidata SPARQL check ────────────────────────────────────────────────────

  private async checkWikidata(
    brandName: string,
    city: string,
    entityType: string,
  ): Promise<{ found: boolean; qid: string | null }> {
    const label = `${brandName} ${city}`.trim();

    // Search by label match + instance-of entity type
    const sparql = `
      SELECT ?item WHERE {
        ?item wdt:P31 wd:${entityType} .
        ?item rdfs:label ?label .
        FILTER(LCASE(STR(?label)) = LCASE("${label.replace(/"/g, '\\"')}"))
      }
      LIMIT 1
    `;

    const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'AEO-Suite/1.0 entity-monitor (contact: admin@aeo-suite.com)',
      },
    });

    if (!res.ok) throw new Error(`Wikidata SPARQL returned ${res.status}`);

    const json = await res.json() as {
      results?: { bindings?: Array<{ item?: { value?: string } }> };
    };

    const bindings = json.results?.bindings ?? [];
    if (bindings.length === 0) {
      // Fallback: try without city suffix (brand name only)
      return this.checkWikidataByBrandOnly(brandName, entityType);
    }

    const qid = bindings[0]?.item?.value?.split('/').pop() ?? null;
    this.logger.log(`Wikidata: found ${qid} for "${label}"`);
    return { found: true, qid };
  }

  private async checkWikidataByBrandOnly(
    brandName: string,
    entityType: string,
  ): Promise<{ found: boolean; qid: string | null }> {
    const sparql = `
      SELECT ?item WHERE {
        ?item wdt:P31 wd:${entityType} .
        ?item rdfs:label ?label .
        FILTER(LCASE(STR(?label)) = LCASE("${brandName.replace(/"/g, '\\"')}"))
      }
      LIMIT 1
    `;

    const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'AEO-Suite/1.0 entity-monitor (contact: admin@aeo-suite.com)',
      },
    });

    if (!res.ok) return { found: false, qid: null };

    const json = await res.json() as {
      results?: { bindings?: Array<{ item?: { value?: string } }> };
    };

    const bindings = json.results?.bindings ?? [];
    if (bindings.length === 0) return { found: false, qid: null };

    const qid = bindings[0]?.item?.value?.split('/').pop() ?? null;
    return { found: true, qid };
  }

  // ── Wikidata submission draft ─────────────────────────────────────────────────

  private buildWikidataSubmissionDraft(
    client: { brand_name: string; city: string; state: string; website_url: string },
    entityType: string,
  ): WikidataSubmissionDraft {
    return {
      label: `${client.brand_name} ${client.city}`,
      description: `${client.brand_name} located in ${client.city}, ${client.state}`,
      aliases: [client.brand_name],
      claims: {
        P31: entityType,     // instance of
        P17: 'Q668',         // country: India
        P131: client.city,   // located in administrative territory
        P856: client.website_url,
      },
    };
  }

  // ── Google Knowledge Panel (Playwright) ─────────────────────────────────────

  private async checkGoogleKnowledgePanel(
    brandName: string,
    city: string,
  ): Promise<{ detected: boolean; snapshot: GkpSnapshot | null }> {
    const query = `"${brandName}" ${city}`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        locale: 'en-US',
      });
      const page = await context.newPage();
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await page.waitForTimeout(2000);

      // Knowledge panel: title via data-attrid="title", description via data-attrid="description"
      const title = await page
        .locator('[data-attrid="title"]')
        .first()
        .textContent({ timeout: 3000 })
        .catch(() => null);

      if (!title) {
        return { detected: false, snapshot: null };
      }

      const description = await page
        .locator('[data-attrid="description"] span')
        .first()
        .textContent({ timeout: 2000 })
        .catch(() => null);

      const imageUrl = await page
        .locator('g-img img')
        .first()
        .getAttribute('src', { timeout: 2000 })
        .catch(() => null);

      const sourceUrl = await page
        .locator('a[data-attrid="title"]')
        .first()
        .getAttribute('href', { timeout: 2000 })
        .catch(() => null);

      this.logger.log(`GKP detected for "${brandName}": "${title}"`);
      return {
        detected: true,
        snapshot: {
          title: title.trim(),
          description: description?.trim() ?? '',
          image_url: imageUrl,
          source_url: sourceUrl,
        },
      };
    } finally {
      await browser.close();
    }
  }

  // ── Wikipedia notability check ───────────────────────────────────────────────

  private async checkWikipedia(brandName: string): Promise<{
    notable: boolean;
    url: string | null;
    flag: 'threshold_met' | 'borderline' | 'not_notable';
  }> {
    // Step 1: check if page exists
    const searchUrl =
      `${WIKIPEDIA_API}?action=query&titles=${encodeURIComponent(brandName)}` +
      `&prop=info&inprop=url&format=json&origin=*`;

    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'AEO-Suite/1.0 entity-monitor (contact: admin@aeo-suite.com)' },
    });
    if (!searchRes.ok) throw new Error(`Wikipedia API returned ${searchRes.status}`);

    const searchJson = await searchRes.json() as {
      query?: { pages?: Record<string, { missing?: string; fullurl?: string }> };
    };

    const pages = Object.values(searchJson.query?.pages ?? {});
    const page = pages[0];

    if (!page || 'missing' in page) {
      return { notable: false, url: null, flag: 'not_notable' };
    }

    const pageUrl = page.fullurl ?? null;

    // Step 2: count inlinks as notability proxy
    const inlinksUrl =
      `${WIKIPEDIA_API}?action=query&titles=${encodeURIComponent(brandName)}` +
      `&prop=linkshere&lhlimit=6&lhnamespace=0&format=json&origin=*`;

    const inlinksRes = await fetch(inlinksUrl, {
      headers: { 'User-Agent': 'AEO-Suite/1.0 entity-monitor (contact: admin@aeo-suite.com)' },
    });

    let inlinkCount = 0;
    if (inlinksRes.ok) {
      const inlinksJson = await inlinksRes.json() as {
        query?: { pages?: Record<string, { linkshere?: unknown[] }> };
      };
      const inlinkPages = Object.values(inlinksJson.query?.pages ?? {});
      inlinkCount = inlinkPages[0]?.linkshere?.length ?? 0;
    }

    if (inlinkCount > NOTABLE_INLINKS_THRESHOLD) {
      this.logger.log(`Wikipedia: "${brandName}" notable — ${inlinkCount} inlinks`);
      return { notable: true, url: pageUrl, flag: 'threshold_met' };
    }

    if (inlinkCount >= 1) {
      return { notable: false, url: pageUrl, flag: 'borderline' };
    }

    return { notable: false, url: pageUrl, flag: 'not_notable' };
  }

  // ── Persist + notify ─────────────────────────────────────────────────────────

  private async persistCheck(
    clientId: string,
    client: { brand_name: string; tenant_id: string },
    results: {
      wikidata: { found: boolean; qid: string | null };
      gkp: { detected: boolean; snapshot: GkpSnapshot | null };
      wikipedia: { notable: boolean; url: string | null; flag: string };
      submissionDraft: WikidataSubmissionDraft | null;
      statusChanged: boolean;
      previousCheckId: string | null;
    },
  ): Promise<EntityCheckResponse> {
    const saved = await this.prisma.entityCheck.create({
      data: {
        client_id: clientId,
        wikidata_found: results.wikidata.found,
        wikidata_qid: results.wikidata.qid,
        wikidata_submission_draft: results.submissionDraft as unknown as import('@prisma/client').Prisma.InputJsonValue ?? undefined,
        gkp_detected: results.gkp.detected,
        gkp_snapshot: results.gkp.snapshot as unknown as import('@prisma/client').Prisma.InputJsonValue ?? undefined,
        wikipedia_notable: results.wikipedia.notable,
        wikipedia_url: results.wikipedia.url,
        wikipedia_flag: results.wikipedia.flag,
        status_changed: results.statusChanged,
        previous_check_id: results.previousCheckId,
      },
    });

    if (results.statusChanged) {
      const changes: string[] = [];
      if (results.wikidata.found) changes.push('Wikidata entity found');
      if (results.gkp.detected) changes.push('Google Knowledge Panel detected');
      if (results.wikipedia.notable) changes.push('Wikipedia notability threshold met');

      await this.prisma.notification.create({
        data: {
          tenant_id: client.tenant_id,
          client_id: clientId,
          type: 'entity_status_change',
          severity: changes.length > 0
            ? NotificationSeverity.medium
            : NotificationSeverity.low,
          title: `Entity status change for ${client.brand_name}`,
          body: changes.length > 0
            ? `New signals: ${changes.join(', ')}.`
            : `Entity signals lost for ${client.brand_name} — review recommended.`,
          deep_link: `/offsite/knowledge-graph/${clientId}/latest`,
        },
      }).catch((err: Error) =>
        this.logger.warn(`Notification failed: ${err.message}`),
      );
    }

    this.logger.log(
      `Entity check saved for ${clientId}: wikidata=${results.wikidata.found} ` +
        `gkp=${results.gkp.detected} wikipedia=${results.wikipedia.notable} ` +
        `changed=${results.statusChanged}`,
    );

    return this.toResponse(saved);
  }

  // ── Response mapper ──────────────────────────────────────────────────────────

  private toResponse(check: {
    id: string; client_id: string;
    wikidata_found: boolean; wikidata_qid: string | null;
    wikidata_submission_draft: unknown;
    gkp_detected: boolean; gkp_snapshot: unknown;
    wikipedia_notable: boolean; wikipedia_url: string | null;
    wikipedia_flag: string | null;
    status_changed: boolean; previous_check_id: string | null;
    checked_at: Date; created_at: Date;
  }): EntityCheckResponse {
    return {
      id: check.id,
      client_id: check.client_id,
      wikidata_found: check.wikidata_found,
      wikidata_qid: check.wikidata_qid,
      wikidata_submission_draft: (check.wikidata_submission_draft as WikidataSubmissionDraft) ?? null,
      gkp_detected: check.gkp_detected,
      gkp_snapshot: (check.gkp_snapshot as GkpSnapshot) ?? null,
      wikipedia_notable: check.wikipedia_notable,
      wikipedia_url: check.wikipedia_url,
      wikipedia_flag: (check.wikipedia_flag as EntityCheckResponse['wikipedia_flag']) ?? null,
      status_changed: check.status_changed,
      previous_check_id: check.previous_check_id,
      checked_at: check.checked_at.toISOString(),
      created_at: check.created_at.toISOString(),
    };
  }
}
