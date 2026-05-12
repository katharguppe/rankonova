// app/weekly-brief/dto/weekly-brief.types.ts

export type ActionType = 'content_approval' | 'pr_approval' | 'reddit_reply' | 'review_request' | 'profile_update';

export interface PendingAction {
  action_type: ActionType;
  draft_id: string;
  title: string;
  draft_preview: string; // first 100 chars
  effort_minutes: number; // max 30
}

export interface RankedAction extends PendingAction {
  weight: number; // 1, 2, or 3
  impact_score: number; // calculated as weight × (1 + recency_bonus)
  draft_content_summary: string; // short summary for Haiku
}

export interface ActionItemForBrief {
  action_type: ActionType;
  title: string;
  estimated_impact: number;
  draft_id: string;
  draft_preview: string;
  effort_minutes: number;
}

export interface BriefGenerationInput {
  client_id: string;
  client_name: string;
  week_of: Date;
  citation_score: number;
  citation_delta: number;
  actions: RankedAction[]; // top 3 (or fewer)
}

export interface GeneratedBrief {
  headline: string;
  intro: string;
  sections: {
    title: string;
    what_to_do: string;
    expected_outcome: string;
    effort: string;
  }[];
  cta: string;
  footer: string;
}

export interface WeeklyBriefRecord {
  client_id: string;
  week_of: Date;
  citation_score: number;
  citation_delta: number;
  action_items: ActionItemForBrief[];
  brief_markdown: string;
  brief_html: string;
  email_sent_at?: Date;
}
