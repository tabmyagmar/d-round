-- CreateEnum
CREATE TYPE "source_area" AS ENUM ('EAST', 'WEST');

-- CreateTable
CREATE TABLE "source_prefectures" (
    "id" UUID NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "region_code" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_prefectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_regions" (
    "id" UUID NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "area" "source_area" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_regions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_prefectures_code_key" ON "source_prefectures"("code");

-- CreateIndex
CREATE INDEX "source_prefectures_region_code_idx" ON "source_prefectures"("region_code");

-- CreateIndex
CREATE UNIQUE INDEX "source_regions_code_key" ON "source_regions"("code");

-- AddForeignKey
ALTER TABLE "source_prefectures" ADD CONSTRAINT "source_prefectures_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "source_regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
