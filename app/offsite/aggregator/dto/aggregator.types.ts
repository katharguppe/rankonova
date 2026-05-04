// Parsed shape of one aggregator_platforms entry from Vertical config
export interface AggregatorPlatformConfig {
  name: string;
  url_pattern: string;
  css_selectors: Record<string, string>; // field -> CSS selector (may be empty)
  crawl_frequency: string;
}

// The 12 standard profile fields we score against
export const EXPECTED_FIELDS = [
  'name',
  'address',
  'phone',
  'rating',
  'review_count',
  'description',
  'photos',
  'hours',
  'website',
  'category',
  'certifications',
  'response_rate',
] as const;

export type ProfileField = (typeof EXPECTED_FIELDS)[number];

// Raw extraction result for a single profile
export type RawExtract = Record<ProfileField, string | null>;

// Per-competitor score entry stored in competitor_scores JSON
export interface CompetitorScore {
  competitor_id: string;
  name: string;
  score: number;
  url: string;
}

// One entry in the update_pack JSON
export interface UpdatePackEntry {
  field: ProfileField;
  suggestion: string;
}

// Response shape for the REST endpoints
export interface AggregatorSnapshotResponse {
  id: string;
  client_id: string;
  platform: string;
  profile_url: string;
  completeness_score: number;
  fields_present: string[];
  fields_missing: string[];
  competitor_scores: CompetitorScore[];
  content_hash: string;
  update_pack: UpdatePackEntry[];
  crawled_at: string;
  created_at: string;
}
