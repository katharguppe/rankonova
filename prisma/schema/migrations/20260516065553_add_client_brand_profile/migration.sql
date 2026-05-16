-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "brand_description" TEXT,
ADD COLUMN     "brand_keywords" JSONB,
ADD COLUMN     "competitors_known" JSONB,
ADD COLUMN     "digital_handles" JSONB;
