-- CreateEnum
CREATE TYPE "PrSignalStatus" AS ENUM ('draft', 'approved', 'distributed', 'archived');

-- AlterTable
ALTER TABLE "verticals" ADD COLUMN     "news_rss_feeds" JSONB;

-- CreateTable
CREATE TABLE "pr_signals" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "news_title" TEXT NOT NULL,
    "news_url" TEXT NOT NULL,
    "news_source" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "relevance_score" DOUBLE PRECISION NOT NULL,
    "pr_angle" TEXT NOT NULL,
    "press_release_draft" TEXT NOT NULL,
    "distribution_checklist" JSONB NOT NULL,
    "status" "PrSignalStatus" NOT NULL DEFAULT 'draft',
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pr_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_pickups" (
    "id" TEXT NOT NULL,
    "pr_signal_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "indexed_url" TEXT,
    "is_ai_trusted" BOOLEAN NOT NULL DEFAULT false,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_pickups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pr_signals_client_id_created_at_idx" ON "pr_signals"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "pr_signals_client_id_status_idx" ON "pr_signals"("client_id", "status");

-- CreateIndex
CREATE INDEX "pr_pickups_pr_signal_id_idx" ON "pr_pickups"("pr_signal_id");

-- AddForeignKey
ALTER TABLE "pr_signals" ADD CONSTRAINT "pr_signals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_pickups" ADD CONSTRAINT "pr_pickups_pr_signal_id_fkey" FOREIGN KEY ("pr_signal_id") REFERENCES "pr_signals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
