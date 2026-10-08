-- 定型文: personal comment templates (ADR 0006). Expand only: a new enum and a new table owned by
-- users (Cascade); nothing existing changes.
-- CreateEnum
CREATE TYPE "comment_for" AS ENUM ('WORKFLOW', 'APPLICATION', 'CLIENT', 'STAFF');

-- CreateTable
CREATE TABLE "comment_templates" (
    "id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "types" "comment_for"[],
    "short" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comment_templates_created_by_short_key" ON "comment_templates"("created_by", "short");

-- AddForeignKey
ALTER TABLE "comment_templates" ADD CONSTRAINT "comment_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

