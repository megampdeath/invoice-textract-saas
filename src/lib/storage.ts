import { promises as fs } from "fs";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export interface StoredFile {
  storage: "local" | "s3";
  key: string;
}

const LOCAL_ROOT = path.join(process.cwd(), "uploads");

function s3Client(): S3Client {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) throw new Error("AWS_REGION is not set");
  return new S3Client({ region });
}

function shouldUseS3(): boolean {
  return Boolean(process.env.AWS_S3_BUCKET);
}

export function isAllowedMime(mime: string): boolean {
  return /^(application\/pdf|image\/(png|jpeg|tiff))$/i.test(mime);
}

/**
 * Persist an uploaded invoice file. Uses S3 when AWS_S3_BUCKET is set,
 * otherwise writes to the local ./uploads directory.
 */
export async function storeFile(
  bytes: Uint8Array,
  options: { organizationId: string; fileName: string; mimeType: string }
): Promise<StoredFile> {
  const safeName = options.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const key = `${options.organizationId}/${Date.now()}-${safeName}`;

  if (shouldUseS3()) {
    await s3Client().send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        Body: bytes as unknown as Buffer,
        ContentType: options.mimeType,
      })
    );
    return { storage: "s3", key };
  }

  const localPath = path.join(LOCAL_ROOT, key);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, bytes as unknown as Buffer);
  return { storage: "local", key };
}

/** Read a stored file back as bytes (needed to send to Textract). */
export async function readFileBytes(file: StoredFile): Promise<Uint8Array> {
  if (file.storage === "s3") {
    const res = await s3Client().send(
      new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: file.key })
    );
    const body = res.Body as
      | { transformToByteArray(): Promise<Uint8Array> }
      | undefined;
    if (!body) throw new Error("Empty S3 response body");
    return await body.transformToByteArray();
  }
  const buf = await fs.readFile(path.join(LOCAL_ROOT, file.key));
  return new Uint8Array(buf);
}

/** Build a web-relative URL for dashboard display/download (local only). */
export function localFileUrl(file: StoredFile): string | null {
  if (file.storage !== "local") return null;
  return `/uploads/${file.key}`;
}
