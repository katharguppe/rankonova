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

    // Try exact matches first
    if (this.exactMatch(normalized, client.brand_name, client.aliases)) {
      return { is_client_brand: true, competitor_id: null };
    }
    let exactComp = this.findExactMatch(normalized, competitors);
    if (exactComp) return { is_client_brand: false, competitor_id: exactComp };

    // Try substring matches second
    if (this.substringMatch(normalized, client.brand_name, client.aliases)) {
      return { is_client_brand: true, competitor_id: null };
    }
    let substringComp = this.findSubstringMatch(normalized, competitors);
    if (substringComp) return { is_client_brand: false, competitor_id: substringComp };

    // Try partial matches third
    if (this.partialMatch(normalized, client.brand_name, client.aliases)) {
      return { is_client_brand: true, competitor_id: null };
    }
    let partialComp = this.findPartialMatch(normalized, competitors);
    if (partialComp) return { is_client_brand: false, competitor_id: partialComp };

    return { is_client_brand: false, competitor_id: null };
  }

  private getTerms(name: string, aliases: unknown): string[] {
    const terms = [name, ...(Array.isArray(aliases) ? aliases : [])];
    return terms.filter(t => typeof t === 'string').map(t => (t as string).toLowerCase().trim());
  }

  private exactMatch(normalized: string, name: string, aliases: unknown): boolean {
    const terms = this.getTerms(name, aliases);
    return terms.some(t => t === normalized);
  }

  private substringMatch(normalized: string, name: string, aliases: unknown): boolean {
    const terms = this.getTerms(name, aliases);
    return terms.some(t => t.includes(normalized) || normalized.includes(t));
  }

  private partialMatch(normalized: string, name: string, aliases: unknown): boolean {
    const terms = this.getTerms(name, aliases);
    return terms.some(t => this.isPartialMatch(normalized, t));
  }

  private findExactMatch(
    normalized: string,
    competitors: { id: string; name: string; aliases: unknown }[],
  ): string | null {
    for (const comp of competitors) {
      if (this.exactMatch(normalized, comp.name, comp.aliases)) {
        return comp.id;
      }
    }
    return null;
  }

  private findSubstringMatch(
    normalized: string,
    competitors: { id: string; name: string; aliases: unknown }[],
  ): string | null {
    for (const comp of competitors) {
      if (this.substringMatch(normalized, comp.name, comp.aliases)) {
        return comp.id;
      }
    }
    return null;
  }

  private findPartialMatch(
    normalized: string,
    competitors: { id: string; name: string; aliases: unknown }[],
  ): string | null {
    for (const comp of competitors) {
      if (this.partialMatch(normalized, comp.name, comp.aliases)) {
        return comp.id;
      }
    }
    return null;
  }

  private isPartialMatch(normalized: string, term: string): boolean {
    const minLength = Math.min(normalized.length, term.length);
    if (minLength < 3) return false;
    return normalized.substring(0, minLength) === term.substring(0, minLength);
  }
}
