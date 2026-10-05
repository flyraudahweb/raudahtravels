import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

async function request(method = "GET", body?: unknown, suffix = "") {
  const response = await fetch(`/api/admin/registration-settings${suffix}`, { method, credentials: "include",
    headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load registration settings");
  return data;
}
const fields = [
  ["whatsappPhoneNumberId", "WhatsApp phone number ID"], ["whatsappAccessToken", "WhatsApp access token", "secret"],
  ["whatsappAppSecret", "WhatsApp app secret", "secret"], ["whatsappVerifyToken", "WhatsApp verification token", "secret"],
  ["whatsappApiVersion", "WhatsApp API version"], ["whatsappReviewTemplate", "Approved review template name"],
  ["whatsappTemplateLanguage", "Template language (e.g. en)"], ["telegramBotToken", "Telegram bot token", "secret"],
  ["telegramWebhookSecret", "Telegram webhook secret", "secret"],
  ["geminiKey", "Gemini API key", "secret"], ["mistralKey", "Mistral API key", "secret"],
  ["r2AccountId", "Cloudflare R2 account ID"], ["r2BucketName", "Private passport bucket"],
  ["r2AccessKeyId", "R2 access key ID", "secret"], ["r2SecretAccessKey", "R2 secret access key", "secret"],
  ["geminiModel", "Gemini passport model"], ["mistralModel", "Mistral passport model"],
  ["sessionTtlHours", "Session expiry (hours)", "number"], ["rateLimitPerMin", "Messages per person per minute", "number"],
] as const;

export default function RegistrationAgentSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ["registration-settings"], queryFn: () => request(), retry: false });
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Array<{ integration: string; status: string; message: string }>>([]);
  useEffect(() => { if (data) setValues(data); }, [data]);
  if (isLoading) return <p>Loading registration settings…</p>;
  if (error) return <p className="text-sm text-red-700">{error.message}</p>;
  const save = async () => {
    setBusy(true);
    try {
      const payload = Object.fromEntries(fields.map(([key]) => [key, values[key]]));
      const next = await request("PUT", { ...payload, enabled: values.enabled, autoFallback: values.autoFallback });
      qc.setQueryData(["registration-settings"], next);
      setValues(next);
      setChecks([]);
      toast({ title: "Registration settings saved", description: "Changes take effect immediately. Empty secret fields keep the saved credential." });
    } catch (err) { toast({ title: "Could not save", description: (err as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const check = async () => {
    setBusy(true);
    try { const result = await request("POST", {}, "/check"); toast({ title: "Configuration checked", description: result.message }); }
    catch (err) { toast({ title: "Configuration needs attention", description: (err as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const testConnections = async () => {
    setBusy(true);
    setChecks([]);
    try { const result = await request("POST", {}, "/test-connections"); setChecks(result.checks); }
    catch (err) { toast({ title: "Connection checks failed", description: (err as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <div className="flex items-center gap-3"><Switch checked={!!values.enabled} onCheckedChange={enabled => setValues(v => ({ ...v, enabled }))} /><Label>Enable WhatsApp / Telegram registration</Label></div>
    <p className="text-sm text-slate-600">Credentials are encrypted and never displayed again. Leave a secret blank to keep it; enter a replacement to rotate it. Registration requires private passport storage.</p>
    {!data?.encryptionReady && <p className="text-sm text-amber-800">The server needs a persistent SETTINGS_ENCRYPTION_KEY before credentials can be saved. Ask your deployment administrator to configure it.</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map(([key, label, kind]) => <div key={key} className="space-y-1">
        <Label htmlFor={`registration-${key}`}>{label}</Label>
        <Input id={`registration-${key}`} type={kind === "secret" ? "password" : kind === "number" ? "number" : "text"}
          autoComplete={kind === "secret" ? "new-password" : "off"} value={values[key] ?? ""}
          placeholder={kind === "secret" && data?.[`${key}Set`] ? "Saved — enter only to replace" : undefined}
          min={kind === "number" ? 1 : undefined} max={key === "sessionTtlHours" ? 720 : key === "rateLimitPerMin" ? 300 : undefined}
          onChange={e => setValues(v => ({ ...v, [key]: kind === "number" ? Number(e.target.value) : e.target.value }))} />
      </div>)}
    </div>
    <div className="flex items-center gap-3"><Switch checked={!!values.autoFallback} onCheckedChange={autoFallback => setValues(v => ({ ...v, autoFallback }))} /><Label>Automatically fall back to Mistral</Label></div>
    <p className="text-xs text-slate-600">Gemini and Mistral keys entered here override the existing AI Integration keys. The WhatsApp review template must have two body parameters: outcome and booking reference/rejection reason.</p>
    <p className="text-xs text-slate-600">Create the private R2 bucket first and grant get, put, list and delete access. Once storage is configured, its location is fixed to preserve access to existing documents; credentials can be rotated.</p>
    <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={save}>Save registration settings</Button><Button variant="outline" disabled={busy} onClick={check}>Check saved configuration</Button><Button variant="outline" disabled={busy} onClick={testConnections}>Test provider connections</Button></div>
    {checks.length > 0 && <div className="space-y-2" aria-live="polite">{checks.map(check => <div key={check.integration} className={`rounded-lg border p-3 text-sm ${check.status === "passed" ? "border-green-200 bg-green-50" : check.status === "failed" ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}><p className="font-semibold">{check.integration}: {check.status.replaceAll("_", " ")}</p><p>{check.message}</p></div>)}</div>}
    <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-2">
      <p className="font-semibold">Testing and bulk registration</p>
      <p>Save credentials with registration disabled, then check the configuration. This checks required settings and database migrations; it does not verify credentials with the providers.</p>
      <p>Register these webhook URLs in Meta and Telegram, using the secret tokens saved above:</p>
      <p className="break-all">WhatsApp: {data?.webhookBaseUrl || window.location.origin}/api/whatsapp/webhook</p>
      <p className="break-all">Telegram: {data?.webhookBaseUrl || window.location.origin}/api/telegram/webhook</p>
      <p>Enable registration. In a private chat, send /start, then follow the name, phone, package, passport and confirmation prompts. Check AI Registrations for the pending draft and review it before approving.</p>
      <p>For a family or group, send /bulk 3 (2–20 pilgrims). Send one passport and confirm each pilgrim. The contact number and package are reused; each registration requires its own staff approval. Send /cancel to stop the current intake.</p>
      <p>Live chat testing creates real review drafts. Approval creates a real booking and uses package capacity. Use a dedicated test package and consenting testers; reject test drafts instead of approving them on production.</p>
    </div>
  </div>;
}
