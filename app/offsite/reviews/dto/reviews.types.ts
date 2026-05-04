// Parsed shape of one review_platforms entry from Vertical config
export interface ReviewPlatformConfig {
  name: string;
  type: 'api' | 'scrape';
  config: Record<string, string>;
}

// A single review scraped from a platform page
export interface ScrapedReview {
  reviewer_name: string | null;
  rating: number;
  review_text: string;
  review_date: Date | null;
}

// Keyword frequency entry
export interface KeywordFrequency {
  word: string;
  count: number;
}

// Response shape for ReviewAudit
export interface ReviewAuditResponse {
  id: string;
  client_id: string;
  platform: string;
  rating: number | null;
  review_count: number | null;
  response_rate: number | null;
  recency: string | null;
  keyword_frequency: KeywordFrequency[];
  review_velocity: number | null;
  gap_vs_top_competitor: GapVsCompetitor | null;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

export interface GapVsCompetitor {
  rating_gap: number;
  review_count_gap: number;
  response_rate_gap: number;
}

// Response shape for ReviewSnapshot
export interface ReviewSnapshotResponse {
  id: string;
  client_id: string;
  platform: string;
  reviewer_name: string | null;
  rating: number;
  review_text: string;
  review_date: string | null;
  is_negative: boolean;
  response_draft: string | null;
  response_status: string;
  response_submitted_at: string | null;
  detected_at: string;
  created_at: string;
}

// Response shape for ReviewRequestKit
export interface ReviewRequestKitResponse {
  id: string;
  client_id: string;
  whatsapp_template: string;
  sms_template: string;
  email_subject: string;
  email_body: string;
  qr_code_html: string;
  created_at: string;
  updated_at: string;
}
