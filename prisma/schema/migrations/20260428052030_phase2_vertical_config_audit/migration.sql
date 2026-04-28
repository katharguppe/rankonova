/*
  Warnings:

  - Added the required column `intent_categories` to the `verticals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "verticals" ADD COLUMN     "intent_categories" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "vertical_config_audits" (
    "id" TEXT NOT NULL,
    "vertical_id" TEXT NOT NULL,
    "changed_by_user_id" TEXT NOT NULL,
    "before_config" JSONB NOT NULL,
    "after_config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vertical_config_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vertical_config_audits_vertical_id_idx" ON "vertical_config_audits"("vertical_id");

-- CreateIndex
CREATE INDEX "vertical_config_audits_vertical_id_created_at_idx" ON "vertical_config_audits"("vertical_id", "created_at");

-- AddForeignKey
ALTER TABLE "vertical_config_audits" ADD CONSTRAINT "vertical_config_audits_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
