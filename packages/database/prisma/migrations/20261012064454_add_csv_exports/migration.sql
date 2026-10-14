-- CreateEnum
CREATE TYPE "csv_export_type" AS ENUM ('USER', 'STAFF', 'CLIENT', 'BRANCH');

-- AlterEnum
ALTER TYPE "attachment_kind" ADD VALUE 'CSV_EXPORT';

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "csv_export_id" UUID;

-- CreateTable
CREATE TABLE "csv_exports" (
    "id" UUID NOT NULL,
    "type" "csv_export_type" NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "row_count" INTEGER NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csv_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "csv_exports_created_by_id_type_created_at_idx" ON "csv_exports"("created_by_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "attachments_csv_export_id_kind_idx" ON "attachments"("csv_export_id", "kind");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_csv_export_id_fkey" FOREIGN KEY ("csv_export_id") REFERENCES "csv_exports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_exports" ADD CONSTRAINT "csv_exports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

