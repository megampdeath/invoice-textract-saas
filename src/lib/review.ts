import type { ExtractedInvoice } from "./textract";

export const REVIEW_STATUS = {
  NEEDS_REVIEW: "needs_review",
  APPROVED: "approved",
} as const;

// Below this auto-approve is skipped and the invoice is routed to the review queue.
const CONFIDENCE_THRESHOLD = 0.85;

export interface ReviewState {
  reviewStatus: string;
  reviewReason: string | null;
}

/**
 * Decide an invoice's initial review state after extraction.
 * - duplicate -> needs_review
 * - missing key fields -> needs_review
 * - low confidence -> needs_review
 * - otherwise -> approved (auto)
 */
export function computeReviewState(
  extracted: ExtractedInvoice,
  isDuplicate: boolean
): ReviewState {
  if (isDuplicate) {
    return { reviewStatus: REVIEW_STATUS.NEEDS_REVIEW, reviewReason: "Possible duplicate" };
  }

  const missing: string[] = [];
  if (!extracted.vendorName) missing.push("vendor");
  if (extracted.total == null) missing.push("total");
  if (!extracted.invoiceNumber) missing.push("invoice #");
  if (missing.length > 0) {
    return {
      reviewStatus: REVIEW_STATUS.NEEDS_REVIEW,
      reviewReason: `Missing key fields: ${missing.join(", ")}`,
    };
  }

  if (extracted.confidence != null && extracted.confidence < CONFIDENCE_THRESHOLD) {
    return {
      reviewStatus: REVIEW_STATUS.NEEDS_REVIEW,
      reviewReason: `Low confidence (${Math.round(extracted.confidence * 100)}%)`,
    };
  }

  return { reviewStatus: REVIEW_STATUS.APPROVED, reviewReason: null };
}
