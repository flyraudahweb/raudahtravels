import { getRegistrationConfig } from "../registration/config";
import { downloadImage } from "./media";
import { createHmac, timingSafeEqual } from "crypto";
import type { ChannelAdapter, NormalizedInboundMessage, OutboundReply } from "./ChannelAdapter";

export async function isWhatsAppConfigured(): Promise<boolean> {
  const config = await getRegistrationConfig();
  return Boolean(config.whatsappAccessToken && config.whatsappAppSecret && config.whatsappPhoneNumberId);
}

interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string };
          document?: { id: string; mime_type: string };
          interactive?: { button_reply?: { id: string; title: string } };
        }>;
      };
    }>;
  }>;
}

export const WhatsAppAdapter: ChannelAdapter = {
  channel: "whatsapp",

  async verifyWebhook(req) {
    const { whatsappAccessToken: ACCESS_TOKEN, whatsappAppSecret: APP_SECRET, whatsappPhoneNumberId: PHONE_NUMBER_ID, whatsappApiVersion: API_VERSION } = await getRegistrationConfig();
  const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;
    if (!APP_SECRET || !req.rawBody) return false;
    const signatureHeader = req.headers["x-hub-signature-256"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature || typeof signature !== "string") return false;

    const expected = createHmac("sha256", APP_SECRET).update(req.rawBody).digest("hex");
    if (!/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
    const provided = signature.slice(7);

    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(provided, "hex");
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
  },

  parseInbound(body) {
    const payload = body as WhatsAppWebhookBody;
    const out: NormalizedInboundMessage[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue;
        const contact = value.contacts?.[0];

        for (const msg of value.messages) {
          const base = {
            channel: "whatsapp" as const,
            channelUserId: msg.from,
            channelMessageId: msg.id,
            phone: msg.from,
            displayName: contact?.profile?.name,
          };

          if (msg.type === "text" && msg.text) {
            out.push({ ...base, type: "text", text: msg.text.body });
          } else if (msg.type === "image" && msg.image) {
            out.push({ ...base, type: "image", mediaMimeType: msg.image.mime_type, text: msg.image.id });
          } else if (msg.type === "document" && msg.document) {
            out.push({ ...base, type: "document", mediaMimeType: msg.document.mime_type, text: msg.document.id });
          } else if (msg.type === "interactive" && msg.interactive?.button_reply) {
            out.push({ ...base, type: "button", text: msg.interactive.button_reply.id });
          }
        }
      }
    }
    return out;
  },

  async fetchMedia({ mediaId }) {
    const { whatsappAccessToken: ACCESS_TOKEN, whatsappAppSecret: APP_SECRET, whatsappPhoneNumberId: PHONE_NUMBER_ID, whatsappApiVersion: API_VERSION } = await getRegistrationConfig();
  const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;
    const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!metaRes.ok) throw new Error(`WhatsApp media lookup failed: ${metaRes.status}`);
    const meta = (await metaRes.json()) as { url: string; mime_type: string };

    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!fileRes.ok) throw new Error(`WhatsApp media download failed: ${fileRes.status}`);
    return downloadImage(fileRes);
  },

  async sendReply(channelUserId, reply: OutboundReply) {
    const body: Record<string, unknown> = reply.template ? {
      messaging_product: "whatsapp", to: channelUserId, type: "template",
      template: { name: reply.template.name, language: { code: reply.template.language },
        components: [{ type: "body", parameters: reply.template.parameters.map((text) => ({ type: "text", text })) }] },
    } : reply.buttons?.length
      ? {
          messaging_product: "whatsapp",
          to: channelUserId,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: reply.text },
            action: {
              buttons: reply.buttons.slice(0, 3).map((b) => ({
                type: "reply",
                reply: { id: b.id, title: b.label.slice(0, 20) },
              })),
            },
          },
        }
      : {
          messaging_product: "whatsapp",
          to: channelUserId,
          type: "text",
          text: { body: reply.text },
        };

    await sendWithRetry(body);
  },
};

async function sendWithRetry(body: Record<string, unknown>, attempt = 1): Promise<void> {
  const { whatsappAccessToken: ACCESS_TOKEN, whatsappAppSecret: APP_SECRET, whatsappPhoneNumberId: PHONE_NUMBER_ID, whatsappApiVersion: API_VERSION } = await getRegistrationConfig();
  const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;
  const res = await fetch(`${GRAPH_BASE}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.ok) return;

  if (attempt >= 3) {
    throw new Error(`WhatsApp send failed after ${attempt} attempts: ${res.status}`);
  }
  await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  return sendWithRetry(body, attempt + 1);
}
