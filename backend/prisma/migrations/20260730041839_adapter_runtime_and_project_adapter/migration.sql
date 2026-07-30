-- AlterTable
ALTER TABLE "adapters" ADD COLUMN "runtime" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "adapter_model" TEXT;
ALTER TABLE "projects" ADD COLUMN "adapter_type" TEXT;
