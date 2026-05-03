-- AlterTable: add follow_up_scheduled_at and previous_version_id to content_outputs
ALTER TABLE "content_outputs" ADD COLUMN "follow_up_scheduled_at" TIMESTAMP(3);
ALTER TABLE "content_outputs" ADD COLUMN "previous_version_id" TEXT;

-- CreateIndex: unique constraint on previous_version_id (one-to-one self-relation)
CREATE UNIQUE INDEX "content_outputs_previous_version_id_key" ON "content_outputs"("previous_version_id");

-- AddForeignKey: self-referential relation for revision history
ALTER TABLE "content_outputs" ADD CONSTRAINT "content_outputs_previous_version_id_fkey"
  FOREIGN KEY ("previous_version_id") REFERENCES "content_outputs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
