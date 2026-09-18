-- CreateTable
CREATE TABLE "public"."device_external_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "domain" VARCHAR(50) NOT NULL,
    "external_device_id" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_external_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_external_mappings_device_provider_domain_key" ON "public"."device_external_mappings"("device_id", "provider", "domain");

-- CreateIndex
CREATE INDEX "device_external_mappings_device_id_idx" ON "public"."device_external_mappings"("device_id");

-- CreateIndex
CREATE INDEX "device_external_mappings_provider_domain_ext_id_idx" ON "public"."device_external_mappings"("provider", "domain", "external_device_id");

-- AddForeignKey
ALTER TABLE "public"."device_external_mappings" ADD CONSTRAINT "device_external_mappings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
