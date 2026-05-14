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

    // Try fuzzy matches fourth (conservative fallback only)
    if (this.fuzzyMatch(normalized, client.brand_name, client.aliases)) {
      return { is_client_brand: true, competitor_id: null };
    }
    let fuzzyComp = this.findFuzzyMatch(normalized, competitors);
    if (fuzzyComp) return { is_client_brand: false, competitor_id: fuzzyComp };

    return { is_client_brand: false, competitor_id: null };
  }

  private getTerms(name: string, aliases: unknown): string[] {
    const terms = [name, ...(Array.isArray(aliases) ? aliases : [])];
    const normalized = terms.filter(t => typeof t === 'string').map(t => (t as string).toLowerCase().trim());

    // For fuzzy matching, also include individual words from multi-word names
    const withWords: string[] = [...normalized];
    for (const term of normalized) {
      const words = term.split(/\s+/).filter(w => w.length > 0);
      if (words.length > 1) {
        withWords.push(...words);
      }
    }

    return withWords;
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

  /**
   * Calculate Levenshtein distance between two strings.
   * Used for fuzzy matching as conservative fallback (only when distance <= threshold).
   * @param a First string (normalized)
   * @param b Second string (normalized)
   * @returns Edit distance (0 = identical, higher = more different)
   * @example
   * levenshteinDistance("Apollo", "Apolo") // 1 (transposition)
   * levenshteinDistance("Car", "CarDekho") // 6 (insertions)
   */
  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    // Base cases: if one string is empty, distance = other's length
    if (m === 0) return n;
    if (n === 0) return m;

    // Create DP table: dp[i][j] = distance between a[0..i-1] and b[0..j-1]
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    // Initialize base cases
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill DP table
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          // Characters match, no operation needed
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          // Take minimum of three operations: insert, delete, substitute
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Fuzzy match using Levenshtein distance with conservative threshold.
   * Only matches if distance is VERY small relative to term length (20% max).
   * Prevents false positives (e.g., "Car" shouldn't match "Bus").
   * @param normalized Search term (already normalized)
   * @param name Competitor name
   * @param aliases Competitor aliases
   * @returns true if fuzzy match found
   */
  private fuzzyMatch(normalized: string, name: string, aliases: unknown): boolean {
    const terms = this.getTerms(name, aliases);

    // Conservative threshold: distance must be <= 20% of the longer string
    const FUZZY_THRESHOLD_PERCENT = 0.2;

    for (const term of terms) {
      const distance = this.levenshteinDistance(normalized, term);
      const maxAllowed = Math.ceil(Math.max(normalized.length, term.length) * FUZZY_THRESHOLD_PERCENT);

      // Require minimum length to prevent "a" matching "cat"
      if (normalized.length >= 3 && term.length >= 3 && distance <= maxAllowed) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find first competitor matching via fuzzy match (Levenshtein distance).
   * Conservative fallback only — used when exact/substring/partial all fail.
   */
  private findFuzzyMatch(
    normalized: string,
    competitors: { id: string; name: string; aliases: unknown }[],
  ): string | null {
    for (const comp of competitors) {
      if (this.fuzzyMatch(normalized, comp.name, comp.aliases)) {
        return comp.id;
      }
    }
    return null;
  }
}
