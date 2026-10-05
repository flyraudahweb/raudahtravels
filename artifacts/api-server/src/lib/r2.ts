import { getRegistrationConfig, type RegistrationConfig } from "../services/registration/config";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { logger } from "./logger";

export const BUCKET_NAME = process.env.R2_BUCKET_NAME || "raudah-uploads";

// Resolve credentials and bucket for every operation so rotations apply without
// restarting. The proxy preserves the SDK command/result types for callers.
let cached: { identity: string; client: S3Client } | undefined;
export const r2Client = new Proxy({} as S3Client, {
  get(_target, property) {
    if (property !== "send") throw new Error("Only R2 send operations are supported");
    return async (command: any, options?: any) => {
      const config = await getRegistrationConfig();
      if (!await isR2Configured(config)) throw new Error("Passport storage unavailable");
      const endpoint = process.env.R2_ENDPOINT || `https://${config.r2AccountId}.r2.cloudflarestorage.com`;
      const identity = JSON.stringify([endpoint, config.r2AccessKeyId, config.r2SecretAccessKey]);
      if (!cached || cached.identity !== identity) {
        cached?.client.destroy();
        cached = { identity, client: new S3Client({ region: "auto", endpoint,
          credentials: { accessKeyId: config.r2AccessKeyId, secretAccessKey: config.r2SecretAccessKey } }) };
      }
      command.input.Bucket = config.r2BucketName;
      return cached.client.send(command, options);
    };
  },
});

export async function isR2Configured(config?: RegistrationConfig): Promise<boolean> {
  config ??= await getRegistrationConfig();
  return Boolean(config.r2AccessKeyId && config.r2SecretAccessKey && config.r2AccountId);
}

/**
 * Ensure the bucket exists — creates it if not found.
 * Called once on server startup.
 */
export async function ensureBucket(): Promise<void> {
  if (!await isR2Configured()) {
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
