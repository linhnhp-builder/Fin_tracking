-- FinTrack v3.1 — chạy trên Supabase SQL Editor (sau backup nếu cần rollback v2.1)

CREATE TABLE IF NOT EXISTS "gold_n8n_feed" (
  "id" serial PRIMARY KEY NOT NULL,
  "payload" jsonb NOT NULL,
  "source" text,
  "ingestedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "gold_n8n_feed_ingested_idx" ON "gold_n8n_feed" ("ingestedAt");

CREATE TABLE IF NOT EXISTS "silver_n8n_feed" (
  "id" serial PRIMARY KEY NOT NULL,
  "payload" jsonb NOT NULL,
  "source" text,
  "ingestedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "silver_n8n_feed_ingested_idx" ON "silver_n8n_feed" ("ingestedAt");

ALTER TABLE "gold_n8n_feed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "silver_n8n_feed" ENABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS "market_brand_prices";
DROP TABLE IF EXISTS "price_snapshots";

-- ─── Rollback về kiểu v2.1 (chỉ hướng dẫn — không tự chạy) ───────────────────
-- 1) git checkout <commit v2.1> — khôi phục code + drizzle/schema cũ
-- 2) Tạo lại bảng price_snapshots, market_brand_prices theo migration cũ (hoặc restore backup DB)
-- 3) DROP TABLE gold_n8n_feed, silver_n8n_feed;
