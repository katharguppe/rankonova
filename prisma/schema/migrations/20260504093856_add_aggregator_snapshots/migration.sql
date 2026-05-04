-- CreateTable
CREATE TABLE "aggregator_snapshots" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "profile_url" TEXT NOT NULL,
    "completeness_score" DOUBLE PRECISION NOT NULL,
    "fields_present" JSONB NOT NULL,
    "fields_missing" JSONB NOT NULL,
    "competitor_scores" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "raw_extract" JSONB NOT NULL,
    "update_pack" JSONB NOT NULL,
    "crawled_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aggregator_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aggregator_snapshots_client_id_idx" ON "aggregator_snapshots"("client_id");

-- CreateIndex
CREATE INDEX "aggregator_snapshots_client_id_platform_idx" ON "aggregator_snapshots"("client_id", "platform");

-- CreateIndex
CREATE INDEX "aggregator_snapshots_client_id_platform_crawled_at_idx" ON "aggregator_snapshots"("client_id", "platform", "crawled_at");

-- AddForeignKey
ALTER TABLE "aggregator_snapshots" ADD CONSTRAINT "aggregator_snapshots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
