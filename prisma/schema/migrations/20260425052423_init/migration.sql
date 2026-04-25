-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('starter', 'growth', 'enterprise');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'tenant_admin', 'client_manager', 'client_viewer');

-- CreateEnum
CREATE TYPE "PromptRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'dead_letter');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'revision_requested', 'approved', 'published', 'rejected');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('positive', 'negative', 'neutral', 'mixed');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "IntentType" AS ENUM ('purchase_intent', 'comparison', 'feature_query', 'ownership', 'segment', 'local_discovery', 'trust_signal', 'price_query');

-- CreateEnum
CREATE TYPE "BuyerStage" AS ENUM ('awareness', 'consideration', 'decision', 'retention');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('faq_page', 'comparison_page', 'entity_authority_page', 'segment_article');

-- CreateEnum
CREATE TYPE "AiEngine" AS ENUM ('chatgpt', 'perplexity', 'gemini', 'claude', 'grok', 'google_ai_overviews');

-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('pending', 'posted', 'skipped');

-- CreateEnum
CREATE TYPE "BillingEventType" AS ENUM ('subscription_created', 'subscription_renewed', 'payment_succeeded', 'payment_failed', 'plan_upgraded', 'plan_downgraded', 'trial_started', 'trial_ended', 'subscription_cancelled');

-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('login_success', 'login_failure', 'logout', 'password_reset_requested', 'password_reset_completed', 'mfa_enabled', 'mfa_disabled', 'mfa_challenge_success', 'mfa_challenge_failure', 'account_locked', 'account_unlocked', 'token_refreshed');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan_tier" "PlanTier" NOT NULL DEFAULT 'starter',
    "billing_email" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "prompt_quota_daily" INTEGER NOT NULL DEFAULT 500,
    "trial_ends_at" TIMESTAMP(3),
    "razorpay_subscription_id" TEXT,
    "billing_cycle_start" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'client_viewer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "replaced_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" "AuthEventType" NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verticals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "prompt_templates" JSONB NOT NULL,
    "trusted_domains" JSONB NOT NULL,
    "aggregator_platforms" JSONB NOT NULL,
    "schema_types" JSONB NOT NULL,
    "community_platforms" JSONB NOT NULL,
    "wikidata_entity_type" TEXT,
    "review_platforms" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verticals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vertical_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "aliases" JSONB NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "website_url" TEXT NOT NULL,
    "description" TEXT,
    "models" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vertical_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" JSONB NOT NULL,
    "website_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL,
    "vertical_id" TEXT,
    "tenant_id" TEXT,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "intent_type" "IntentType" NOT NULL,
    "buyer_stage" "BuyerStage" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_runs" (
    "id" TEXT NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "engine" "AiEngine" NOT NULL,
    "raw_response" TEXT,
    "ran_at" TIMESTAMP(3) NOT NULL,
    "tokens_used" INTEGER,
    "duration_ms" INTEGER,
    "status" "PromptRunStatus" NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "cost_usd" DECIMAL(10,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_mentions" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "competitor_id" TEXT,
    "brand_name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "cited_url" TEXT,
    "context_snippet" TEXT,
    "is_client_brand" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citation_sources" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "domain_authority_score" INTEGER,
    "schema_types_found" JSONB NOT NULL,
    "has_faq_schema" BOOLEAN NOT NULL DEFAULT false,
    "word_count" INTEGER,
    "last_crawled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citation_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gap_reports" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "on_site_gaps" JSONB NOT NULL,
    "off_site_gaps" JSONB NOT NULL,
    "top_cited_competitor_id" TEXT,
    "top_cited_domain" TEXT,
    "plain_english_summary" TEXT NOT NULL,
    "recommended_actions" JSONB NOT NULL,
    "previous_report_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gap_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_outputs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "target_prompt_id" TEXT,
    "type" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "html_content" TEXT NOT NULL,
    "schema_json" JSONB NOT NULL,
    "generation_prompt" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "review_notes" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "citation_rate_before" DOUBLE PRECISION,
    "citation_rate_after" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_audits" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "review_count" INTEGER,
    "response_rate" DOUBLE PRECISION,
    "last_checked_at" TIMESTAMP(3) NOT NULL,
    "gap_vs_top_competitor" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_threads" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thread_title" TEXT NOT NULL,
    "is_client_mentioned" BOOLEAN NOT NULL DEFAULT false,
    "ai_citation_count" INTEGER NOT NULL DEFAULT 0,
    "response_draft" TEXT,
    "response_status" "ResponseStatus" NOT NULL DEFAULT 'pending',
    "detected_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_briefs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "week_of" TIMESTAMP(3) NOT NULL,
    "citation_score" DOUBLE PRECISION NOT NULL,
    "citation_delta" DOUBLE PRECISION NOT NULL,
    "action_items" JSONB NOT NULL,
    "platform_actions_log" JSONB NOT NULL,
    "email_sent_at" TIMESTAMP(3),
    "actions_completed" INTEGER NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT,
    "type" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deep_link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "event_type" "BillingEventType" NOT NULL,
    "amount_inr" DECIMAL(12,2),
    "razorpay_payment_id" TEXT,
    "plan_from" "PlanTier",
    "plan_to" "PlanTier",
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_is_active_idx" ON "users"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_events_user_id_idx" ON "auth_events"("user_id");

-- CreateIndex
CREATE INDEX "auth_events_user_id_created_at_idx" ON "auth_events"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "verticals_slug_key" ON "verticals"("slug");

-- CreateIndex
CREATE INDEX "clients_tenant_id_idx" ON "clients"("tenant_id");

-- CreateIndex
CREATE INDEX "clients_vertical_id_idx" ON "clients"("vertical_id");

-- CreateIndex
CREATE INDEX "clients_tenant_id_is_active_idx" ON "clients"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "competitors_tenant_id_idx" ON "competitors"("tenant_id");

-- CreateIndex
CREATE INDEX "competitors_tenant_id_vertical_id_idx" ON "competitors"("tenant_id", "vertical_id");

-- CreateIndex
CREATE INDEX "competitors_tenant_id_is_active_idx" ON "competitors"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "prompts_vertical_id_idx" ON "prompts"("vertical_id");

-- CreateIndex
CREATE INDEX "prompts_tenant_id_idx" ON "prompts"("tenant_id");

-- CreateIndex
CREATE INDEX "prompts_vertical_id_is_active_idx" ON "prompts"("vertical_id", "is_active");

-- CreateIndex
CREATE INDEX "prompt_runs_client_id_idx" ON "prompt_runs"("client_id");

-- CreateIndex
CREATE INDEX "prompt_runs_prompt_id_idx" ON "prompt_runs"("prompt_id");

-- CreateIndex
CREATE INDEX "prompt_runs_client_id_ran_at_idx" ON "prompt_runs"("client_id", "ran_at");

-- CreateIndex
CREATE INDEX "prompt_runs_status_idx" ON "prompt_runs"("status");

-- CreateIndex
CREATE INDEX "prompt_runs_engine_ran_at_idx" ON "prompt_runs"("engine", "ran_at");

-- CreateIndex
CREATE INDEX "brand_mentions_run_id_idx" ON "brand_mentions"("run_id");

-- CreateIndex
CREATE INDEX "brand_mentions_client_id_idx" ON "brand_mentions"("client_id");

-- CreateIndex
CREATE INDEX "brand_mentions_competitor_id_idx" ON "brand_mentions"("competitor_id");

-- CreateIndex
CREATE INDEX "brand_mentions_client_id_is_client_brand_idx" ON "brand_mentions"("client_id", "is_client_brand");

-- CreateIndex
CREATE INDEX "brand_mentions_client_id_created_at_idx" ON "brand_mentions"("client_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "citation_sources_url_key" ON "citation_sources"("url");

-- CreateIndex
CREATE INDEX "citation_sources_domain_idx" ON "citation_sources"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "gap_reports_previous_report_id_key" ON "gap_reports"("previous_report_id");

-- CreateIndex
CREATE INDEX "gap_reports_client_id_idx" ON "gap_reports"("client_id");

-- CreateIndex
CREATE INDEX "gap_reports_client_id_generated_at_idx" ON "gap_reports"("client_id", "generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "gap_reports_client_id_version_key" ON "gap_reports"("client_id", "version");

-- CreateIndex
CREATE INDEX "content_outputs_client_id_idx" ON "content_outputs"("client_id");

-- CreateIndex
CREATE INDEX "content_outputs_client_id_status_idx" ON "content_outputs"("client_id", "status");

-- CreateIndex
CREATE INDEX "review_audits_client_id_idx" ON "review_audits"("client_id");

-- CreateIndex
CREATE INDEX "review_audits_client_id_platform_idx" ON "review_audits"("client_id", "platform");

-- CreateIndex
CREATE INDEX "community_threads_client_id_idx" ON "community_threads"("client_id");

-- CreateIndex
CREATE INDEX "community_threads_client_id_response_status_idx" ON "community_threads"("client_id", "response_status");

-- CreateIndex
CREATE INDEX "community_threads_ai_citation_count_idx" ON "community_threads"("ai_citation_count");

-- CreateIndex
CREATE INDEX "weekly_briefs_client_id_idx" ON "weekly_briefs"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_briefs_client_id_week_of_key" ON "weekly_briefs"("client_id", "week_of");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

-- CreateIndex
CREATE INDEX "notifications_client_id_idx" ON "notifications"("client_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_is_read_idx" ON "notifications"("tenant_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_client_id_created_at_idx" ON "notifications"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "billing_events_tenant_id_idx" ON "billing_events"("tenant_id");

-- CreateIndex
CREATE INDEX "billing_events_tenant_id_created_at_idx" ON "billing_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "billing_events_tenant_id_event_type_idx" ON "billing_events"("tenant_id", "event_type");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_mentions" ADD CONSTRAINT "brand_mentions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "prompt_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_mentions" ADD CONSTRAINT "brand_mentions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_mentions" ADD CONSTRAINT "brand_mentions_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "competitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_reports" ADD CONSTRAINT "gap_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_reports" ADD CONSTRAINT "gap_reports_top_cited_competitor_id_fkey" FOREIGN KEY ("top_cited_competitor_id") REFERENCES "competitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_reports" ADD CONSTRAINT "gap_reports_previous_report_id_fkey" FOREIGN KEY ("previous_report_id") REFERENCES "gap_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_outputs" ADD CONSTRAINT "content_outputs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_outputs" ADD CONSTRAINT "content_outputs_target_prompt_id_fkey" FOREIGN KEY ("target_prompt_id") REFERENCES "prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_outputs" ADD CONSTRAINT "content_outputs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_audits" ADD CONSTRAINT "review_audits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_threads" ADD CONSTRAINT "community_threads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_briefs" ADD CONSTRAINT "weekly_briefs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
