export interface RssFeedConfig {
  url: string;
  name: string;
}

export interface RawNewsItem {
  title: string;
  url: string;
  source: string;
  description: string;
  publishedAt: Date | null;
}

export interface DistributionContact {
  outlet: string;
  journalist: string;
  contact: string;
  wire_service: boolean;
}

export interface PrPickupResponse {
  id: string;
  pr_signal_id: string;
  domain: string;
  indexed_url: string | null;
  is_ai_trusted: boolean;
  detected_at: string;
}

export interface PrSignalResponse {
  id: string;
  client_id: string;
  news_title: string;
  news_url: string;
  news_source: string;
  published_at: string | null;
  relevance_score: number;
  pr_angle: string;
  press_release_draft: string;
  distribution_checklist: DistributionContact[];
  status: 'draft' | 'approved' | 'distributed' | 'archived';
  approved_at: string | null;
  pickups: PrPickupResponse[];
  created_at: string;
  updated_at: string;
}
