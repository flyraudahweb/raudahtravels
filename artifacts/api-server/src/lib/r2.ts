import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { logger } from "./logger";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "raudah-uploads";
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export const BUCKET_NAME = R2_BUCKET_NAME;

/**
 * Ensure the bucket exists — creates it if not found.
 * Called once on server startup.
 */
export async function ensureBucket(): Promise<void> {
  if (!R2_ACCESS_KEY_ID) {
    logger.warn("R2 credentials not configured — file uploads will fail");
    return;
  }
  try {
    await r2Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    logger.info(`R2 bucket '${BUCKET_NAME}' is ready`);
  } catch (err: any) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      logger.info(`Creating R2 bucket '${BUCKET_NAME}'...`);
      await r2Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      logger.info(`R2 bucket '${BUCKET_NAME}' created`);
    } else {
      logger.error({ err }, `Failed to check R2 bucket '${BUCKET_NAME}'`);
    }
  }
}

/**
 * Upload a file buffer to R2 and return the key.
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return key;
}

/**
 * Get a file from R2. Returns the stream + content type.
 */
export async function getFromR2(key: string) {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }),
  );
  return {
    body: response.Body,
    contentType: response.ContentType || "application/octet-stream",
    contentLength: response.ContentLength,
  };
}
