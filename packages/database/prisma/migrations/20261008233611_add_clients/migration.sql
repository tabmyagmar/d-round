-- CreateEnum
CREATE TYPE "general_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "client_order_type" AS ENUM ('CONTRACT_WORK', 'DISPATCH', 'SPOT_WORK');

-- CreateTable
CREATE TABLE "client_addresses" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "post_code" TEXT NOT NULL,
    "address1" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_chargers" (
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_chargers_pkey" PRIMARY KEY ("client_id","user_id")
);

-- CreateTable
CREATE TABLE "client_regions" (
    "client_id" UUID NOT NULL,
    "region_code" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_regions_pkey" PRIMARY KEY ("client_id","region_code")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_kana" VARCHAR(100) NOT NULL,
    "areas" "source_area"[],
    "order_types" "client_order_type"[],
    "phone_number" VARCHAR(20) NOT NULL,
    "fax" VARCHAR(20),
    "web_url" VARCHAR(255),
    "status" "general_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_addresses_client_id_key" ON "client_addresses"("client_id");

-- CreateIndex
CREATE INDEX "client_addresses_post_code_idx" ON "client_addresses"("post_code");

-- CreateIndex
CREATE INDEX "client_chargers_user_id_idx" ON "client_chargers"("user_id");

-- CreateIndex
CREATE INDEX "client_regions_region_code_idx" ON "client_regions"("region_code");

-- CreateIndex
CREATE INDEX "clients_number_idx" ON "clients"("number");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_name_kana_idx" ON "clients"("name_kana");

-- AddForeignKey
ALTER TABLE "client_addresses" ADD CONSTRAINT "client_addresses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_addresses" ADD CONSTRAINT "client_addresses_post_code_fkey" FOREIGN KEY ("post_code") REFERENCES "source_addresses"("post_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_chargers" ADD CONSTRAINT "client_chargers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_chargers" ADD CONSTRAINT "client_chargers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_regions" ADD CONSTRAINT "client_regions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_regions" ADD CONSTRAINT "client_regions_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "source_regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

