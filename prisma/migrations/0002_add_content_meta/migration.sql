-- CreateTable
CREATE TABLE "content_meta" (
    "hash" TEXT NOT NULL,
    "file_name" TEXT,
    "file_type" TEXT,
    "file_size" INTEGER,
    "uploaded_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_meta_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "content_meta_status_idx" ON "content_meta"("status");

-- AddForeignKey
ALTER TABLE "content_meta" ADD CONSTRAINT "content_meta_hash_fkey" FOREIGN KEY ("hash") REFERENCES "pools"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;
