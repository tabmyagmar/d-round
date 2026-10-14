-- CreateEnum
CREATE TYPE "csv_import_row_result" AS ENUM ('IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "csv_import_type" AS ENUM ('USER_CREATE', 'USER_UPDATE', 'STAFF_CREATE', 'STAFF_UPDATE', 'CLIENT_CREATE', 'CLIENT_UPDATE', 'BRANCH_CREATE', 'BRANCH_UPDATE');

-- CreateEnum
CREATE TYPE "csv_import_status" AS ENUM ('UPLOADED', 'CHECKING', 'CHECKED', 'CONFIRMED', 'IMPORTING', 'IMPORTED', 'FAILED');

-- AlterEnum
ALTER TYPE "attachment_kind" ADD VALUE 'CSV_IMPORT';

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "csv_import_id" UUID;

-- CreateTable
CREATE TABLE "csv_import_rows" (
    "id" UUID NOT NULL,
    "csv_import_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "result" "csv_import_row_result",
    "result_error" TEXT,
    "entity_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_imports" (
    "id" UUID NOT NULL,
    "type" "csv_import_type" NOT NULL,
    "status" "csv_import_status" NOT NULL DEFAULT 'UPLOADED',
    "file_name" VARCHAR(255) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "valid_count" INTEGER NOT NULL DEFAULT 0,
    "selected_count" INTEGER NOT NULL DEFAULT 0,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "file_error" TEXT,
    "last_error" TEXT,
    "checked_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "imported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "csv_import_rows_csv_import_id_line_number_key" ON "csv_import_rows"("csv_import_id", "line_number");

-- CreateIndex
CREATE INDEX "csv_imports_created_by_id_type_created_at_idx" ON "csv_imports"("created_by_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "csv_imports_status_updated_at_idx" ON "csv_imports"("status", "updated_at");

-- CreateIndex
CREATE INDEX "attachments_csv_import_id_kind_idx" ON "attachments"("csv_import_id", "kind");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_csv_import_id_fkey" FOREIGN KEY ("csv_import_id") REFERENCES "csv_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_import_rows" ADD CONSTRAINT "csv_import_rows_csv_import_id_fkey" FOREIGN KEY ("csv_import_id") REFERENCES "csv_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

