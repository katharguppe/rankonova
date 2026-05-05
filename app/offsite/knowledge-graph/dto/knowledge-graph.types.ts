export interface WikidataSubmissionDraft {
  label: string;
  description: string;
  aliases: string[];
  claims: {
    P31: string;   // instance of (entity type QID)
    P17: string;   // country — Q668 (India)
    P131: string;  // located in administrative territory (city name)
    P856: string;  // official website URL
  };
}

export interface GkpSnapshot {
  title: string;
  description: string;
  image_url: string | null;
  source_url: string | null;
}

export interface EntityCheckResponse {
  id: string;
  client_id: string;
  wikidata_found: boolean;
  wikidata_qid: string | null;
  wikidata_submission_draft: WikidataSubmissionDraft | null;
  gkp_detected: boolean;
  gkp_snapshot: GkpSnapshot | null;
  wikipedia_notable: boolean;
  wikipedia_url: string | null;
  wikipedia_flag: 'threshold_met' | 'borderline' | 'not_notable' | null;
  status_changed: boolean;
  previous_check_id: string | null;
  checked_at: string;
  created_at: string;
}
