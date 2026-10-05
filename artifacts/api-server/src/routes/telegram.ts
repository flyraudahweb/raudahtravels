import { getRegistrationConfig } from "../services/registration/config";
import { Router, type IRouter } from "express";
import { TelegramAdapter, isTelegramConfigured } from "../services/channels/TelegramAdapter";
import { enqueueInbound } from "../services/channels/ChannelQueue";
import { allowChannelMessage } from "../services/channels/channelRateLimit";

const router: IRouter = Router();



router.post("/telegram/webhook", async (req, res) => {
  if (!(await getRegistrationConfig()).enabled || !await isTelegramConfigured()) {
    return res.sendStatus(200);
  }

  const verified = await TelegramAdapter.verifyWebhook({ headers: req.headers as Record<string, unknown> });
  if (!verified) {
    return res.status(401).json({ error: "Invalid secret token" });
  }

  if (!allowChannelMessage("telegram-ip", req.ip ?? "unknown", 300)) return res.sendStatus(429);
  try {
    const messages = TelegramAdapter.parseInbound(req.body);
    if (messages.length > 100) return res.status(413).json({ error: "Too many messages" });
    await enqueueInbound(messages);
    return res.status(200).json({ received: true });
  } catch {
    req.log.error("Failed to persist channel webhook");
    return res.status(503).json({ error: "Please retry webhook delivery" });
  }
});
export default router;
