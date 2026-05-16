-- AlterTable
ALTER TABLE "prompts" ADD COLUMN     "client_id" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'platform';

-- CreateIndex
CREATE INDEX "prompts_client_id_idx" ON "prompts"("client_id");

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
