import { getRegistrationConfig } from "../registration/config";
import { downloadImage } from "./media";
import { timingSafeEqual } from "crypto";
import type { ChannelAdapter, NormalizedInboundMessage, OutboundReply } from "./ChannelAdapter";

export async function isTelegramConfigured(): Promise<boolean> {
  const config = await getRegistrationConfig();
  return Boolean(config.telegramBotToken && config.telegramWebhookSecret);
}

interface TelegramPhotoSize {
  file_id: string;
  width: number;
  height: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type?: string };
    from?: { username?: string; first_name?: string; last_name?: string };
    text?: string;
    photo?: TelegramPhotoSize[];
    document?: { file_id: string; mime_type?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number; type?: string } };
    from?: { username?: string };
  };
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export const TelegramAdapter: ChannelAdapter = {
  channel: "telegram",

  async verifyWebhook(req) {
    const { telegramBotToken: BOT_TOKEN, telegramWebhookSecret: WEBHOOK_SECRET } = await getRegistrationConfig();
  const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
    if (!WEBHOOK_SECRET) return false;
    const header = req.headers["x-telegram-bot-api-secret-token"];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided || typeof provided !== "string") return false;
    return timingSafeStringEqual(provided, WEBHOOK_SECRET);
  },

  parseInbound(body) {
    const update = body as TelegramUpdate;
    if (!update || !Number.isSafeInteger(update.update_id)) return [];
    const out: NormalizedInboundMessage[] = [];

    if (update.message) {
      const msg = update.message;
      if (msg.chat.type && msg.chat.type !== "private") return [];
      const chatId = String(msg.chat.id);
      const channelMessageId = String(update.update_id);
      const displayName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || undefined;
      const base = {
        channel: "telegram" as const,
        channelUserId: chatId,
        channelMessageId,
        displayName,
        telegramUsername: msg.from?.username,
      };

      if (msg.photo?.length) {
        // Always pick the largest size — Telegram sends multiple resolutions.
        const largest = msg.photo.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
        out.push({ ...base, type: "image", text: largest.file_id, mediaMimeType: "image/jpeg" });
      } else if (msg.document) {
        out.push({ ...base, type: "document", text: msg.document.file_id, mediaMimeType: msg.document.mime_type });
      } else if (msg.text) {
        out.push({ ...base, type: "text", text: msg.text });
      }
    } else if (update.callback_query?.message) {
      if (update.callback_query.message.chat.type && update.callback_query.message.chat.type !== "private") return [];
      const chatId = String(update.callback_query.message.chat.id);
      out.push({
        channel: "telegram",
        channelUserId: chatId,
        channelMessageId: String(update.update_id),
        type: "button",
        text: update.callback_query.data,
        telegramUsername: update.callback_query.from?.username,
      });
    }

    return out;
  },

  async fetchMedia({ mediaId }) {
    const { telegramBotToken: BOT_TOKEN, telegramWebhookSecret: WEBHOOK_SECRET } = await getRegistrationConfig();
  const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
    const fileRes = await fetch(`${API_BASE}/getFile?file_id=${encodeURIComponent(mediaId)}`, { signal: AbortSignal.timeout(15000) });
    if (!fileRes.ok) throw new Error(`Telegram getFile failed: ${fileRes.status}`);
    const fileJson = (await fileRes.json()) as { result: { file_path: string } };

    const downloadRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileJson.result.file_path}`, { signal: AbortSignal.timeout(15000) });
    if (!downloadRes.ok) throw new Error(`Telegram file download failed: ${downloadRes.status}`);
    return downloadImage(downloadRes);
  },

  async sendReply(channelUserId, reply: OutboundReply) {
    const body: Record<string, unknown> = {
      chat_id: channelUserId,
      text: reply.text,
    };
    if (reply.buttons?.length) {
      body.reply_markup = {
        inline_keyboard: [reply.buttons.map((b) => ({ text: b.label, callback_data: b.id }))],
      };
    }
    await sendWithRetry(body);
  },
};

async function sendWithRetry(body: Record<string, unknown>, attempt = 1): Promise<void> {
  const { telegramBotToken: BOT_TOKEN, telegramWebhookSecret: WEBHOOK_SECRET } = await getRegistrationConfig();
  const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return;

  if (attempt >= 3) {
    throw new Error(`Telegram send failed after ${attempt} attempts: ${res.status}`);
  }
  await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  return sendWithRetry(body, attempt + 1);
}
