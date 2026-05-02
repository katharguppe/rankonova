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
