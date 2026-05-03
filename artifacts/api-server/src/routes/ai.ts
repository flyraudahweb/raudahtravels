import { Router } from "express";
import { db } from "@workspace/db";
import {
  siteSettingsTable, bookingsTable, paymentsTable, profilesTable,
  packagesTable, agentsTable,
} from "@workspace/db";
import { getAuth } from "@clerk/express";
import { eq, sql, inArray } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";

const router = Router();

/* ── Settings helpers ──────────────────────────────────────────────────────── */

async function getAiConfig(): Promise<{
  provider: "gemini" | "mistral";
  geminiKey: string | null;
  mistralKey: string | null;
}> {
  const rows = await db.query.siteSettingsTable.findMany({
    where: inArray(siteSettingsTable.key, ["ai_provider", "gemini_api_key", "mistral_api_key"]),
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value as string]));
  return {
    provider: (map.ai_provider as "gemini" | "mistral") || "gemini",
    geminiKey: map.gemini_api_key || null,
    mistralKey: map.mistral_api_key || null,
  };
}

/* ── Live business data ────────────────────────────────────────────────────── */

async function getLiveBizData() {
  const [totalRevRow] = await db.select({ total: sql<string>`COALESCE(SUM(amount),0)` }).from(paymentsTable).where(eq(paymentsTable.status, "verified"));
  const [pendingPayRow] = await db.select({ count: sql<number>`count(*)` }).from(paymentsTable).where(eq(paymentsTable.status, "pending"));
  const [totalPilgrims] = await db.select({ count: sql<number>`count(*)` }).from(profilesTable).where(eq(profilesTable.role, "pilgrim"));
  const [totalAgents] = await db.select({ count: sql<number>`count(*)` }).from(agentsTable);
  const [activePackages] = await db.select({ count: sql<number>`count(*)` }).from(packagesTable).where(eq(packagesTable.isActive, true));
  const bookingsByStatus = await db.select({ status: bookingsTable.status, count: sql<number>`count(*)` }).from(bookingsTable).groupBy(bookingsTable.status);
  const revenueByMonth = await db.execute(sql`
    SELECT TO_CHAR(created_at, 'Mon YYYY') as month, SUM(amount)::numeric as revenue, COUNT(*) as count
    FROM payments WHERE status='verified' AND created_at >= NOW() - INTERVAL '6 months'
    GROUP BY month, DATE_TRUNC('month', created_at) ORDER BY DATE_TRUNC('month', created_at)
  `);
  return {
    totalRevenue: Number(totalRevRow.total),
    pendingPayments: Number(pendingPayRow.count),
    totalPilgrims: Number(totalPilgrims.count),
    totalAgents: Number(totalAgents.count),
    activePackages: Number(activePackages.count),
    bookingsByStatus: Object.fromEntries(bookingsByStatus.map(b => [b.status, Number(b.count)])),
    revenueByMonth: (revenueByMonth.rows as any[]).map(r => ({ month: r.month, revenue: Number(r.revenue), count: Number(r.count) })),
  };
}

/* ── POST /chat ────────────────────────────────────────────────────────────── */

router.post("/ai/chat", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const { messages } = req.body as { messages?: Array<{ role: string; content: string }> };
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const config = await getAiConfig();

  let bizData: Awaited<ReturnType<typeof getLiveBizData>> | null = null;
  try { bizData = await getLiveBizData(); } catch { /* non-blocking */ }

  const revFmt = (n: number) => `₦${n.toLocaleString("en-NG")}`;
  const dataCtx = bizData ? `
LIVE PLATFORM DATA (as of now):
- Total Verified Revenue: ${revFmt(bizData.totalRevenue)}
- Pending Payments: ${bizData.pendingPayments}
- Total Pilgrims: ${bizData.totalPilgrims}
- Total Agents: ${bizData.totalAgents}
- Active Packages: ${bizData.activePackages}
- Bookings by status: ${JSON.stringify(bizData.bookingsByStatus)}
- Revenue trend (last 6 months): ${JSON.stringify(bizData.revenueByMonth)}
` : "(Live data unavailable)";

  const systemPrompt = `You are Raudah AI, the intelligent business assistant for Raudah Travels & Tours — Nigeria's premier Hajj & Umrah travel agency. You help administrators with business insights, strategy, and platform analytics.

Your capabilities:
- Analyze revenue, bookings, pilgrims, agents, and package performance
- Provide Nigeria-specific Hajj/Umrah market strategy advice
- Give actionable recommendations based on live platform data
- Help with operational decisions, pricing, and growth
- Answer questions about pilgrimage travel, visa processes, and operations

${dataCtx}

Tone: Professional, concise, knowledgeable. Use Islamic greetings when appropriate. Format responses with markdown (**bold**, bullet points, numbered lists) for clarity. Keep responses focused and actionable. When citing numbers, always use the live data provided above.`;

  /* ── Gemini ── */
  if (config.provider === "gemini") {
    if (!config.geminiKey) {
      return res.status(503).json({ error: "Gemini API key not configured. Add it in Settings → AI Integration or switch to Mistral." });
    }
    try {
      const genAI = new GoogleGenerativeAI(config.geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const history = messages.slice(0, -1).map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));
      const chat = model.startChat({ history, systemInstruction: systemPrompt });
      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessage(lastMessage.content);
      return res.json({ content: result.response.text(), provider: "gemini" });
    } catch (err: any) {
      const msg = err?.message ?? "";
      req.log.error({ err }, "Gemini chat error");
      if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429") || msg.includes("quota")) {
        return res.status(429).json({ error: "Gemini quota reached. Switch to Mistral in Settings → AI Integration." });
      }
      if (msg.includes("API_KEY") || msg.includes("API key not valid") || msg.includes("INVALID_ARGUMENT")) {
        return res.status(503).json({ error: "Invalid Gemini API key. Update it in Settings → AI Integration." });
      }
      return res.status(500).json({ error: "AI temporarily unavailable. Please try again." });
    }
  }

  /* ── Mistral ── */
  if (!config.mistralKey) {
    return res.status(503).json({ error: "Mistral API key not configured. Add it in Settings → AI Integration." });
  }
  try {
    const client = new Mistral({ apiKey: config.mistralKey });
    const mistralMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
    ];
    const result = await client.chat.complete({
      model: "mistral-small-latest",
      messages: mistralMessages,
    });
    const content = result.choices?.[0]?.message?.content ?? "";
    return res.json({ content: typeof content === "string" ? content : JSON.stringify(content), provider: "mistral" });
  } catch (err: any) {
    const msg = err?.message ?? "";
    req.log.error({ err }, "Mistral chat error");
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("API key")) {
      return res.status(503).json({ error: "Invalid Mistral API key. Update it in Settings → AI Integration." });
    }
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("quota")) {
      return res.status(429).json({ error: "Mistral rate limit reached. Please wait a moment and try again." });
    }
    return res.status(500).json({ error: "AI temporarily unavailable. Please try again." });
  }
});

/* ── POST /passport/extract ────────────────────────────────────────────────── */

const PASSPORT_PROMPT = `You are a passport data extraction assistant. Analyze this passport image carefully.

First evaluate image quality:
- If the image is blurry, severely cropped (missing MRZ or photo), or has unreadable glare: set isAcceptableQuality to false and describe why in rejectionReason
- Otherwise: set isAcceptableQuality to true and leave rejectionReason as an empty string

Then extract these fields (use empty string if a field is genuinely not readable or absent):
- firstName: given names exactly as printed
- lastName: surname/family name exactly as printed
- documentNumber: passport number (alphanumeric, e.g. A12345678)
- nationality: full nationality as printed (e.g. "NIGERIAN", "BRITISH CITIZEN")
- dateOfBirth: in strict YYYY-MM-DD format
- sex: exactly "M" or "F"
- dateOfIssue: in strict YYYY-MM-DD format
- dateOfExpiry: in strict YYYY-MM-DD format
- faceBoundingBox: the bounding box around the person's photo/face on the passport page, as normalized coordinates from 0.0 to 1.0: { ymin, xmin, ymax, xmax }

Return valid JSON only — no markdown, no code fences, no extra text.`;

router.post("/passport/extract", async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  const { imageBase64, mimeType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 is required" });

  const config = await getAiConfig();
  const mime = (mimeType as string) || "image/jpeg";

  /* ── Gemini OCR ── */
  if (config.provider === "gemini") {
    if (!config.geminiKey) {
      return res.status(503).json({ error: "Gemini API key not configured. Add it in Settings → AI Integration or switch to Mistral." });
    }
    try {
      const genAI = new GoogleGenerativeAI(config.geminiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" },
      });
      const result = await model.generateContent([
        { inlineData: { data: imageBase64, mimeType: mime } },
        PASSPORT_PROMPT,
      ]);
      const text = result.response.text();
      try {
        return res.json(JSON.parse(text));
      } catch {
        return res.status(422).json({ error: "Could not parse AI response. Please try a clearer image." });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429") || msg.includes("quota")) {
        return res.status(429).json({ error: "Gemini quota reached. Switch to Mistral in Settings → AI Integration." });
      }
      if (msg.includes("API_KEY") || msg.includes("INVALID_ARGUMENT") || msg.includes("API key not valid")) {
        return res.status(503).json({ error: "Invalid Gemini API key. Please update it in Settings." });
      }
      return res.status(500).json({ error: "AI extraction failed. Please fill in the details manually." });
    }
  }

  /* ── Mistral OCR ── */
  if (!config.mistralKey) {
    return res.status(503).json({ error: "Mistral API key not configured. Add it in Settings → AI Integration." });
  }
  try {
    const client = new Mistral({ apiKey: config.mistralKey });

    const result = await client.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              imageUrl: `data:${mime};base64,${imageBase64}`,
            } as any,
            {
              type: "text",
              text: PASSPORT_PROMPT,
            },
          ],
        },
      ],
    });

    const raw = result.choices?.[0]?.message?.content ?? "";
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    try {
      return res.json(JSON.parse(cleaned));
    } catch {
      return res.status(422).json({ error: "Could not parse AI response. Please try a clearer image." });
    }
  } catch (err: any) {
    const msg = err?.message ?? "";
    req.log.error({ err }, "Mistral OCR error");
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("API key")) {
      return res.status(503).json({ error: "Invalid Mistral API key. Update it in Settings." });
    }
    if (msg.includes("429") || msg.includes("rate limit")) {
      return res.status(429).json({ error: "Mistral rate limit reached. Please try again shortly." });
    }
    return res.status(500).json({ error: "AI extraction failed. Please fill in the details manually." });
  }
});

export default router;
