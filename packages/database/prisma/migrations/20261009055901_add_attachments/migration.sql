-- CreateEnum
CREATE TYPE "attachment_kind" AS ENUM ('USER_AVATAR', 'STAFF_RESUME');

-- CreateEnum
CREATE TYPE "attachment_status" AS ENUM ('PENDING', 'ATTACHED', 'DELETED');

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "kind" "attachment_kind" NOT NULL,
    "status" "attachment_status" NOT NULL DEFAULT 'PENDING',
    "object_key" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "user_id" UUID,
    "staff_id" UUID,
    "attached_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_object_key_key" ON "attachments"("object_key");

-- CreateIndex
CREATE INDEX "attachments_status_created_at_idx" ON "attachments"("status", "created_at");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_id_idx" ON "attachments"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "attachments_user_id_kind_idx" ON "attachments"("user_id", "kind");

-- CreateIndex
CREATE INDEX "attachments_staff_id_kind_idx" ON "attachments"("staff_id", "kind");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

