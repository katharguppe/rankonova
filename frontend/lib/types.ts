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
  html_content: string;
  schema_json: object;
  generation_prompt: string;
  approved_by: string | null;
}
