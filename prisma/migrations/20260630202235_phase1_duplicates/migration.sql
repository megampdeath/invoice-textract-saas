-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "duplicate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "duplicateOfId" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_organizationId_contentHash_idx" ON "Invoice"("organizationId", "contentHash");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_vendorName_invoiceNumber_idx" ON "Invoice"("organizationId", "vendorName", "invoiceNumber");
