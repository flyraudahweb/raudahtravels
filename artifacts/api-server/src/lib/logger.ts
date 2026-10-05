import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers['x-telegram-bot-api-secret-token']",
    "req.body",
    "res.headers['set-cookie']",
    // PII redaction for AI registration channels
    "req.body.entry",
    "req.body.messages",
    "req.body.text",
    "req.body.image",
    "req.body.document",
    "collectedData",
    "extractionResult",
    "snapshot",
    "passportNumber",
    "passport_number",
    "ninNumber",
    "nin_number",
    "phone",
    "email",
    "dateOfBirth",
    "date_of_birth",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
