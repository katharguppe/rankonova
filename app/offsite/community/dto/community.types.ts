// One entry in the vertical's community_platforms JSON field
export interface CommunityPlatformConfig {
  platform: string;          // "reddit" | future: "quora" | "linkedin"
  identifiers: string[];     // ["r/IndiaCars", "r/CarsIndia"]
  keywords: string[];        // search terms to run against the subreddit
}

// Raw thread data returned from Reddit JSON API or Playwright fallback
export interface RawThread {
  url: string;
  title: string;
  body: string;             // selftext or empty string
  score: number;            // upvotes
  subreddit: string;
}

// Signal detection result for a single thread
export interface ThreadSignals {
  is_client_mentioned: boolean;
  is_competitor_recommended: boolean;
  competitor_names_mentioned: string[];
}

// REST response shape for CommunityThread
export interface CommunityThreadResponse {
  id: string;
  client_id: string;
  platform: string;
  url: string;
  thread_title: string;
  question_text: string | null;
  thread_score: number;
  is_client_mentioned: boolean;
  is_competitor_recommended: boolean;
  competitor_names_mentioned: string[];
  ai_citation_count: number;
  response_draft: string | null;
  response_status: string;
  detected_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}
