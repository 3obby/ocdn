npm warn Unknown env config "devdir". This will stop working in the next major version of npm.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "nostr_events" (
    "id" TEXT NOT NULL,
    "kind" INTEGER NOT NULL,
    "pubkey" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "sig" TEXT NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nostr_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "hash" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "total_funded" BIGINT NOT NULL DEFAULT 0,
    "funder_count" INTEGER NOT NULL DEFAULT 0,
    "drain_per_epoch" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "pool_funders" (
    "id" TEXT NOT NULL,
    "pool_hash" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "sats" BIGINT NOT NULL,
    "event_id" TEXT NOT NULL,

    CONSTRAINT "pool_funders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "host_pubkey" TEXT NOT NULL,
    "client_pubkey" TEXT NOT NULL,
    "price_sats" BIGINT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "response_hash" TEXT NOT NULL,
    "receipt_token" TEXT NOT NULL,
    "index_pubkey" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "settler_pubkey" TEXT NOT NULL,
    "total_rewarded" BIGINT NOT NULL,
    "total_royalty" BIGINT NOT NULL,
    "receipt_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_lines" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "host_pubkey" TEXT NOT NULL,
    "reward_sats" BIGINT NOT NULL,

    CONSTRAINT "settlement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importance" (
    "hash" TEXT NOT NULL,
    "commitment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "demand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "centrality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "label" TEXT,
    "epoch" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "importance_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "citation_edges" (
    "id" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "target_hash" TEXT NOT NULL,
    "edge_type" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "event_id" TEXT,

    CONSTRAINT "citation_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preserve_orders" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "funder_pubkey" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "replicas" INTEGER NOT NULL,
    "jurisdictions" INTEGER NOT NULL,
    "duration_epochs" INTEGER NOT NULL,
    "max_price_sats" BIGINT NOT NULL,
    "escrow_proof" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preserve_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_offers" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "host_pubkey" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "replicas" INTEGER NOT NULL,
    "regions" TEXT[],
    "price_sats" BIGINT NOT NULL,
    "bond_sats" BIGINT NOT NULL,
    "bond_proof" TEXT NOT NULL,
    "duration_epochs" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_state" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "protocol_state_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "nostr_events_kind_idx" ON "nostr_events"("kind");

-- CreateIndex
CREATE INDEX "nostr_events_pubkey_idx" ON "nostr_events"("pubkey");

-- CreateIndex
CREATE INDEX "nostr_events_created_at_idx" ON "nostr_events"("created_at");

-- CreateIndex
CREATE INDEX "pool_funders_pubkey_idx" ON "pool_funders"("pubkey");

-- CreateIndex
CREATE UNIQUE INDEX "pool_funders_pool_hash_event_id_key" ON "pool_funders"("pool_hash", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_event_id_key" ON "receipts"("event_id");

-- CreateIndex
CREATE INDEX "receipts_content_hash_epoch_idx" ON "receipts"("content_hash", "epoch");

-- CreateIndex
CREATE INDEX "receipts_host_pubkey_epoch_idx" ON "receipts"("host_pubkey", "epoch");

-- CreateIndex
CREATE INDEX "receipts_client_pubkey_idx" ON "receipts"("client_pubkey");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_event_id_key" ON "settlements"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_epoch_settler_pubkey_key" ON "settlements"("epoch", "settler_pubkey");

-- CreateIndex
CREATE INDEX "settlement_lines_content_hash_idx" ON "settlement_lines"("content_hash");

-- CreateIndex
CREATE INDEX "settlement_lines_host_pubkey_idx" ON "settlement_lines"("host_pubkey");

-- CreateIndex
CREATE INDEX "importance_score_idx" ON "importance"("score" DESC);

-- CreateIndex
CREATE INDEX "importance_epoch_idx" ON "importance"("epoch");

-- CreateIndex
CREATE INDEX "citation_edges_target_hash_idx" ON "citation_edges"("target_hash");

-- CreateIndex
CREATE UNIQUE INDEX "citation_edges_source_hash_target_hash_edge_type_key" ON "citation_edges"("source_hash", "target_hash", "edge_type");

-- CreateIndex
CREATE UNIQUE INDEX "preserve_orders_event_id_key" ON "preserve_orders"("event_id");

-- CreateIndex
CREATE INDEX "preserve_orders_content_hash_status_idx" ON "preserve_orders"("content_hash", "status");

-- CreateIndex
CREATE UNIQUE INDEX "host_offers_event_id_key" ON "host_offers"("event_id");

-- CreateIndex
CREATE INDEX "host_offers_content_hash_status_idx" ON "host_offers"("content_hash", "status");

-- CreateIndex
CREATE INDEX "host_offers_host_pubkey_idx" ON "host_offers"("host_pubkey");

-- AddForeignKey
ALTER TABLE "pool_funders" ADD CONSTRAINT "pool_funders_pool_hash_fkey" FOREIGN KEY ("pool_hash") REFERENCES "pools"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_content_hash_fkey" FOREIGN KEY ("content_hash") REFERENCES "pools"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_content_hash_fkey" FOREIGN KEY ("content_hash") REFERENCES "pools"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importance" ADD CONSTRAINT "importance_hash_fkey" FOREIGN KEY ("hash") REFERENCES "pools"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citation_edges" ADD CONSTRAINT "citation_edges_source_hash_fkey" FOREIGN KEY ("source_hash") REFERENCES "pools"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citation_edges" ADD CONSTRAINT "citation_edges_target_hash_fkey" FOREIGN KEY ("target_hash") REFERENCES "pools"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

