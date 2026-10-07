-- 姓 / 名 and their katakana readings on users (ADR 0002, 2026-10-07). Expand only: nullable, so
-- existing users and Better Auth (which writes only "name") keep working.
ALTER TABLE "users" ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "first_name_kana" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "last_name_kana" TEXT;
