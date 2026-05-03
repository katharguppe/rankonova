export interface HeadingStructure {
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
}

export interface PageExtraction {
  url: string;
  schemaTypes: string[];
  hasFaqSchema: boolean;
  wordCount: number;
  publicationDate: string | null;
  headingStructure: HeadingStructure;
  namedEntityDensity: number; // unique named entities per 100 words
  crawledAt: Date;
  error?: string;
}

// on_site_gaps shape stored in GapReport.on_site_gaps
export interface OnSiteGaps {
  missingSchemaTypes: string[];   // schema types competitor has, client lacks
  faqCoverageScore: number;       // 0-100: percentage of crawled pages with FAQ schema
  freshnessGap: number;           // days: median age of client pages vs competitor
  entityDensityGap: number;       // competitor avg entity density minus client avg
  internalLinkGap: number;        // competitor avg heading count minus client avg
}

// off_site_gaps shape stored in GapReport.off_site_gaps
export interface OffSiteGaps {
  aggregatorPresence: string;     // 'low' | 'medium' | 'high'
  reviewVolumeGap: number;        // placeholder: 0 until Phase 8
  communityPresence: string;      // placeholder: 'unknown' until Phase 8
  entityRecognition: string;      // placeholder: 'unknown' until Phase 8
  prCoverage: string;             // placeholder: 'unknown' until Phase 8
}

export interface RecommendedAction {
  action: string;
  estimatedImpact: 'high' | 'medium' | 'low';
  priority: number; // 1 = highest
}

export interface SiteProfile {
  pages: PageExtraction[];
  avgWordCount: number;
  avgEntityDensity: number;
  schemaTypeSet: Set<string>;
  faqPageCount: number;
  avgHeadingCount: number;
  medianPublicationDays: number | null; // days since published, null if unknown
}
