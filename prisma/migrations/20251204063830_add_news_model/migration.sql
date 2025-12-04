-- CreateTable
CREATE TABLE "news" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "finnhubId" INTEGER NOT NULL,
    "category" TEXT,
    "headline" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT NOT NULL,
    "image" TEXT,
    "source" TEXT,
    "datetime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_finnhubId_key" ON "news"("finnhubId");

-- CreateIndex
CREATE UNIQUE INDEX "news_url_key" ON "news"("url");

-- CreateIndex
CREATE INDEX "news_stockId_createdAt_idx" ON "news"("stockId", "createdAt");

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
