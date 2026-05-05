export interface CitationOverview {
  windows: { '7d': number; '30d': number; '90d': number };
  byEngine: Record<string, number>;
  byIntent: Record<string, number>;
}

export interface SovEntry {
  brand_name: string;
  is_client: boolean;
  citation_rate: number;
}

export interface SentimentAnalysis {
  overall: { positive: number; negative: number; neutral: number; mixed: number };
  trend: Array<{ date: string; positive: number; negative: number; neutral: number; mixed: number }>;
  snippets: Array<{ text: string; sentiment: string; brand_name: string }>;
}

export interface PromptAnalysis {
  prompt_id: string;
  text: string;
  intent_type: string;
  citation_rate: number;
  run_count: number;
}

export interface EngineBreakdown {
  engine: string;
  citation_rate: number;
  run_count: number;
  cited_runs: number;
}

export interface CitationSource {
  url: string;
  domain: string;
  mention_count: number;
}

export interface GeoBreakdown {
  city: string;
  state: string;
  citation_rate: number;
}

export type ContentType =
  | 'faq_page'
  | 'comparison_page'
  | 'entity_authority_page'
  | 'segment_article';

export type ContentStatus =
  | 'draft'
  | 'approved'
  | 'revision_requested'
  | 'published';

export interface ContentListItem {
  id: string;
  type: ContentType;
  title: string;
  status: ContentStatus;
  html_content: string;
  review_notes: string | null;
  previous_version_id: string | null;
  citation_rate_before: number | null;
  citation_rate_after: number | null;
  approved_at: string | null;
  published_at: string | null;
  follow_up_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentOutput extends ContentListItem {
  client_id: string;
  target_prompt_id: string | null;
  schema_json: object;
  generation_prompt: string;
  approved_by: string | null;
}

// ── Offsite — Aggregator ─────────────────────────────────────────────────────

export interface AggregatorUpdatePackItem { field: string; suggestion: string; }
export interface AggregatorCompetitorScore { competitor_id: string; name: string; score: number; url: string; }
export interface AggregatorSnapshot {
  id: string; client_id: string; platform: string; profile_url: string;
  completeness_score: number; fields_present: string[]; fields_missing: string[];
  competitor_scores: AggregatorCompetitorScore[]; content_hash: string;
  raw_extract: Record<string, string | null>; update_pack: AggregatorUpdatePackItem[];
  crawled_at: string; created_at: string;
}

// ── Offsite — Reviews ────────────────────────────────────────────────────────

export interface ReviewAudit {
  id: string; client_id: string; platform: string; profile_url: string;
  review_count: number; average_rating: number; review_velocity: number | null;
  keyword_frequency: Record<string, number> | null; negative_count: number;
  crawled_at: string; updated_at: string;
}

// ── Offsite — Community ──────────────────────────────────────────────────────

export type CommunityResponseStatus = 'pending' | 'posted' | 'skipped';
export interface CommunityThread {
  id: string; client_id: string; platform: string; url: string;
  thread_title: string; question_text: string | null; thread_score: number;
  is_client_mentioned: boolean; is_competitor_recommended: boolean;
  competitor_names_mentioned: string[]; ai_citation_count: number;
  response_draft: string | null; response_status: CommunityResponseStatus;
  detected_at: string; responded_at: string | null; created_at: string; updated_at: string;
}

// ── Offsite — Knowledge Graph ────────────────────────────────────────────────

export interface WikidataSubmissionDraft {
  label: string; description: string; aliases: string[];
  claims: { P31: string; P17: string; P131: string; P856: string; };
}
export interface GkpSnapshot {
  title: string; description: string; image_url: string | null; source_url: string | null;
}
export interface EntityCheck {
  id: string; client_id: string;
  wikidata_found: boolean; wikidata_qid: string | null;
  wikidata_submission_draft: WikidataSubmissionDraft | null;
  gkp_detected: boolean; gkp_snapshot: GkpSnapshot | null;
  wikipedia_notable: boolean; wikipedia_url: string | null;
  wikipedia_flag: 'threshold_met' | 'borderline' | 'not_notable' | null;
  status_changed: boolean; previous_check_id: string | null;
  checked_at: string; created_at: string;
}

// ── Offsite — PR ─────────────────────────────────────────────────────────────

export type PrSignalStatus = 'draft' | 'approved' | 'distributed' | 'archived';
export interface DistributionContact {
  outlet: string; journalist: string; contact: string; wire_service: boolean;
}
export interface PrPickup {
  id: string; pr_signal_id: string; domain: string; indexed_url: string | null;
  is_ai_trusted: boolean; detected_at: string;
}
export interface PrSignal {
  id: string; client_id: string; news_title: string; news_url: string;
  news_source: string; published_at: string | null; relevance_score: number;
  pr_angle: string; press_release_draft: string;
  distribution_checklist: DistributionContact[];
  status: PrSignalStatus; approved_at: string | null; pickups: PrPickup[];
  created_at: string; updated_at: string;
}

// ── Diagnostics ──────────────────────────────────────────────────────────────

export interface OnSiteGaps {
  missing_schema_types: string[];
  faq_coverage_score: number;
  freshness_gap: number;
  entity_density_gap: number;
  internal_link_gap: number;
}

export interface OffSiteGaps {
  aggregator_presence: number;
  review_volume_gap: number;
  community_presence: number;
  entity_recognition: number;
  pr_coverage: number;
}

export interface RecommendedAction {
  action: string;
  estimated_impact: string;
  priority: 'high' | 'medium' | 'low';
}

export interface GapReport {
  id: string;
  version: number;
  generated_at: string;
  plain_english_summary: string;
  on_site_gaps: OnSiteGaps;
  off_site_gaps: OffSiteGaps;
  recommended_actions: RecommendedAction[];
  top_cited_competitor_id: string | null;
  top_cited_domain: string | null;
  created_at: string;
}
