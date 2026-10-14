-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('USER', 'SYSTEM', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "audit_status" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_id" UUID,
    "actor_name" TEXT,
    "actor_email" TEXT,
    "actor_role" TEXT,
    "action" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(32),
    "entity_id" UUID,
    "entity_label" TEXT,
    "status" "audit_status" NOT NULL,
    "error_code" VARCHAR(64),
    "changes" JSONB,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" VARCHAR(512),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_id_idx" ON "audit_logs"("created_at", "id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_status_created_at_idx" ON "audit_logs"("status", "created_at");


-- Append-only (docs/adr/0015-audit-log.md): a row is never changed, the table is never truncated,
-- and only a row older than the retention (AUDIT_LOG_RETENTION_DAYS = 90 in @repo/validation) may
-- be deleted — by the worker's sweeper. created_at holds UTC, so now() is read in UTC as well.
CREATE FUNCTION "audit_logs_append_only"() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs is append-only: % refused', TG_OP;
  END IF;
  IF OLD."created_at" >= (now() AT TIME ZONE 'UTC') - INTERVAL '90 days' THEN
    RAISE EXCEPTION 'audit_logs keeps a row for 90 days: DELETE refused';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_append_only_rows"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_append_only"();

CREATE TRIGGER "audit_logs_append_only_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_logs_append_only"();
