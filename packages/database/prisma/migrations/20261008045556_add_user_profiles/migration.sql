-- CreateEnum
CREATE TYPE "position" AS ENUM ('EXECUTIVE', 'AREA_MANAGER', 'DISTRICT_MANAGER', 'SV', 'LEADER', 'DISPATCH_COORDINATOR', 'FULL_TIME_EMPLOYEE', 'AREA_EMPLOYEE', 'CONTRACT_EMPLOYEE', 'SUBCONTRACT_STAFF', 'DISPATCH_STAFF', 'STAFF', 'OTHER');

-- CreateTable
CREATE TABLE "user_profile_regions" (
    "user_id" UUID NOT NULL,
    "region_code" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profile_regions_pkey" PRIMARY KEY ("user_id","region_code")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_number" INTEGER NOT NULL,
    "department_name" VARCHAR(80) NOT NULL,
    "position" "position" NOT NULL,
    "retirement_date" DATE,
    "areas" "source_area"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_profile_regions_region_code_idx" ON "user_profile_regions"("region_code");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_employee_number_key" ON "user_profiles"("employee_number");

-- AddForeignKey
ALTER TABLE "user_profile_regions" ADD CONSTRAINT "user_profile_regions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile_regions" ADD CONSTRAINT "user_profile_regions_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "source_regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

