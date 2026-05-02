-- AddUniqueConstraint
ALTER TABLE "brand_mentions" ADD CONSTRAINT "brand_mentions_run_id_brand_name_key" UNIQUE ("run_id", "brand_name");
