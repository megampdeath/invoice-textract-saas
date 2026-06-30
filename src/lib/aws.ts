import { TextractClient } from "@aws-sdk/client-textract";

function region(): string {
  const r = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!r) {
    throw new Error("AWS_REGION is not set. Configure AWS credentials in .env");
  }
  return r;
}

// Reused across calls. Falls back to default AWS credential chain
// (env vars, ~/.aws/credentials, IAM role, etc.).
let _client: TextractClient | undefined;

export function getTextractClient(): TextractClient {
  if (_client) return _client;
  _client = new TextractClient({
    region: region(),
    // Credentials resolved automatically from the default chain.
  });
  return _client;
}
