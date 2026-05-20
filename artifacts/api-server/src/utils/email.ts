import nodemailer from "nodemailer";
// Note: We use the Resend REST API directly (not the SDK) to avoid Node.js fetch encoding issues
import { db } from "@workspace/db";
import { siteSettingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

type EmailProvider = "smtp" | "resend";

interface EmailConfig {
  provider: EmailProvider;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
  };
  resendKey?: string;
  resendFrom?: string;
}

async function getEmailConfig(): Promise<EmailConfig | null> {
  try {
    const rows = await db.select().from(siteSettingsTable).where(
      inArray(siteSettingsTable.key, [
        "email_provider",
        "smtp_host", "smtp_port", "smtp_user", "smtp_pass",
        "smtp_secure", "smtp_from_name", "smtp_from_email",
        "resend_api_key", "resend_from_email",
      ])
    );

    // The value column is jsonb — values may be raw strings, JSON-encoded strings,
    // booleans, or numbers.  Unwrap any JSON string wrapping.
    function unwrap(v: unknown): string {
      if (v === null || v === undefined) return "";
      if (typeof v === "string") return v;
      return String(v);
    }

    const m = Object.fromEntries(rows.map(r => [r.key, r.value]));

    const provider: EmailProvider = (unwrap(m.email_provider) as EmailProvider) || "smtp";

    if (provider === "resend") {
      // Strip any non-ASCII / invisible chars that sneak in via copy-paste in the admin UI
      const resendKey = unwrap(m.resend_api_key).replace(/[^\x20-\x7E]/g, "").trim();
      if (!resendKey) {
        logger.warn("Resend selected but no API key found in settings");
        return null;
      }
      const resendFrom = unwrap(m.resend_from_email).replace(/[^\x20-\x7E]/g, "").trim() || "Raudah Travels <onboarding@resend.dev>";
      logger.info({ provider, resendFrom, keyPrefix: resendKey.substring(0, 8) + "..." }, "Email config loaded (Resend)");
      return { provider, resendKey, resendFrom };
    }

    // Default: SMTP
    const host = unwrap(m.smtp_host);
    const user = unwrap(m.smtp_user);
    const pass = unwrap(m.smtp_pass);
    if (!host || !user || !pass) {
      logger.warn({ host: !!host, user: !!user, pass: !!pass }, "SMTP selected but missing credentials");
      return null;
    }

    return {
      provider,
      smtp: {
        host,
        port: m.smtp_port ? parseInt(unwrap(m.smtp_port)) : 587,
        secure: m.smtp_secure === true || unwrap(m.smtp_secure) === "true",
        user,
        pass,
        fromName: unwrap(m.smtp_from_name) || "Raudah Travels & Tours",
        fromEmail: unwrap(m.smtp_from_email) || user,
      },
    };
  } catch (err) {
    logger.error({ err }, "Failed to load email config from database");
    return null;
  }
}

async function sendViaSMTP(cfg: NonNullable<EmailConfig["smtp"]>, opts: {
  to: string; subject: string; html: string; text?: string;
}): Promise<boolean> {
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  return true;
}

async function sendViaResend(apiKey: string, from: string, opts: {
  to: string; subject: string; html: string; text?: string;
}): Promise<boolean> {
  // Use Node.js https module directly — bypasses undici/fetch bytestring encoding issues entirely
  const https = await import("https");

  const payload = JSON.stringify({
    from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    ...(opts.text ? { text: opts.text } : {}),
  });

  const data = Buffer.from(payload, "utf-8");

  logger.info({ from, to: opts.to, subject: opts.subject }, "Resend: calling REST API via https");

  return new Promise<boolean>((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": data.length,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        res.on("end", () => {
          try {
            const result = JSON.parse(body);
            logger.info({ status: res.statusCode, resendResult: body }, "Resend: API response");

            if (res.statusCode && res.statusCode >= 400) {
              const msg = result?.message || result?.error?.message || body;
              reject(new Error(`Resend API error (${res.statusCode}): ${msg}`));
              return;
            }

            if (!result.id) {
              logger.warn({ result }, "Resend: no email ID in response");
            }
            resolve(true);
          } catch (e) {
            reject(new Error(`Resend: failed to parse response: ${body}`));
          }
        });
      }
    );

    req.on("error", (err: Error) => {
      logger.error({ err }, "Resend: HTTPS request failed");
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  throwOnError?: boolean;
}): Promise<boolean> {
  const cfg = await getEmailConfig();
  if (!cfg) {
    const msg = "Email not sent: no email provider configured in Settings";
    logger.warn({ to: opts.to }, msg);
    if (opts.throwOnError) throw new Error(msg);
    return false;
  }
  try {
    if (cfg.provider === "resend" && cfg.resendKey) {
      // Ensure from address is properly formatted and ASCII-safe
      let from = cfg.resendFrom ?? "onboarding@resend.dev";
      // If it's just a plain email (no display name), add one
      if (!from.includes("<")) {
        from = `Raudah Travels <${from}>`;
      }
      // Strip any non-ASCII characters that break byte-string encoding
      from = from.replace(/[^\x00-\xFF]/g, "");
      logger.info({ to: opts.to, from, provider: "resend" }, "Attempting to send email via Resend");
      await sendViaResend(cfg.resendKey, from, opts);
    } else if (cfg.provider === "smtp" && cfg.smtp) {
      await sendViaSMTP(cfg.smtp, opts);
    } else {
      const msg = `Email provider "${cfg.provider}" is selected but not properly configured`;
      if (opts.throwOnError) throw new Error(msg);
      return false;
    }
    logger.info({ to: opts.to, subject: opts.subject, provider: cfg.provider }, "Email sent");
    return true;
  } catch (err: any) {
    logger.error({ err, to: opts.to, provider: cfg.provider }, "Email send failed");
    if (opts.throwOnError) throw err;
    return false;
  }
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Raudah Travels &amp; Tours</title>
</head>
<body style="margin:0;padding:0;background:#F0F2FF;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0F2FF;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
      <tr>
        <td style="background:linear-gradient(135deg,#1C1F66 0%,#2D3199 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">Raudah Travels &amp; Tours</p>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.5px;text-transform:uppercase;">Nigeria's Most Trusted Pilgrimage Partner</p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
          ${content}
        </td>
      </tr>
      <tr>
        <td style="background:#1C1F66;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;line-height:1.6;">
            &copy; ${new Date().getFullYear()} Raudah Travels &amp; Tours &bull; All rights reserved<br/>
            This email was sent by Raudah Travels &amp; Tours. Do not share sensitive information in reply to this email.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export interface ReceiptData {
  pilgrimName: string;
  email: string;
  bookingRef?: string;
  packageName?: string;
  amount: number;
  method: string;
  reference?: string;
  date?: Date;
}

export function buildReceiptEmail(data: ReceiptData): string {
  const fmt = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
  const amountStr = fmt.format(data.amount);
  const dateStr = (data.date ?? new Date()).toLocaleDateString("en-NG", { day: "2-digit", month: "long", year: "numeric" });
  const methodLabel = data.method === "paystack" ? "Online (Paystack)" : data.method === "bank_transfer" ? "Bank Transfer" : data.method;

  const rows = [
    ["Pilgrim Name", data.pilgrimName],
    data.bookingRef ? ["Booking Reference", data.bookingRef] : null,
    data.packageName ? ["Package", data.packageName] : null,
    ["Amount Paid", `<span style="color:#FF3B00;font-weight:800;">${amountStr}</span>`],
    ["Payment Method", methodLabel],
    data.reference ? ["Transaction Reference", data.reference] : null,
    ["Payment Date", dateStr],
    ["Status", `<span style="background:#DCFCE7;color:#16A34A;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;">CONFIRMED</span>`],
  ].filter(Boolean) as [string, string][];

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#64748B;font-size:13px;font-weight:600;width:40%;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;color:#0F172A;font-size:13px;font-weight:500;">${value}</td>
    </tr>`).join("");

  const content = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:#DCFCE7;border-radius:50%;width:64px;height:64px;line-height:64px;text-align:center;margin-bottom:16px;">
        <span style="font-size:28px;">✓</span>
      </div>
      <h1 style="margin:0 0 8px;color:#0F172A;font-size:24px;font-weight:800;">Payment Confirmed!</h1>
      <p style="margin:0;color:#64748B;font-size:15px;">As-salamu alaykum, ${data.pilgrimName}. Your payment has been received and your booking is confirmed.</p>
    </div>
    <div style="background:#F8FAFF;border-radius:12px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 16px;color:#2D3199;font-size:12px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Payment Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>
    </div>
    <div style="background:linear-gradient(135deg,#FFF7F5 0%,#FFF0EC 100%);border:1px solid #FFDDD5;border-radius:12px;padding:20px;text-align:center;margin-bottom:28px;">
      <p style="margin:0;color:#FF3B00;font-size:28px;font-weight:800;">${amountStr}</p>
      <p style="margin:4px 0 0;color:#64748B;font-size:13px;">Total Amount Paid</p>
    </div>
    <p style="color:#64748B;font-size:14px;line-height:1.6;text-align:center;margin:0;">
      Jazakallah Khayran for choosing Raudah Travels &amp; Tours for your pilgrimage journey.<br/>
      Our team will be in touch with further details about your booking.<br/><br/>
      For support, contact us at <a href="mailto:support@flyraudah.com.ng" style="color:#2D3199;font-weight:600;">support@flyraudah.com.ng</a>
    </p>`;

  return emailWrapper(content);
}

export async function sendPaymentReceipt(data: ReceiptData): Promise<boolean> {
  return sendEmail({
    to: data.email,
    subject: `Payment Confirmed — ${data.bookingRef ?? "Your Booking"} | Raudah Travels & Tours`,
    html: buildReceiptEmail(data),
    text: `As-salamu alaykum ${data.pilgrimName}, your payment of ₦${data.amount.toLocaleString()} has been confirmed. Booking ref: ${data.bookingRef ?? "N/A"}. Thank you for choosing Raudah Travels & Tours.`,
  });
}

export function buildLoginOtpEmail(name: string, otp: string, role: string): string {
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Agent";
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:16px;background:#EEF0FF;margin-bottom:16px;">
        <span style="font-size:28px;">🔐</span>
      </div>
      <h1 style="margin:0 0 8px;color:#0F172A;font-size:22px;font-weight:800;">Verification Code</h1>
      <p style="margin:0;color:#64748B;font-size:14px;">As-salamu alaykum, ${name}. Use the code below to access your ${roleLabel} portal.</p>
    </div>
    <div style="background:#F8FAFF;border:2px solid #C7CBF5;border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
      <p style="margin:0 0 8px;color:#2D3199;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">Your One-Time Code</p>
      <p style="margin:0;font-size:44px;font-weight:900;letter-spacing:12px;color:#1C1F66;font-family:'Courier New',monospace;">${otp}</p>
      <p style="margin:12px 0 0;color:#94A3B8;font-size:12px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
    </div>
    <div style="background:#FFF7F5;border:1px solid #FFDDD5;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#FF3B00;font-size:12px;font-weight:700;">⚠️ Security Notice</p>
      <p style="margin:6px 0 0;color:#64748B;font-size:12px;line-height:1.6;">
        Raudah Travels staff will <strong>never</strong> ask for this code. If you did not request this, please ignore this email and contact support immediately.
      </p>
    </div>
    <p style="color:#64748B;font-size:13px;line-height:1.6;text-align:center;margin:0;">
      For support, contact us at <a href="mailto:support@flyraudah.com.ng" style="color:#2D3199;font-weight:600;">support@flyraudah.com.ng</a>
    </p>`;
  return emailWrapper(content);
}

export interface LoginAlertData {
  name: string;
  email: string;
  role: string;
  ipAddress?: string;
  time: Date;
}

export function buildLoginAlertEmail(data: LoginAlertData): string {
  const roleLabel = data.role === "super_admin" ? "Super Admin" : data.role === "admin" ? "Admin" : "Agent";
  const timeStr = data.time.toLocaleString("en-NG", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:16px;background:#FEF3C7;margin-bottom:16px;">
        <span style="font-size:28px;">🔔</span>
      </div>
      <h1 style="margin:0 0 8px;color:#0F172A;font-size:22px;font-weight:800;">New Sign-In Detected</h1>
      <p style="margin:0;color:#64748B;font-size:14px;">As-salamu alaykum, ${data.name}. A new sign-in was detected on your <strong>${roleLabel}</strong> account.</p>
    </div>
    <div style="background:#F8FAFF;border-radius:16px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;color:#64748B;font-size:13px;font-weight:600;width:40%;">Account</td>
          <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;color:#0F172A;font-size:13px;font-weight:600;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;color:#64748B;font-size:13px;font-weight:600;">Role</td>
          <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;color:#0F172A;font-size:13px;font-weight:600;">${roleLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;color:#64748B;font-size:13px;font-weight:600;">Time</td>
          <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;color:#0F172A;font-size:13px;">${timeStr}</td>
        </tr>
        ${data.ipAddress ? `
        <tr>
          <td style="padding:8px 0;color:#64748B;font-size:13px;font-weight:600;">IP Address</td>
          <td style="padding:8px 0;color:#0F172A;font-size:13px;">${data.ipAddress}</td>
        </tr>` : ""}
      </table>
    </div>
    <div style="background:#FFF7F5;border:1px solid #FFDDD5;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#FF3B00;font-size:12px;font-weight:700;">Don't recognize this sign-in?</p>
      <p style="margin:6px 0 0;color:#64748B;font-size:12px;line-height:1.6;">
        If you did not sign in, your account may be compromised. Please contact Raudah Travels support immediately to secure your account.
      </p>
    </div>
    <p style="color:#64748B;font-size:13px;line-height:1.6;text-align:center;margin:0;">
      For support, contact us at <a href="mailto:support@flyraudah.com.ng" style="color:#2D3199;font-weight:600;">support@flyraudah.com.ng</a>
    </p>`;
  return emailWrapper(content);
}

export async function sendLoginOtp(to: string, name: string, otp: string, role: string): Promise<boolean> {
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Agent";
  return sendEmail({
    to,
    subject: `${otp} — Your ${roleLabel} Verification Code | Raudah Travels & Tours`,
    html: buildLoginOtpEmail(name, otp, role),
    text: `Your Raudah Travels ${roleLabel} portal verification code is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
  });
}

export async function sendLoginAlert(data: LoginAlertData): Promise<boolean> {
  const roleLabel = data.role === "super_admin" ? "Super Admin" : data.role === "admin" ? "Admin" : "Agent";
  return sendEmail({
    to: data.email,
    subject: `New Sign-In to Your ${roleLabel} Account | Raudah Travels & Tours`,
    html: buildLoginAlertEmail(data),
    text: `As-salamu alaykum ${data.name}, a new sign-in was detected on your ${roleLabel} account at ${data.time.toISOString()}. If you did not sign in, contact support immediately.`,
  });
}

// ── Agent Approval Emails ─────────────────────────────────────────────────────

export interface AgentApprovalData {
  agentName: string;
  businessName: string;
  email: string;
  loginEmail: string;
  tempPassword?: string;
  agentCode: string;
  isExistingUser: boolean;
  loginUrl?: string;
}

function buildNewAgentEmail(data: AgentApprovalData): string {
  const loginUrl = data.loginUrl || "https://flyraudah.com.ng/sign-in";
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:16px;background:#DCFCE7;margin-bottom:16px;">
        <span style="font-size:28px;">🎉</span>
      </div>
      <h1 style="margin:0 0 8px;color:#0F172A;font-size:22px;font-weight:800;">Welcome to Raudah Travels!</h1>
      <p style="margin:0;color:#64748B;font-size:14px;">As-salamu alaykum, ${data.agentName}. Your agent application has been <strong style="color:#16A34A;">approved</strong>!</p>
    </div>
    <div style="background:#F8FAFF;border:2px solid #C7CBF5;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 16px;color:#2D3199;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Your Agent Login Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;width:40%;">Business Name</td>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;font-weight:700;">${data.businessName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;">Agent Code</td>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#2D3199;font-size:14px;font-weight:800;letter-spacing:1px;">${data.agentCode}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;">Email</td>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;font-weight:600;">${data.loginEmail}</td>
        </tr>
        ${data.tempPassword ? `
        <tr>
          <td style="padding:8px 0;color:#64748B;font-size:13px;font-weight:600;">Temporary Password</td>
          <td style="padding:8px 0;color:#FF3B00;font-size:14px;font-weight:800;font-family:'Courier New',monospace;">${data.tempPassword}</td>
        </tr>` : ""}
      </table>
    </div>
    ${data.tempPassword ? `
    <div style="background:#FFF7F5;border:1px solid #FFDDD5;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#FF3B00;font-size:12px;font-weight:700;">⚠️ Important</p>
      <p style="margin:6px 0 0;color:#64748B;font-size:12px;line-height:1.6;">
        Please change your password after your first login. Do <strong>not</strong> share your login credentials with anyone.
      </p>
    </div>` : ""}
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#2D3199 0%,#4C56B8 100%);color:#ffffff;font-size:14px;font-weight:800;padding:14px 40px;border-radius:12px;text-decoration:none;">Sign In to Agent Portal</a>
    </div>
    <p style="color:#64748B;font-size:13px;line-height:1.6;text-align:center;margin:0;">
      You can now register clients, manage bookings, and earn commissions through your agent portal.<br/><br/>
      For support, contact us at <a href="mailto:support@flyraudah.com.ng" style="color:#2D3199;font-weight:600;">support@flyraudah.com.ng</a>
    </p>`;
  return emailWrapper(content);
}

function buildExistingUserPromotionEmail(data: AgentApprovalData): string {
  const loginUrl = data.loginUrl || "https://flyraudah.com.ng/sign-in";
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:16px;background:#EEF0FF;margin-bottom:16px;">
        <span style="font-size:28px;">🚀</span>
      </div>
      <h1 style="margin:0 0 8px;color:#0F172A;font-size:22px;font-weight:800;">You're Now a Raudah Agent!</h1>
      <p style="margin:0;color:#64748B;font-size:14px;">As-salamu alaykum, ${data.agentName}. Your application has been <strong style="color:#16A34A;">approved</strong> and your account has been upgraded to Agent.</p>
    </div>
    <div style="background:#F8FAFF;border:2px solid #C7CBF5;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 16px;color:#2D3199;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Your Agent Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;width:40%;">Business Name</td>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;font-weight:700;">${data.businessName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;">Agent Code</td>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#2D3199;font-size:14px;font-weight:800;letter-spacing:1px;">${data.agentCode}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748B;font-size:13px;font-weight:600;">Login</td>
          <td style="padding:8px 0;color:#0F172A;font-size:13px;font-weight:600;">Use your existing credentials</td>
        </tr>
      </table>
    </div>
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#16A34A;font-size:12px;font-weight:700;">✅ No new password needed</p>
      <p style="margin:6px 0 0;color:#64748B;font-size:12px;line-height:1.6;">
        Since you already have an account with us, simply sign in with your <strong>existing email and password</strong>. You'll be redirected to the Agent Portal automatically.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#2D3199 0%,#4C56B8 100%);color:#ffffff;font-size:14px;font-weight:800;padding:14px 40px;border-radius:12px;text-decoration:none;">Go to Agent Portal</a>
    </div>
    <p style="color:#64748B;font-size:13px;line-height:1.6;text-align:center;margin:0;">
      You can now register clients, manage bookings, and earn commissions through your agent portal.<br/><br/>
      For support, contact us at <a href="mailto:support@flyraudah.com.ng" style="color:#2D3199;font-weight:600;">support@flyraudah.com.ng</a>
    </p>`;
  return emailWrapper(content);
}

export async function sendAgentApprovalEmail(data: AgentApprovalData): Promise<boolean> {
  const html = data.isExistingUser
    ? buildExistingUserPromotionEmail(data)
    : buildNewAgentEmail(data);

  const subject = data.isExistingUser
    ? `You're Now a Raudah Agent! 🎉 | Raudah Travels & Tours`
    : `Agent Account Approved — Your Login Details | Raudah Travels & Tours`;

  const textBody = data.isExistingUser
    ? `As-salamu alaykum ${data.agentName}, congratulations! Your agent application for "${data.businessName}" has been approved. Your agent code is ${data.agentCode}. Sign in with your existing credentials at https://flyraudah.com.ng/sign-in`
    : `As-salamu alaykum ${data.agentName}, your agent application for "${data.businessName}" has been approved! Your agent code is ${data.agentCode}. Login: ${data.loginEmail}${data.tempPassword ? `, Temp Password: ${data.tempPassword}` : ""}. Sign in at https://flyraudah.com.ng/sign-in`;

  return sendEmail({ to: data.email, subject, html, text: textBody });
}

// ── Staff Welcome / Onboarding Email ─────────────────────────────────────────

export interface StaffWelcomeData {
  name: string;
  email: string;
  role: string;
  tempPassword: string;
  loginUrl?: string;
}

function buildStaffWelcomeEmail(data: StaffWelcomeData): string {
  const loginUrl = data.loginUrl || "https://flyraudah.com.ng/sign-in";
  const roleLabel = data.role === "admin" ? "Admin" : "Staff";
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:16px;background:#DCFCE7;margin-bottom:16px;">
        <span style="font-size:28px;">🎉</span>
      </div>
      <h1 style="margin:0 0 8px;color:#0F172A;font-size:22px;font-weight:800;">Welcome to the Team!</h1>
      <p style="margin:0;color:#64748B;font-size:14px;">As-salamu alaykum, ${data.name}. You've been added as <strong style="color:#2D3199;">${roleLabel}</strong> on Raudah Travels.</p>
    </div>
    <div style="background:#F8FAFF;border:2px solid #C7CBF5;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 16px;color:#2D3199;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Your Login Details</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;width:40%;">Role</td>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#2D3199;font-size:14px;font-weight:800;">${roleLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-weight:600;">Email</td>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;font-weight:600;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748B;font-size:13px;font-weight:600;">Temporary Password</td>
          <td style="padding:8px 0;color:#FF3B00;font-size:14px;font-weight:800;font-family:'Courier New',monospace;">${data.tempPassword}</td>
        </tr>
      </table>
    </div>
    <div style="background:#FFF7F5;border:1px solid #FFDDD5;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#FF3B00;font-size:12px;font-weight:700;">⚠️ Important</p>
      <p style="margin:6px 0 0;color:#64748B;font-size:12px;line-height:1.6;">
        Please change your password after your first login. Do <strong>not</strong> share your login credentials with anyone.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#2D3199 0%,#4C56B8 100%);color:#ffffff;font-size:14px;font-weight:800;padding:14px 40px;border-radius:12px;text-decoration:none;">Sign In to Dashboard</a>
    </div>
    <p style="color:#64748B;font-size:13px;line-height:1.6;text-align:center;margin:0;">
      You now have access to the admin dashboard based on your assigned permissions.<br/><br/>
      For support, contact us at <a href="mailto:support@flyraudah.com.ng" style="color:#2D3199;font-weight:600;">support@flyraudah.com.ng</a>
    </p>`;
  return emailWrapper(content);
}

export async function sendStaffWelcomeEmail(data: StaffWelcomeData): Promise<boolean> {
  const roleLabel = data.role === "admin" ? "Admin" : "Staff";
  return sendEmail({
    to: data.email,
    subject: `Welcome to Raudah Travels — Your ${roleLabel} Account is Ready`,
    html: buildStaffWelcomeEmail(data),
    text: `As-salamu alaykum ${data.name}, you've been added as ${roleLabel} on Raudah Travels. Login: ${data.email}, Temp Password: ${data.tempPassword}. Sign in at https://flyraudah.com.ng/sign-in and change your password after first login.`,
  });
}
