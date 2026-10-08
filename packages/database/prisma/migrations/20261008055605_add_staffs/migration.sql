-- CreateEnum
CREATE TYPE "family_relation" AS ENUM ('HUSBAND', 'WIFE', 'FATHER', 'MOTHER', 'FATHER_IN_LAW', 'MOTHER_IN_LAW', 'GRANDFATHER', 'GRANDMOTHER', 'ELDEST_SON', 'SECOND_SON', 'THIRD_SON', 'ELDEST_DAUGHTER', 'SECOND_DAUGHTER', 'THIRD_DAUGHTER', 'GRANDCHILD', 'NEPHEW', 'NIECE', 'PARENTAL_UNCLE', 'PARENTAL_AUNT', 'UNCLE', 'AUNT', 'GREAT_GRANDFATHER', 'GREAT_GRANDMOTHER');

-- CreateEnum
CREATE TYPE "staff_memo_type" AS ENUM ('STAFF_MEMO', 'ENTRY_EXIT', 'ADDRESS_CHANGE', 'INSURANCE', 'OTHER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "employee_type" AS ENUM ('EXECUTIVE', 'FULL_TIME', 'CONTRACT', 'PART_TIME', 'OTHER');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "staff_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "staff_addresses" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "post_code" TEXT NOT NULL,
    "address1" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_chargers" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),

    CONSTRAINT "staff_chargers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_family_members" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name_kana" VARCHAR(80),
    "first_name_kana" VARCHAR(80),
    "relation" "family_relation",
    "birthday" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_job_histories" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "hire_date" DATE NOT NULL,
    "resignation_date" DATE,
    "resignation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_job_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_memos" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "memo_type" "staff_memo_type" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_memos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_prefectures" (
    "staff_id" UUID NOT NULL,
    "prefecture_code" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_prefectures_pkey" PRIMARY KEY ("staff_id","prefecture_code")
);

-- CreateTable
CREATE TABLE "staff_regions" (
    "staff_id" UUID NOT NULL,
    "region_code" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_regions_pkey" PRIMARY KEY ("staff_id","region_code")
);

-- CreateTable
CREATE TABLE "staffs" (
    "id" UUID NOT NULL,
    "employee_type" "employee_type" NOT NULL,
    "employee_number" INTEGER NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name_kana" VARCHAR(80) NOT NULL,
    "first_name_kana" VARCHAR(80) NOT NULL,
    "gender" "gender" NOT NULL,
    "birthday" DATE,
    "position" "position",
    "branch_name" VARCHAR(100),
    "email" VARCHAR(255),
    "phone_number" VARCHAR(20),
    "emergency_phone_number" VARCHAR(20),
    "areas" "source_area"[],
    "status" "staff_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "staffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_addresses_staff_id_key" ON "staff_addresses"("staff_id");

-- CreateIndex
CREATE INDEX "staff_addresses_post_code_idx" ON "staff_addresses"("post_code");

-- CreateIndex
CREATE INDEX "staff_chargers_staff_id_idx" ON "staff_chargers"("staff_id");

-- CreateIndex
CREATE INDEX "staff_chargers_user_id_idx" ON "staff_chargers"("user_id");

-- CreateIndex
CREATE INDEX "staff_family_members_staff_id_idx" ON "staff_family_members"("staff_id");

-- CreateIndex
CREATE INDEX "staff_job_histories_staff_id_idx" ON "staff_job_histories"("staff_id");

-- CreateIndex
CREATE INDEX "staff_memos_staff_id_idx" ON "staff_memos"("staff_id");

-- CreateIndex
CREATE INDEX "staff_prefectures_prefecture_code_idx" ON "staff_prefectures"("prefecture_code");

-- CreateIndex
CREATE INDEX "staff_regions_region_code_idx" ON "staff_regions"("region_code");

-- CreateIndex
CREATE INDEX "staffs_employee_number_idx" ON "staffs"("employee_number");

-- CreateIndex
CREATE INDEX "staffs_status_idx" ON "staffs"("status");

-- CreateIndex
CREATE INDEX "staffs_last_name_kana_first_name_kana_idx" ON "staffs"("last_name_kana", "first_name_kana");

-- AddForeignKey
ALTER TABLE "staff_addresses" ADD CONSTRAINT "staff_addresses_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_addresses" ADD CONSTRAINT "staff_addresses_post_code_fkey" FOREIGN KEY ("post_code") REFERENCES "source_addresses"("post_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_chargers" ADD CONSTRAINT "staff_chargers_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_chargers" ADD CONSTRAINT "staff_chargers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_family_members" ADD CONSTRAINT "staff_family_members_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_job_histories" ADD CONSTRAINT "staff_job_histories_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_memos" ADD CONSTRAINT "staff_memos_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_prefectures" ADD CONSTRAINT "staff_prefectures_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_prefectures" ADD CONSTRAINT "staff_prefectures_prefecture_code_fkey" FOREIGN KEY ("prefecture_code") REFERENCES "source_prefectures"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_regions" ADD CONSTRAINT "staff_regions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_regions" ADD CONSTRAINT "staff_regions_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "source_regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

