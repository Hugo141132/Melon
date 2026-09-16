-- AlterTable
ALTER TABLE "public"."devices" ADD COLUMN "client_id" VARCHAR(150);

-- CreateIndex
CREATE UNIQUE INDEX "devices_client_id_key" ON "public"."devices"("client_id");
