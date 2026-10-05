import { getRegistrationConfig } from "../services/registration/config";
import { Router, type IRouter } from "express";
import { WhatsAppAdapter, isWhatsAppConfigured } from "../services/channels/WhatsAppAdapter";
import { enqueueInbound } from "../services/channels/ChannelQueue";
import { allowChannelMessage } from "../services/channels/channelRateLimit";

const router: IRouter = Router();




/** Meta's one-time webhook verification handshake. */
router.get("/whatsapp/webhook", async (req, res) => {
  const { whatsappVerifyToken: VERIFY_TOKEN } = await getRegistrationConfig();
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN && VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post("/whatsapp/webhook", async (req, res) => {
  if (!(await getRegistrationConfig()).enabled || !await isWhatsAppConfigured()) {
    return res.sendStatus(200);
  }

  const rawBody = (req as any).rawBody as Buffer | undefined;
  const verified = await WhatsAppAdapter.verifyWebhook({ headers: req.headers as Record<string, unknown>, rawBody });
  if (!verified) {
    return res.status(401).json({ error: "Invalid signature" });
  }


  if (!allowChannelMessage("whatsapp-ip", req.ip ?? "unknown", 300)) return res.sendStatus(429);
  try {
    const messages = WhatsAppAdapter.parseInbound(req.body);
    if (messages.length > 100) return res.status(413).json({ error: "Too many messages" });
    await enqueueInbound(messages);
    return res.status(200).json({ received: true });
  } catch {
    req.log.error("Failed to persist channel webhook");
    return res.status(503).json({ error: "Please retry webhook delivery" });
  }
});
export default router;
