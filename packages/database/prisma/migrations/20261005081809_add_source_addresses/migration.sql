-- CreateTable
CREATE TABLE "source_addresses" (
    "id" UUID NOT NULL,
    "jis_code" INTEGER NOT NULL,
    "old_post_code" TEXT,
    "post_code" TEXT NOT NULL,
    "pref_kana" TEXT,
    "city_kana" TEXT,
    "town_kana" TEXT,
    "pref" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "is_town_represented_by_multiple_postal_codes" BOOLEAN NOT NULL DEFAULT false,
    "is_hamlet_numbering_start" BOOLEAN NOT NULL DEFAULT false,
    "has_chome" BOOLEAN NOT NULL DEFAULT false,
    "is_postal_code_for_multiple_town_areas" BOOLEAN NOT NULL DEFAULT false,
    "update_status" INTEGER NOT NULL DEFAULT 0,
    "change_reason" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_addresses_post_code_key" ON "source_addresses"("post_code");
