-- CreateTable
CREATE TABLE "branch_addresses" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "post_code" TEXT NOT NULL,
    "address1" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_chargers" (
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_chargers_pkey" PRIMARY KEY ("branch_id","user_id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_kana" VARCHAR(100) NOT NULL,
    "area" "source_area" NOT NULL,
    "region_code" INTEGER NOT NULL,
    "department_number" INTEGER NOT NULL,
    "department_name" VARCHAR(100) NOT NULL,
    "department_name_kana" VARCHAR(100) NOT NULL,
    "department_fax" VARCHAR(20),
    "contact_last_name" VARCHAR(80) NOT NULL,
    "contact_first_name" VARCHAR(80) NOT NULL,
    "contact_last_name_kana" VARCHAR(80) NOT NULL,
    "contact_first_name_kana" VARCHAR(80) NOT NULL,
    "contact_position" "position" NOT NULL,
    "contact_email" VARCHAR(255) NOT NULL,
    "memo" TEXT,
    "status" "general_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_addresses_branch_id_key" ON "branch_addresses"("branch_id");

-- CreateIndex
CREATE INDEX "branch_addresses_post_code_idx" ON "branch_addresses"("post_code");

-- CreateIndex
CREATE INDEX "branch_chargers_user_id_idx" ON "branch_chargers"("user_id");

-- CreateIndex
CREATE INDEX "branches_client_id_number_idx" ON "branches"("client_id", "number");

-- CreateIndex
CREATE INDEX "branches_status_idx" ON "branches"("status");

-- CreateIndex
CREATE INDEX "branches_region_code_idx" ON "branches"("region_code");

-- CreateIndex
CREATE INDEX "branches_name_kana_idx" ON "branches"("name_kana");

-- AddForeignKey
ALTER TABLE "branch_addresses" ADD CONSTRAINT "branch_addresses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_addresses" ADD CONSTRAINT "branch_addresses_post_code_fkey" FOREIGN KEY ("post_code") REFERENCES "source_addresses"("post_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_chargers" ADD CONSTRAINT "branch_chargers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_chargers" ADD CONSTRAINT "branch_chargers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "source_regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

