-- AlterTable
ALTER TABLE "prompt_runs" ADD COLUMN     "iteration_id" TEXT;

-- CreateTable
CREATE TABLE "prompt_iterations" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "iteration_number" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',

    CONSTRAINT "prompt_iterations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prompt_iterations_client_id_idx" ON "prompt_iterations"("client_id");

-- CreateIndex
CREATE INDEX "prompt_iterations_client_id_iteration_number_idx" ON "prompt_iterations"("client_id", "iteration_number");

-- CreateIndex
CREATE INDEX "prompt_runs_iteration_id_idx" ON "prompt_runs"("iteration_id");

-- AddForeignKey
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_iteration_id_fkey" FOREIGN KEY ("iteration_id") REFERENCES "prompt_iterations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_iterations" ADD CONSTRAINT "prompt_iterations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
