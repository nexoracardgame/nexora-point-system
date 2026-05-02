CREATE INDEX "MarketListing_cardNo_idx" ON "MarketListing"("cardNo");
CREATE INDEX "MarketListing_sellerId_status_idx" ON "MarketListing"("sellerId", "status");
CREATE INDEX "MarketListing_status_rarity_idx" ON "MarketListing"("status", "rarity");
CREATE INDEX "DealRequest_cardId_status_createdAt_idx" ON "DealRequest"("cardId", "status", "createdAt");
