-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "reviewStatus" TEXT NOT NULL DEFAULT 'needs_review',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
