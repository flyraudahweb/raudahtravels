import { HeadBucketCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { siteSettingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { registrationDb as db } from "./database";
import { getRegistrationConfig } from "./config";
import { r2Client, BUCKET_NAME } from "../../lib/r2";
import { z } from "zod";

export interface ConnectionCheck { integration: string; status: "passed" | "failed" | "not_configured"; message: string }
async function readJson<T>(url: string, schema: z.ZodType<T>, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000), redirect: "error" });
  if (!response.ok) throw new Error(`http:${response.status}`);
  return schema.parse(await response.json());
}
export async function checkRegistrationConnections(): Promise<ConnectionCheck[]> {
  const config = await getRegistrationConfig();
  const legacy = await db.query.siteSettingsTable.findMany({ where: inArray(siteSettingsTable.key, ["gemini_api_key", "mistral_api_key"]) });
  const keys = Object.fromEntries(legacy.map(row => [row.key, String(row.value || "")]));
  const geminiKey = config.geminiKey || keys.gemini_api_key;
  const mistralKey = config.mistralKey || keys.mistral_api_key;
  const jobs: Array<{ integration: string; configured: boolean; run: () => Promise<string> }> = [
    { integration: "WhatsApp", configured: Boolean(config.whatsappAccessToken && config.whatsappPhoneNumberId), run: async () => {
      const data = await readJson(`https://graph.facebook.com/${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}?fields=id`, z.object({ id: z.string() }), { Authorization: `Bearer ${config.whatsappAccessToken}` });
      if (data.id !== config.whatsappPhoneNumberId) throw new Error("invalid_response");
      return "Token can access the configured phone number. Template approval and message delivery still require a live chat test.";
    } },
    { integration: "Telegram", configured: Boolean(config.telegramBotToken), run: async () => {
      const base = `https://api.telegram.org/bot${config.telegramBotToken}`;
      const bot = await readJson(`${base}/getMe`, z.object({ ok: z.boolean(), result: z.object({ is_bot: z.boolean() }) }));
      if (bot.ok !== true || bot.result?.is_bot !== true) throw new Error("invalid_response");
      const webhook = await readJson(`${base}/getWebhookInfo`, z.object({ ok: z.boolean(), result: z.object({ url: z.string() }) }));
      if (webhook.ok !== true) throw new Error("invalid_response");
      const expected = `${(process.env.APP_URL || "").replace(/\/+$/, "")}/api/telegram/webhook`;
      if (!process.env.APP_URL || webhook.result?.url !== expected) throw new Error("webhook_mismatch");
      return "Bot token accepted and webhook URL matches. Secret-token delivery still requires a live chat test.";
    } },
    { integration: "Gemini", configured: Boolean(geminiKey), run: async () => {
      const model = await readJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}`, z.object({ supportedGenerationMethods: z.array(z.string()) }), { "x-goog-api-key": geminiKey });
      if (!model.supportedGenerationMethods?.includes("generateContent")) throw new Error("unsupported_model");
      return "Key and model metadata are accessible. Passport extraction and quota still require an image test.";
    } },
    { integration: "Mistral", configured: Boolean(mistralKey), run: async () => {
      const models = await readJson("https://api.mistral.ai/v1/models", z.object({ data: z.array(z.object({ id: z.string(), aliases: z.array(z.string()).optional(), capabilities: z.object({ vision: z.boolean().optional() }).optional() })) }), { Authorization: `Bearer ${mistralKey}` });
      const model = models.data.find(item => item.id === config.mistralModel || item.aliases?.includes(config.mistralModel));
      if (!model || model.capabilities?.vision !== true) throw new Error("unsupported_model");
      return "Key accepted and selected model supports vision. Extraction and quota still require an image test.";
    } },
    { integration: "R2", configured: Boolean(config.r2AccountId && config.r2AccessKeyId && config.r2SecretAccessKey), run: async () => {
      await r2Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }), { abortSignal: AbortSignal.timeout(10000) });
      await r2Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, MaxKeys: 1 }), { abortSignal: AbortSignal.timeout(10000) });
      return "Bucket access and listing passed. Privacy and object read/write/delete require the deployment smoke test.";
    } },
  ];
  return Promise.all(jobs.map(async job => {
    if (!job.configured) return { integration: job.integration, status: "not_configured" as const, message: "Enter and save credentials first." };
    try { return { integration: job.integration, status: "passed" as const, message: await job.run() }; }
    catch (err) {
      // Never expose provider response bodies/errors: URLs can contain tokens.
      const reason = err instanceof Error ? err.message : "";
      const message = reason === "webhook_mismatch" ? "Bot token accepted; register the displayed webhook URL in Telegram."
        : reason === "unsupported_model" ? "Choose an available model with the required generation/vision support."
        : /^http:(401|403)$/.test(reason) ? "Credentials or account permissions were rejected."
        : reason === "http:429" ? "Provider rate limit reached; retry later."
        : "Connection check failed. Check credentials, resource IDs, permissions and network access.";
      return { integration: job.integration, status: "failed" as const, message };
    }
  }));
}
