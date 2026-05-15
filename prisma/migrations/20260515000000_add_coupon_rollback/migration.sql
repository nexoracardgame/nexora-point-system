ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;

CREATE INDEX IF NOT EXISTS "Coupon_reversedAt_idx" ON "Coupon"("reversedAt");
