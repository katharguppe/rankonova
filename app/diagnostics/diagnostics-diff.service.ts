import { Injectable } from '@nestjs/common';
import {
  OnSiteGaps,
  OffSiteGaps,
  RecommendedAction,
  SiteProfile,
} from './diagnostics.types';

// Schema types that most directly drive AI citation — missing any of these is high-impact.
const HIGH_IMPACT_SCHEMA = new Set([
  'FAQPage',
  'LocalBusiness',
  'Organization',
  'Product',
  'Article',
  'NewsArticle',
  'HowTo',
  'BreadcrumbList',
  'WebSite',
]);

export interface DiffResult {
  onSiteGaps: OnSiteGaps;
  offSiteGaps: OffSiteGaps;
  recommendedActions: RecommendedAction[];
}

@Injectable()
export class DiagnosticsDiffService {
  computeGaps(clientProfile: SiteProfile, competitorProfile: SiteProfile): DiffResult {
    const onSiteGaps = this.computeOnSiteGaps(clientProfile, competitorProfile);
    const offSiteGaps = this.buildOffSiteGapsPlaceholder();
    const recommendedActions = this.rankActions(onSiteGaps, clientProfile, competitorProfile);
    return { onSiteGaps, offSiteGaps, recommendedActions };
  }

  // ── on-site ────────────────────────────────────────────────────────────────

  private computeOnSiteGaps(client: SiteProfile, competitor: SiteProfile): OnSiteGaps {
    const missingSchemaTypes = [...competitor.schemaTypeSet].filter(
      (t) => !client.schemaTypeSet.has(t),
    );

    const clientPageCount = client.pages.filter((p) => !p.error).length;
    const faqCoverageScore =
      clientPageCount > 0 ? Math.round((client.faqPageCount / clientPageCount) * 100) : 0;

    // Positive = client pages are older (staler) than competitor
    const clientAge = client.medianPublicationDays ?? 0;
    const competitorAge = competitor.medianPublicationDays ?? 0;
    const freshnessGap = clientAge - competitorAge;

    const entityDensityGap =
      Math.round((competitor.avgEntityDensity - client.avgEntityDensity) * 100) / 100;

    const internalLinkGap =
      Math.round((competitor.avgHeadingCount - client.avgHeadingCount) * 10) / 10;

    return {
      missingSchemaTypes,
      faqCoverageScore,
      freshnessGap,
      entityDensityGap,
      internalLinkGap,
    };
  }

  // ── off-site (placeholder — Phases 8-11 populate these) ───────────────────

  private buildOffSiteGapsPlaceholder(): OffSiteGaps {
    return {
      aggregatorPresence: 'unknown',
      reviewVolumeGap: 0,
      communityPresence: 'unknown',
      entityRecognition: 'unknown',
      prCoverage: 'unknown',
    };
  }

  // ── recommended actions ranker ─────────────────────────────────────────────

  private rankActions(
    gaps: OnSiteGaps,
    client: SiteProfile,
    competitor: SiteProfile,
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    // 1. Missing FAQ schema — single highest-ROI fix for AI citation
    const competitorHasFaq = competitor.faqPageCount > 0;
    const clientHasFaq = client.faqPageCount > 0;
    if (competitorHasFaq && !clientHasFaq) {
      actions.push({
        action:
          'Add FAQPage schema markup to your most-visited pages. ' +
          'AI engines extract FAQ content directly and cite structured answers.',
        estimatedImpact: 'high',
        priority: 1,
      });
    }

    // 2. Missing high-impact schema types (exclude FAQPage if already covered by P1)
    const faqAlreadyCovered = competitorHasFaq && !clientHasFaq;
    const missingHigh = gaps.missingSchemaTypes.filter(
      (t) => HIGH_IMPACT_SCHEMA.has(t) && !(faqAlreadyCovered && t === 'FAQPage'),
    );
    if (missingHigh.length > 0) {
      actions.push({
        action:
          `Implement missing schema types: ${missingHigh.join(', ')}. ` +
          'These schema types are present on competitor pages and directly influence AI citation selection.',
        estimatedImpact: 'high',
        priority: 2,
      });
    }

    // 3. Content freshness — AI engines favour recently updated content
    if (gaps.freshnessGap > 180) {
      const months = Math.round(gaps.freshnessGap / 30);
      actions.push({
        action:
          `Refresh content: your pages are a median ${months} months older than competitor pages. ` +
          'Update publication dates with substantive content edits and add dateModified JSON-LD.',
        estimatedImpact: gaps.freshnessGap > 365 ? 'high' : 'medium',
        priority: 3,
      });
    }

    // 4. Entity density — indicates topical authority
    if (gaps.entityDensityGap > 0.5) {
      actions.push({
        action:
          `Increase named entity density (gap: ${gaps.entityDensityGap} entities/100 words vs competitor). ` +
          'Reference specific models, prices, locations, and named people to build topical authority signals.',
        estimatedImpact: 'medium',
        priority: 4,
      });
    }

    // 5. Word count depth
    if (competitor.avgWordCount > 0 && client.avgWordCount < competitor.avgWordCount * 0.75) {
      const delta = competitor.avgWordCount - client.avgWordCount;
      actions.push({
        action:
          `Expand content depth: competitor pages average ${competitor.avgWordCount} words vs your ${client.avgWordCount} (gap: ${delta} words). ` +
          'Longer, comprehensive pages are cited more often in comparison and advisory queries.',
        estimatedImpact: 'medium',
        priority: 5,
      });
    }

    // 6. Heading structure
    if (gaps.internalLinkGap > 2) {
      actions.push({
        action:
          `Improve heading structure: competitor pages use ${gaps.internalLinkGap.toFixed(1)} more headings on average. ` +
          'AI engines parse heading hierarchies to extract direct answers — more structured content is cited more precisely.',
        estimatedImpact: 'low',
        priority: 6,
      });
    }

    // 7. Any remaining missing schema (non-high-impact)
    const missingOther = gaps.missingSchemaTypes.filter((t) => !HIGH_IMPACT_SCHEMA.has(t));
    if (missingOther.length > 0) {
      actions.push({
        action:
          `Add secondary schema types found on competitor pages: ${missingOther.join(', ')}.`,
        estimatedImpact: 'low',
        priority: 7,
      });
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }
}
