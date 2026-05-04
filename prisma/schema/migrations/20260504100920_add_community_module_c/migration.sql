-- AlterTable
ALTER TABLE "community_threads" ADD COLUMN     "competitor_names_mentioned" JSONB,
ADD COLUMN     "is_competitor_recommended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "question_text" TEXT,
ADD COLUMN     "thread_score" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "community_threads_client_id_is_competitor_recommended_is_cl_idx" ON "community_threads"("client_id", "is_competitor_recommended", "is_client_mentioned");

-- CreateIndex
CREATE INDEX "community_threads_client_id_ai_citation_count_idx" ON "community_threads"("client_id", "ai_citation_count");
