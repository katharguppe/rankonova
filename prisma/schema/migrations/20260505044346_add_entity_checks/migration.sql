-- CreateTable
CREATE TABLE "entity_checks" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "wikidata_found" BOOLEAN NOT NULL DEFAULT false,
    "wikidata_qid" TEXT,
    "wikidata_submission_draft" JSONB,
    "gkp_detected" BOOLEAN NOT NULL DEFAULT false,
    "gkp_snapshot" JSONB,
    "wikipedia_notable" BOOLEAN NOT NULL DEFAULT false,
    "wikipedia_url" TEXT,
    "wikipedia_flag" TEXT,
    "status_changed" BOOLEAN NOT NULL DEFAULT false,
    "previous_check_id" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entity_checks_client_id_checked_at_idx" ON "entity_checks"("client_id", "checked_at");

-- AddForeignKey
ALTER TABLE "entity_checks" ADD CONSTRAINT "entity_checks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
