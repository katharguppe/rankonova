-- AlterTable
ALTER TABLE "review_audits" ADD COLUMN     "keyword_frequency" JSONB,
ADD COLUMN     "recency" TIMESTAMP(3),
ADD COLUMN     "review_velocity" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "review_snapshots" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "reviewer_name" TEXT,
    "rating" DOUBLE PRECISION NOT NULL,
    "review_text" TEXT NOT NULL,
    "review_date" TIMESTAMP(3),
    "is_negative" BOOLEAN NOT NULL DEFAULT false,
    "response_draft" TEXT,
    "response_status" "ResponseStatus" NOT NULL DEFAULT 'pending',
    "response_submitted_at" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_request_kits" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "whatsapp_template" TEXT NOT NULL,
    "sms_template" TEXT NOT NULL,
    "email_subject" TEXT NOT NULL,
    "email_body" TEXT NOT NULL,
    "qr_code_html" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_request_kits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_snapshots_client_id_idx" ON "review_snapshots"("client_id");

-- CreateIndex
CREATE INDEX "review_snapshots_client_id_platform_idx" ON "review_snapshots"("client_id", "platform");

-- CreateIndex
CREATE INDEX "review_snapshots_client_id_is_negative_response_status_idx" ON "review_snapshots"("client_id", "is_negative", "response_status");

-- CreateIndex
CREATE INDEX "review_snapshots_client_id_detected_at_idx" ON "review_snapshots"("client_id", "detected_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_request_kits_client_id_key" ON "review_request_kits"("client_id");

-- AddForeignKey
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_request_kits" ADD CONSTRAINT "review_request_kits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
