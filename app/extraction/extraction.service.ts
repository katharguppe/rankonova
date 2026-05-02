import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExtractionHaikuService } from './extraction-haiku.service';
import { ExtractionResolverService } from './extraction-resolver.service';
import { ExtractionWriterService, MentionToWrite } from './extraction-writer.service';

export interface ExtractionRequestedEvent {
  promptRunId: string;
  clientId: string;
  tenantId: string;
}

const WARN_THRESHOLD_MS = 3_000;

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly haiku: ExtractionHaikuService,
    private readonly resolver: ExtractionResolverService,
    private readonly writer: ExtractionWriterService,
  ) {}

  async runForPromptRun(promptRunId: string): Promise<number> {
    const row = await this.prisma.promptRun.findUnique({
      where: { id: promptRunId },
      select: { client_id: true },
    });
    if (!row) return 0;
    const clientId = row.client_id;
    const clientRow = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { tenant_id: true },
    });
    const tenantId = clientRow?.tenant_id ?? '';
    await this.handleExtractionRequested({ promptRunId, clientId, tenantId });
    return this.prisma.brandMention.count({ where: { run_id: promptRunId } });
  }

  async handleExtractionRequested(event: ExtractionRequestedEvent): Promise<void> {
    const { promptRunId, clientId, tenantId } = event;
    const start = Date.now();

    const run = await this.prisma.promptRun.findUnique({
      where: { id: promptRunId },
      select: { id: true, raw_response: true, client_id: true },
    });

    if (!run?.raw_response) return;

    // Idempotency: skip if already extracted
    const existing = await this.prisma.brandMention.count({ where: { run_id: promptRunId } });
    if (existing > 0) return;

    const [client, competitors] = await Promise.all([
      this.prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, brand_name: true, aliases: true },
      }),
      this.prisma.competitor.findMany({
        where: { tenant_id: tenantId, is_active: true },
        select: { id: true, name: true, aliases: true },
      }),
    ]);

    if (!client) {
      this.logger.warn(`extraction.requested: client ${clientId} not found`);
      return;
    }

    const rawMentions = await this.haiku.extract(run.raw_response);
    if (rawMentions.length === 0) return;

    const toWrite: MentionToWrite[] = rawMentions.map(m => {
      const resolved = this.resolver.resolve(m.brand, client, competitors);
      return {
        run_id: promptRunId,
        client_id: clientId,
        brand_name: m.brand,
        position: m.position,
        sentiment: m.sentiment,
        cited_url: m.cited_url,
        context_snippet: m.context_snippet,
        is_client_brand: resolved.is_client_brand,
        competitor_id: resolved.competitor_id,
      };
    });

    await this.writer.upsertMany(toWrite);

    const elapsed = Date.now() - start;
    if (elapsed > WARN_THRESHOLD_MS) {
      this.logger.warn(`extraction for run ${promptRunId} took ${elapsed}ms (threshold ${WARN_THRESHOLD_MS}ms)`);
    } else {
      this.logger.log(`extracted ${toWrite.length} mention(s) for run ${promptRunId} in ${elapsed}ms`);
    }
  }
}
