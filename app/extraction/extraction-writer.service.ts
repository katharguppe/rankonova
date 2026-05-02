import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Sentiment } from '@prisma/client';

export interface MentionToWrite {
  run_id: string;
  client_id: string;
  brand_name: string;
  position: number;
  sentiment: Sentiment;
  cited_url: string | null;
  context_snippet: string | null;
  is_client_brand: boolean;
  competitor_id: string | null;
}

@Injectable()
export class ExtractionWriterService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMany(mentions: MentionToWrite[]): Promise<void> {
    await Promise.all(
      mentions.map(m =>
        this.prisma.brandMention.upsert({
          where: { run_id_brand_name: { run_id: m.run_id, brand_name: m.brand_name } },
          create: m,
          update: {
            position: m.position,
            sentiment: m.sentiment,
            cited_url: m.cited_url,
            context_snippet: m.context_snippet,
            is_client_brand: m.is_client_brand,
            competitor_id: m.competitor_id,
          },
        }),
      ),
    );
  }
}
