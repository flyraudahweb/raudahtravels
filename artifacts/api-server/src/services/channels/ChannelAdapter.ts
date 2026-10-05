/**
 * Platform-agnostic shapes every channel adapter normalizes into/out of.
 * Business logic (RegistrationAgentService) only ever sees these — it never
 * touches a WhatsApp or Telegram payload directly.
 */

export type AiChannel = "whatsapp" | "telegram";

export interface NormalizedInboundMessage {
  channel: AiChannel;
  /** Platform-scoped user id: WhatsApp wa_id, Telegram chat id */
  channelUserId: string;
  /** Unique id for idempotency: WhatsApp wamid.*, Telegram update_id */
  channelMessageId: string;
  type: "text" | "image" | "document" | "button";
  text?: string;
  /** Present when type is image/document — already downloaded by the adapter */
  mediaBase64?: string;
  mediaMimeType?: string;
  /** Best-effort display name / username the adapter could read off the payload */
  displayName?: string;
  phone?: string;
  telegramUsername?: string;
}

export interface OutboundReply {
  template?: { name: string; language: string; parameters: string[] };
  text: string;
  /** Rendered as quick-reply buttons where the platform supports them */
  buttons?: Array<{ id: string; label: string }>;
}

export interface ChannelAdapter {
  readonly channel: AiChannel;

  /** True if the inbound webhook request is authentically from this platform. */
  verifyWebhook(req: { headers: Record<string, unknown>; rawBody?: Buffer }): Promise<boolean>;

  /** Parse a verified webhook body into zero or more normalized messages (a payload can batch several). */
  parseInbound(body: unknown): NormalizedInboundMessage[];

  /** Download media referenced by a normalized message that didn't already carry mediaBase64. */
  fetchMedia(ref: { mediaId: string }): Promise<{ base64: string; mimeType: string }>;

  /** Send a reply back to the user on this channel. */
  sendReply(channelUserId: string, reply: OutboundReply): Promise<void>;
}
