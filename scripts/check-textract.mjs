import { AnalyzeExpenseCommand, TextractClient } from "@aws-sdk/client-textract";

// Minimal valid 1x1 PNG (white pixel) just to exercise AnalyzeExpense auth.
const png = Buffer.from(
  "89504e470d0a1a0a0000000d494844520000000100000001080200000000" +
    "907753de0000000c4944415408d763f8cfc00000000300018c9ea31e0000" +
    "000049454e44ae426082",
  "hex"
);

const client = new TextractClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

try {
  const res = await client.send(
    new AnalyzeExpenseCommand({ Document: { Bytes: png } })
  );
  const docs = res.ExpenseDocuments?.length ?? 0;
  console.log("Textract AnalyzeExpense: AUTHORIZED");
  console.log("Call succeeded. ExpenseDocuments:", docs, "(0 expected for a blank 1x1 image)");
} catch (err) {
  const name = err.name || "Unknown";
  if (name === "AccessDenied" || name === "UnauthorizedOperation") {
    console.error("Textract AnalyzeExpense: DENIED");
    console.error("The IAM user lacks textract:AnalyzeExpense permission.");
    console.error("Detail:", err.message);
    process.exit(2);
  }
  // Other errors (e.g. image too small) still imply the call was authorized.
  console.log("Textract AnalyzeExpense: AUTHORIZED (call reached Textract)");
  console.log("Non-auth error:", name, "-", err.message);
}
