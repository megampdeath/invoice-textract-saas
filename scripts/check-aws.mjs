import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

const client = new STSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

try {
  const res = await client.send(new GetCallerIdentityCommand({}));
  console.log("AWS credentials OK");
  console.log("Account:", res.Account);
  console.log("Arn:    ", res.Arn);
  console.log("UserId: ", res.UserId);
} catch (err) {
  console.error("AWS credentials check FAILED:", err.message);
  process.exit(1);
}
