import { Injectable } from '@nestjs/common';

export interface ResolvedMention {
  is_client_brand: boolean;
  competitor_id: string | null;
}

@Injectable()
export class ExtractionResolverService {
  resolve(
    brand: string,
    client: { id: string; brand_name: string; aliases: unknown },
    competitors: { id: string; name: string; aliases: unknown }[],
  ): ResolvedMention {
    const normalized = brand.toLowerCase().trim();

    if (this.matches(normalized, client.brand_name, client.aliases)) {
      return { is_client_brand: true, competitor_id: null };
    }

    for (const competitor of competitors) {
      if (this.matches(normalized, competitor.name, competitor.aliases)) {
        return { is_client_brand: false, competitor_id: competitor.id };
      }
    }

    return { is_client_brand: false, competitor_id: null };
  }

  private matches(normalized: string, name: string, aliases: unknown): boolean {
    const terms = [name, ...(Array.isArray(aliases) ? aliases : [])];
    return terms.some(t => typeof t === 'string' && t.toLowerCase().trim() === normalized);
  }
}
