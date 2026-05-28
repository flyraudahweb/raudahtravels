import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, Phone, Mail, MapPin, MessageCircle, Globe, CreditCard, Save, CheckCircle2, Copy, Check, Eye, EyeOff, ExternalLink, Video, Layout, Plus, Trash2, Users, BarChart2, Image, Sparkles, Send, Loader2, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function fetchSettings(): Promise<{ settings: Record<string, any> }> {
  const r = await fetch("/api/admin/settings", { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function fetchConfig(): Promise<{ paystackPublicKey: string; webhookUrl: string }> {
  const r = await fetch("/api/config");
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function saveSetting(key: string, value: any): Promise<any> {
  const r = await fetch(`/api/admin/settings/${key}`, {
    method: "PUT", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#F1F5F9] bg-[#F8FAFF]">
        <div className="w-8 h-8 rounded-xl bg-[#EEF0FF] flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#2D3199]" />
        </div>
        <h2 className="font-black text-[#0F172A] text-base">{title}</h2>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="shrink-0 p-2 rounded-lg hover:bg-[#EEF0FF] transition-colors text-[#64748B] hover:text-[#2D3199]"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

export default function AdminSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saved, setSaved] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["admin-settings"], queryFn: fetchSettings });
  const { data: configData } = useQuery({ queryKey: ["app-config"], queryFn: fetchConfig, staleTime: 30000 });
  const settings = data?.settings || {};

  const [contact, setContact] = useState({ phone: "", email: "", address: "", whatsapp: "" });
  const [social, setSocial] = useState({ facebook: "", instagram: "", twitter: "", whatsapp_url: "", youtube: "" });
  const [paystackEnabled, setPaystackEnabled] = useState(true);
  const [emailProvider, setEmailProvider] = useState<"smtp" | "resend">("smtp");
  const [smtp, setSmtp] = useState({ host: "smtp.gmail.com", port: "587", user: "", pass: "", secure: false, fromName: "Raudah Travels & Tours", fromEmail: "" });
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [resendApiKey, setResendApiKey] = useState("");
  const [resendFromEmail, setResendFromEmail] = useState("");
  const [showResendKey, setShowResendKey] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailStatus, setTestEmailStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  const [paystackPublicKey, setPaystackPublicKey] = useState("");
  const [paystackSecretKey, setPaystackSecretKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [aiProvider, setAiProvider] = useState<"gemini" | "mistral">("gemini");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [mistralApiKey, setMistralApiKey] = useState("");
  const [showMistralKey, setShowMistralKey] = useState(false);
  const [landingVideoUrl, setLandingVideoUrl] = useState("");
  const [trustBadges, setTrustBadges] = useState<Array<{ icon: string; label: string }>>([
    { icon: "🕌", label: "NAHCON Licensed" },
    { icon: "📋", label: "RC No. 1234567" },
    { icon: "🔐", label: "NIN Registered" },
    { icon: "⭐", label: "15+ Years Experience" },
    { icon: "🤝", label: "5,000+ Pilgrims Served" },
  ]);
  const [landingStats, setLandingStats] = useState([
    { val: "4.9 / 5", label: "Average Rating" },
    { val: "2,400+",  label: "Happy Pilgrims" },
    { val: "8 yrs",   label: "Trusted Since 2016" },
    { val: "100%",    label: "Visa Success Rate" },
  ]);
  const [aboutStats, setAboutStats] = useState([
    { val: "15+",    label: "Years of Service" },
    { val: "5,000+", label: "Pilgrims Served" },
    { val: "100%",   label: "Visa Success Rate" },
    { val: "4.9/5",  label: "Pilgrim Rating" },
  ]);
  const [leadershipTeam, setLeadershipTeam] = useState<Array<{ name: string; role: string; photoUrl: string; initials: string }>>([
    { name: "Alhaji Kabiru Raudah",  role: "Founder & CEO",           photoUrl: "", initials: "KR" },
    { name: "Hajia Fatima Suleiman", role: "Head of Pilgrim Services", photoUrl: "", initials: "FS" },
    { name: "Malam Ibrahim Yusuf",   role: "Hajj & Umrah Coordinator", photoUrl: "", initials: "IY" },
    { name: "Amina Musa Bello",      role: "Operations Manager",       photoUrl: "", initials: "AB" },
  ]);

  const [roomSurcharges, setRoomSurcharges] = useState({ single: 0, double: 0, triple: 0, quad: 0, quint: 0 });
  const [childInfantPricing, setChildInfantPricing] = useState({ childPrice: 0, infantPrice: 0 });

  useEffect(() => {
    if (!settings) return;
    if (settings.contact_info) setContact({ phone: settings.contact_info.phone || "", email: settings.contact_info.email || "", address: settings.contact_info.address || "", whatsapp: settings.contact_info.whatsapp || "" });
    if (settings.social_links) setSocial(s => ({ ...s, ...settings.social_links }));
    if (settings.paystack_enabled !== undefined) setPaystackEnabled(!!settings.paystack_enabled);
    if (settings.email_provider) setEmailProvider(settings.email_provider);
    if (settings.paystack_public_key) setPaystackPublicKey(settings.paystack_public_key);
    if (settings.ai_provider) setAiProvider(settings.ai_provider as "gemini" | "mistral");
    if (settings.gemini_api_key_set) setGeminiApiKey(settings.gemini_api_key as string ?? "");
    if (settings.mistral_api_key_set) setMistralApiKey(settings.mistral_api_key as string ?? "");
    if (settings.landing_video_url) setLandingVideoUrl(settings.landing_video_url as string);
    if (settings.trust_badges) setTrustBadges(settings.trust_badges as any);
    if (settings.landing_stats) setLandingStats(settings.landing_stats as any);
    if (settings.about_stats) setAboutStats(settings.about_stats as any);
    if (settings.leadership_team) setLeadershipTeam(settings.leadership_team as any);
    if (settings.resend_api_key_set) setResendApiKey(settings.resend_api_key as string ?? "");
    if (settings.resend_from_email) setResendFromEmail(settings.resend_from_email as string);
    if (settings.email_provider) setEmailProvider(settings.email_provider as "smtp" | "resend");
    if (settings.smtp_host) setSmtp(s => ({ ...s, host: settings.smtp_host as string }));
    if (settings.smtp_port) setSmtp(s => ({ ...s, port: settings.smtp_port as string }));
    if (settings.smtp_user) setSmtp(s => ({ ...s, user: settings.smtp_user as string, fromEmail: settings.smtp_user as string }));
    if (settings.smtp_from_name) setSmtp(s => ({ ...s, fromName: settings.smtp_from_name as string }));
    if (settings.smtp_from_email) setSmtp(s => ({ ...s, fromEmail: settings.smtp_from_email as string }));
    if (settings.smtp_secure !== undefined) setSmtp(s => ({ ...s, secure: !!settings.smtp_secure }));
    if (settings.room_surcharges) setRoomSurcharges(settings.room_surcharges as any);
    if (settings.child_infant_pricing) setChildInfantPricing(settings.child_infant_pricing as any);
  }, [data]);

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) => saveSetting(key, value),
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["app-config"] });
      setSaved(key); setTimeout(() => setSaved(null), 2000);
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const sendTestEmail = async () => {
    if (!testEmailTo) return;
    setTestEmailStatus("sending");
    try {
      const r = await fetch("/api/admin/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to: testEmailTo }),
      });
      const data = await r.json();
      if (r.ok && data.success) {
        setTestEmailStatus("ok");
        toast({ title: "Test email sent!", description: `Check the inbox of ${testEmailTo}` });
      } else {
        setTestEmailStatus("error");
        toast({ title: "Test failed", description: data.error ?? "Email not sent. Check your settings.", variant: "destructive" });
      }
    } catch {
      setTestEmailStatus("error");
      toast({ title: "Test failed", description: "Network error — server may be restarting.", variant: "destructive" });
    }
    setTimeout(() => setTestEmailStatus("idle"), 4000);
  };

  const webhookUrl = configData?.webhookUrl ?? "";

  const currentPublicKey = configData?.paystackPublicKey ?? settings.paystack_public_key ?? "";
  const keyMode = currentPublicKey.startsWith("pk_live") ? "live" : currentPublicKey.startsWith("pk_test") ? "test" : null;

  const savePaystackKeys = () => {
    const ops: Promise<any>[] = [];
    if (paystackPublicKey && paystackPublicKey !== settings.paystack_public_key) {
      ops.push(saveSetting("paystack_public_key", paystackPublicKey));
    }
    if (paystackSecretKey && !paystackSecretKey.includes("••")) {
      ops.push(saveSetting("paystack_secret_key", paystackSecretKey));
    }
    if (ops.length === 0) { toast({ title: "No changes to save" }); return; }
    Promise.all(ops).then(() => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["app-config"] });
      setSaved("paystack_keys");
      setTimeout(() => setSaved(null), 2000);
      setPaystackSecretKey("");
      toast({ title: "Paystack keys updated", description: "Changes take effect immediately." });
    }).catch(() => toast({ title: "Failed to save keys", variant: "destructive" }));
  };

  if (isLoading) return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-white rounded-2xl border border-[#DCE3F0] animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="page-admin-settings">
      <div>
        <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">System</p>
        <h1 className="text-2xl font-black text-[#0F172A]">Settings</h1>
        <p className="text-[#64748B] text-sm mt-0.5">Configure site-wide settings and preferences</p>
      </div>

      <Section title="Contact Information" icon={Phone}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 mb-1"><Phone className="w-3 h-3" /> Phone</Label>
            <Input value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} placeholder="+234 803 537 8973" className="rounded-xl" />
          </div>
          <div>
            <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 mb-1"><Mail className="w-3 h-3" /> Email</Label>
            <Input value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} placeholder="flyraudah@gmail.com" className="rounded-xl" />
          </div>
          <div>
            <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 mb-1"><MapPin className="w-3 h-3" /> Address</Label>
            <Input value={contact.address} onChange={e => setContact(c => ({ ...c, address: e.target.value }))} placeholder="Kano, Nigeria" className="rounded-xl" />
          </div>
          <div>
            <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 mb-1"><MessageCircle className="w-3 h-3" /> WhatsApp (digits only)</Label>
            <Input value={contact.whatsapp} onChange={e => setContact(c => ({ ...c, whatsapp: e.target.value }))} placeholder="2348035378973" className="rounded-xl" />
          </div>
        </div>
        <div className="pt-2">
          <Button onClick={() => save.mutate({ key: "contact_info", value: contact })} disabled={save.isPending} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
            {saved === "contact_info" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved === "contact_info" ? "Saved!" : "Save Contact Info"}
          </Button>
        </div>
      </Section>

      <Section title="Social Links" icon={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "facebook", label: "Facebook URL" },
            { key: "instagram", label: "Instagram URL" },
            { key: "twitter", label: "Twitter/X URL" },
            { key: "whatsapp_url", label: "WhatsApp URL" },
            { key: "youtube", label: "YouTube URL" },
          ].map(({ key, label }) => (
            <div key={key}>
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">{label}</Label>
              <Input value={(social as any)[key] || ""} onChange={e => setSocial(s => ({ ...s, [key]: e.target.value }))} placeholder="https://..." className="rounded-xl" />
            </div>
          ))}
        </div>
        <div className="pt-2">
          <Button onClick={() => save.mutate({ key: "social_links", value: social })} disabled={save.isPending} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
            {saved === "social_links" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved === "social_links" ? "Saved!" : "Save Social Links"}
          </Button>
        </div>
      </Section>

      <Section title="Payment Gateway — Paystack" icon={CreditCard}>
        <div className="flex items-center justify-between p-4 bg-[#F8FAFF] rounded-xl border border-[#DCE3F0]">
          <div>
            <p className="font-bold text-[#0F172A] text-sm">Online Payments</p>
            <p className="text-xs text-[#64748B] mt-0.5">When disabled, only bank transfer is shown to pilgrims</p>
          </div>
          <Switch
            checked={paystackEnabled}
            onCheckedChange={v => {
              setPaystackEnabled(v);
              save.mutate({ key: "paystack_enabled", value: v });
            }}
          />
        </div>
        <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${paystackEnabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {paystackEnabled ? "✓ Online card payments are enabled" : "⚠ Only manual bank transfers are accepted"}
        </div>

        <div className="border-t border-[#F1F5F9] pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-[#0F172A]">API Keys</p>
            {keyMode === "test" && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">TEST MODE</Badge>}
            {keyMode === "live" && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">LIVE MODE</Badge>}
          </div>
          <p className="text-xs text-[#64748B]">
            Keys saved here take priority over environment variables. Switch from test to live keys when going to production.
          </p>

          <div>
            <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Public Key</Label>
            <Input
              value={paystackPublicKey}
              onChange={e => setPaystackPublicKey(e.target.value)}
              placeholder="pk_test_… or pk_live_…"
              className="rounded-xl font-mono text-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Secret Key</Label>
            <div className="relative flex items-center">
              <Input
                type={showSecret ? "text" : "password"}
                value={paystackSecretKey}
                onChange={e => setPaystackSecretKey(e.target.value)}
                placeholder={settings.paystack_secret_key_set ? settings.paystack_secret_key : "sk_test_… or sk_live_…"}
                className="rounded-xl font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                className="absolute right-3 text-[#64748B] hover:text-[#2D3199]"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {settings.paystack_secret_key_set && (
              <p className="text-xs text-[#64748B] mt-1">
                Current: <span className="font-mono">{settings.paystack_secret_key}</span>
                {settings.paystack_secret_key_source === "env" && " (from environment variable)"}
              </p>
            )}
          </div>

          <Button
            onClick={savePaystackKeys}
            disabled={save.isPending}
            className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2"
          >
            {saved === "paystack_keys" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved === "paystack_keys" ? "Keys Saved!" : "Save API Keys"}
          </Button>
        </div>

        {webhookUrl && (
          <div className="border-t border-[#F1F5F9] pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-[#0F172A]">Webhook URL</p>
              <a
                href="https://dashboard.paystack.com/#/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#2D3199] flex items-center gap-1 hover:underline"
              >
                Open Paystack Dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-[#64748B]">
              Add this URL in your Paystack dashboard under Settings → API Keys & Webhooks. Required for automatic booking confirmation when pilgrims pay online.
            </p>
            <div className="flex items-center gap-2 bg-[#F8FAFF] border border-[#DCE3F0] rounded-xl px-4 py-3">
              <code className="text-xs font-mono text-[#2D3199] flex-1 break-all">{webhookUrl}</code>
              <CopyButton value={webhookUrl} />
            </div>
          </div>
        )}
      </Section>

      <Section title="AI Integration" icon={Sparkles}>
        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-[#F8FAFF] rounded-xl border border-[#DCE3F0]">
          <div className="w-8 h-8 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-[#2D3199]" />
          </div>
          <div>
            <p className="font-bold text-[#0F172A] text-sm">Passport OCR &amp; AI Chat Assistant</p>
            <p className="text-xs text-[#64748B] mt-0.5">
              Powers passport auto-fill and the admin AI chat assistant. Choose your AI provider below — you can switch anytime without losing your keys.
            </p>
          </div>
        </div>

        {/* Provider toggle */}
        <div>
          <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2 block">Active Provider</Label>
          <div className="flex rounded-xl border border-[#DCE3F0] overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => {
                setAiProvider("gemini");
                save.mutate({ key: "ai_provider", value: "gemini" }, {
                  onSuccess: () => toast({ title: "Switched to Gemini" }),
                });
              }}
              className={`px-5 py-2 text-sm font-semibold transition-colors ${
                aiProvider === "gemini"
                  ? "bg-[#2D3199] text-white"
                  : "bg-white text-[#64748B] hover:bg-[#F8FAFF]"
              }`}
            >
              Gemini
            </button>
            <button
              type="button"
              onClick={() => {
                setAiProvider("mistral");
                save.mutate({ key: "ai_provider", value: "mistral" }, {
                  onSuccess: () => toast({ title: "Switched to Mistral" }),
                });
              }}
              className={`px-5 py-2 text-sm font-semibold transition-colors border-l border-[#DCE3F0] ${
                aiProvider === "mistral"
                  ? "bg-[#2D3199] text-white"
                  : "bg-white text-[#64748B] hover:bg-[#F8FAFF]"
              }`}
            >
              Mistral
            </button>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1.5">
            {aiProvider === "gemini"
              ? "Using Google Gemini 2.0 Flash for chat and passport OCR."
              : "Using Mistral Small (vision) for chat and passport OCR."}
          </p>
        </div>

        {/* Gemini key */}
        <div className={`space-y-2 transition-opacity ${aiProvider === "gemini" ? "opacity-100" : "opacity-50"}`}>
          <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Gemini API Key</Label>
          <div className="relative flex items-center">
            <Input
              type={showGeminiKey ? "text" : "password"}
              value={geminiApiKey}
              onChange={e => setGeminiApiKey(e.target.value)}
              placeholder={settings.gemini_api_key_set ? settings.gemini_api_key as string : "AIzaSy…"}
              className="rounded-xl font-mono text-sm pr-10"
            />
            <button type="button" onClick={() => setShowGeminiKey(v => !v)} className="absolute right-3 text-[#64748B] hover:text-[#2D3199]">
              {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {settings.gemini_api_key_set
            ? <p className="text-xs text-[#64748B]">Current: <span className="font-mono">{settings.gemini_api_key as string}</span> — stored securely.</p>
            : <p className="text-xs text-amber-600 font-medium">⚠ No Gemini key set.</p>}
          <p className="text-xs text-[#94A3B8]">
            Free key at{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[#2D3199] hover:underline font-medium">
              aistudio.google.com <ExternalLink className="inline w-3 h-3" />
            </a>
          </p>
          <Button
            onClick={() => {
              if (!geminiApiKey || geminiApiKey.includes("••")) { toast({ title: "No changes to save" }); return; }
              save.mutate({ key: "gemini_api_key", value: geminiApiKey }, {
                onSuccess: () => {
                  setSaved("gemini_api_key");
                  setTimeout(() => setSaved(null), 2000);
                  setGeminiApiKey("");
                  toast({ title: "Gemini API key saved" });
                },
              });
            }}
            disabled={save.isPending}
            className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2"
          >
            {saved === "gemini_api_key" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved === "gemini_api_key" ? "Key Saved!" : "Save Gemini Key"}
          </Button>
        </div>

        {/* Divider */}
        <div className="border-t border-[#DCE3F0]" />

        {/* Mistral key */}
        <div className={`space-y-2 transition-opacity ${aiProvider === "mistral" ? "opacity-100" : "opacity-50"}`}>
          <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Mistral API Key</Label>
          <div className="relative flex items-center">
            <Input
              type={showMistralKey ? "text" : "password"}
              value={mistralApiKey}
              onChange={e => setMistralApiKey(e.target.value)}
              placeholder={settings.mistral_api_key_set ? settings.mistral_api_key as string : "…"}
              className="rounded-xl font-mono text-sm pr-10"
            />
            <button type="button" onClick={() => setShowMistralKey(v => !v)} className="absolute right-3 text-[#64748B] hover:text-[#2D3199]">
              {showMistralKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {settings.mistral_api_key_set
            ? <p className="text-xs text-[#64748B]">Current: <span className="font-mono">{settings.mistral_api_key as string}</span> — stored securely.</p>
            : <p className="text-xs text-amber-600 font-medium">⚠ No Mistral key set.</p>}
          <p className="text-xs text-[#94A3B8]">
            Free key at{" "}
            <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#2D3199] hover:underline font-medium">
              console.mistral.ai <ExternalLink className="inline w-3 h-3" />
            </a>
          </p>
          <Button
            onClick={() => {
              if (!mistralApiKey || mistralApiKey.includes("••")) { toast({ title: "No changes to save" }); return; }
              save.mutate({ key: "mistral_api_key", value: mistralApiKey }, {
                onSuccess: () => {
                  setSaved("mistral_api_key");
                  setTimeout(() => setSaved(null), 2000);
                  setMistralApiKey("");
                  toast({ title: "Mistral API key saved" });
                },
              });
            }}
            disabled={save.isPending}
            className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2"
          >
            {saved === "mistral_api_key" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved === "mistral_api_key" ? "Key Saved!" : "Save Mistral Key"}
          </Button>
        </div>
      </Section>

      <Section title="Landing Page Edits" icon={Layout}>
        {/* Hero Video URL */}
        <div>
          <p className="font-bold text-[#0F172A] text-sm mb-1">Hero Section Video</p>
          <p className="text-xs text-[#64748B] mb-3">
            Replaces the route map on the homepage. Paste a YouTube or Vimeo URL — it will autoplay muted on loop.
          </p>
          <div className="flex gap-2">
            <span className="flex items-center px-3 bg-[#F8FAFC] border border-[#DCE3F0] rounded-xl">
              <Video className="w-4 h-4 text-[#2D3199]" />
            </span>
            <Input
              value={landingVideoUrl}
              onChange={e => setLandingVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…  or  https://vimeo.com/…"
              className="rounded-xl flex-1"
            />
          </div>
          {landingVideoUrl && (
            <p className="text-xs text-emerald-600 mt-1.5 font-medium">✓ Video URL set — will autoplay on the homepage hero.</p>
          )}
        </div>
        <div className="pt-1">
          <Button onClick={() => save.mutate({ key: "landing_video_url", value: landingVideoUrl })} disabled={save.isPending} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
            {saved === "landing_video_url" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved === "landing_video_url" ? "Saved!" : "Save Video URL"}
          </Button>
        </div>

        {/* Trust Badges */}
        <div className="border-t border-[#F1F5F9] pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-[#0F172A] text-sm">Trust Badges</p>
              <p className="text-xs text-[#64748B] mt-0.5">Certifications shown in the site footer.</p>
            </div>
            <Button
              size="sm" variant="outline"
              onClick={() => setTrustBadges(b => [...b, { icon: "⭐", label: "New Badge" }])}
              className="rounded-xl gap-1.5 border-[#DCE3F0] text-[#2D3199] hover:bg-[#EEF0FF]"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {trustBadges.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={badge.icon}
                  onChange={e => setTrustBadges(b => b.map((x, i) => i === idx ? { ...x, icon: e.target.value } : x))}
                  className="w-14 rounded-xl text-center text-xl shrink-0"
                  maxLength={4}
                />
                <Input
                  value={badge.label}
                  onChange={e => setTrustBadges(b => b.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                  className="rounded-xl flex-1"
                  placeholder="Badge text"
                />
                <button
                  onClick={() => setTrustBadges(b => b.filter((_, i) => i !== idx))}
                  className="p-2 rounded-xl hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="pt-1">
            <Button onClick={() => save.mutate({ key: "trust_badges", value: trustBadges })} disabled={save.isPending} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
              {saved === "trust_badges" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved === "trust_badges" ? "Saved!" : "Save Badges"}
            </Button>
          </div>
        </div>
      </Section>

      {/* ── Landing Page Stats ──────────────────────────────────────────── */}
      <Section title="Landing Page Stats" icon={BarChart2}>
        <p className="text-xs text-[#64748B]">These 4 stats appear in the testimonials section of the homepage.</p>
        <div className="space-y-2">
          {landingStats.map((stat, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={stat.val}
                onChange={e => setLandingStats(s => s.map((x, i) => i === idx ? { ...x, val: e.target.value } : x))}
                className="w-28 rounded-xl font-bold text-center shrink-0"
                placeholder="4.9 / 5"
              />
              <Input
                value={stat.label}
                onChange={e => setLandingStats(s => s.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                className="rounded-xl flex-1"
                placeholder="Label"
              />
            </div>
          ))}
        </div>
        <Button onClick={() => save.mutate({ key: "landing_stats", value: landingStats })} disabled={save.isPending} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
          {saved === "landing_stats" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved === "landing_stats" ? "Saved!" : "Save Landing Stats"}
        </Button>
      </Section>

      {/* ── About Page Stats ────────────────────────────────────────────── */}
      <Section title="About Page Stats" icon={BarChart2}>
        <p className="text-xs text-[#64748B]">These 4 stats appear at the top of the About Us page.</p>
        <div className="space-y-2">
          {aboutStats.map((stat, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={stat.val}
                onChange={e => setAboutStats(s => s.map((x, i) => i === idx ? { ...x, val: e.target.value } : x))}
                className="w-28 rounded-xl font-bold text-center shrink-0"
                placeholder="15+"
              />
              <Input
                value={stat.label}
                onChange={e => setAboutStats(s => s.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                className="rounded-xl flex-1"
                placeholder="Label"
              />
            </div>
          ))}
        </div>
        <Button onClick={() => save.mutate({ key: "about_stats", value: aboutStats })} disabled={save.isPending} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
          {saved === "about_stats" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved === "about_stats" ? "Saved!" : "Save About Stats"}
        </Button>
      </Section>

      {/* ── Leadership Team ─────────────────────────────────────────────── */}
      <Section title="Leadership Team" icon={Users}>
        <p className="text-xs text-[#64748B]">
          Team members shown on the About page. Add a photo URL for a real photo, or leave blank for an initials avatar.
        </p>
        <div className="space-y-4">
          {leadershipTeam.map((member, idx) => (
            <div key={idx} className="bg-[#F8FAFC] rounded-2xl border border-[#DCE3F0] p-4 space-y-3">
              <div className="flex items-center gap-3">
                {member.photoUrl ? (
                  <img src={member.photoUrl} alt={member.name}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-[#EEF0FF] shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-[#EEF0FF] flex items-center justify-center text-[#2D3199] font-black text-sm shrink-0">
                    {member.initials || member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0F172A] text-sm truncate">{member.name || "New Member"}</p>
                  <p className="text-xs text-[#64748B] truncate">{member.role || "Role"}</p>
                </div>
                <button
                  onClick={() => setLeadershipTeam(t => t.filter((_, i) => i !== idx))}
                  className="p-2 rounded-xl hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Full Name</Label>
                  <Input value={member.name}
                    onChange={e => setLeadershipTeam(t => t.map((x, i) => i === idx ? { ...x, name: e.target.value, initials: e.target.value.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() } : x))}
                    placeholder="Alhaji Kabiru Raudah" className="rounded-xl text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Role / Title</Label>
                  <Input value={member.role}
                    onChange={e => setLeadershipTeam(t => t.map((x, i) => i === idx ? { ...x, role: e.target.value } : x))}
                    placeholder="Founder & CEO" className="rounded-xl text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Image className="w-3 h-3" /> Photo URL (optional)
                </Label>
                <Input value={member.photoUrl}
                  onChange={e => setLeadershipTeam(t => t.map((x, i) => i === idx ? { ...x, photoUrl: e.target.value } : x))}
                  placeholder="https://example.com/photo.jpg — leave blank for initials avatar"
                  className="rounded-xl text-sm" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button
            size="sm" variant="outline"
            onClick={() => setLeadershipTeam(t => [...t, { name: "", role: "", photoUrl: "", initials: "" }])}
            className="rounded-xl gap-1.5 border-[#DCE3F0] text-[#2D3199] hover:bg-[#EEF0FF]"
          >
            <Plus className="w-3.5 h-3.5" /> Add Member
          </Button>
          <Button onClick={() => save.mutate({ key: "leadership_team", value: leadershipTeam })} disabled={save.isPending} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
            {saved === "leadership_team" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved === "leadership_team" ? "Saved!" : "Save Team"}
          </Button>
        </div>
      </Section>

      {/* ── Pricing Config ──────────────────────────────────────────────── */}
      <Section title="Pricing Configuration" icon={Coins}>
        <div className="space-y-6">
          <div>
            <p className="font-bold text-[#0F172A] text-sm mb-1">Room Surcharges (₦)</p>
            <p className="text-xs text-[#64748B] mb-4">
              Extra charge applied to a booking based on the room preference.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {["single", "double", "triple", "quad", "quint"].map((roomType) => (
                <div key={roomType}>
                  <Label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">
                    {roomType}
                  </Label>
                  <Input
                    type="number"
                    value={(roomSurcharges as any)[roomType]}
                    onChange={e => setRoomSurcharges(s => ({ ...s, [roomType]: Number(e.target.value) || 0 }))}
                    className="rounded-xl text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="pt-3">
              <Button onClick={() => save.mutate({ key: "room_surcharges", value: roomSurcharges })} disabled={save.isPending} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
                {saved === "room_surcharges" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved === "room_surcharges" ? "Saved!" : "Save Room Prices"}
              </Button>
            </div>
          </div>

          <div className="border-t border-[#F1F5F9] pt-5">
            <p className="font-bold text-[#0F172A] text-sm mb-1">Child / Infant Pricing (₦)</p>
            <p className="text-xs text-[#64748B] mb-4">
              Extra charge applied to a booking if the pilgrim is a child (2-11) or infant (0-1).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <div>
                <Label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">
                  Child Price
                </Label>
                <Input
                  type="number"
                  value={childInfantPricing.childPrice}
                  onChange={e => setChildInfantPricing(s => ({ ...s, childPrice: Number(e.target.value) || 0 }))}
                  className="rounded-xl text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">
                  Infant Price
                </Label>
                <Input
                  type="number"
                  value={childInfantPricing.infantPrice}
                  onChange={e => setChildInfantPricing(s => ({ ...s, infantPrice: Number(e.target.value) || 0 }))}
                  className="rounded-xl text-sm"
                />
              </div>
            </div>
            <div className="pt-3">
              <Button onClick={() => save.mutate({ key: "child_infant_pricing", value: childInfantPricing })} disabled={save.isPending} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2">
                {saved === "child_infant_pricing" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved === "child_infant_pricing" ? "Saved!" : "Save Child/Infant Prices"}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Email" icon={Mail}>
        <p className="text-xs text-[#64748B] leading-relaxed">
          Choose how to send branded payment receipt emails. <strong>Gmail SMTP</strong> is the default and works with any Gmail or Google Workspace account. Switch to <strong>Resend</strong> for better deliverability and 3,000 free emails/month.
        </p>

        {/* Provider toggle */}
        <div className="flex gap-2 p-1 bg-[#F1F5F9] rounded-xl w-fit">
          <button
            onClick={() => setEmailProvider("smtp")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${emailProvider === "smtp" ? "bg-white text-[#2D3199] shadow-sm" : "text-[#64748B] hover:text-[#2D3199]"}`}
          >
            Gmail SMTP
          </button>
          <button
            onClick={() => setEmailProvider("resend")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${emailProvider === "resend" ? "bg-white text-[#2D3199] shadow-sm" : "text-[#64748B] hover:text-[#2D3199]"}`}
          >
            Resend
          </button>
        </div>

        {/* Gmail SMTP fields */}
        {emailProvider === "smtp" && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 leading-relaxed">
              Need help setting this up? See <strong>docs/GMAIL_SMTP_SETUP.md</strong> for a full step-by-step guide including how to create a Gmail App Password.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">SMTP Host</Label>
                <Input value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} placeholder="smtp.gmail.com" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Port</Label>
                <Input value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: e.target.value }))} placeholder="587" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Gmail Address</Label>
                <Input value={smtp.user} onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))} placeholder="team@flyraudah.com.ng" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">App Password</Label>
                <div className="relative">
                  <Input
                    type={showSmtpPass ? "text" : "password"}
                    value={smtp.pass}
                    onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))}
                    placeholder="16-character App Password"
                    className="rounded-xl pr-10"
                  />
                  <button type="button" onClick={() => setShowSmtpPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#2D3199]">
                    {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">From Name</Label>
                <Input value={smtp.fromName} onChange={e => setSmtp(s => ({ ...s, fromName: e.target.value }))} placeholder="Raudah Travels & Tours" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">From Email</Label>
                <Input value={smtp.fromEmail} onChange={e => setSmtp(s => ({ ...s, fromEmail: e.target.value }))} placeholder="no-reply@flyraudah.com.ng" className="rounded-xl" />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-[#F8FAFF] rounded-xl border border-[#DCE3F0]">
              <Switch checked={smtp.secure} onCheckedChange={v => setSmtp(s => ({ ...s, secure: v }))} />
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Use SSL/TLS (port 465)</p>
                <p className="text-xs text-[#64748B]">Leave off for Gmail — Gmail uses STARTTLS on port 587.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={save.isPending}
                className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2"
                onClick={() => {
                  [
                    { key: "email_provider", value: "smtp" },
                    { key: "smtp_host", value: smtp.host },
                    { key: "smtp_port", value: smtp.port },
                    { key: "smtp_user", value: smtp.user },
                    ...(smtp.pass ? [{ key: "smtp_pass", value: smtp.pass }] : []),
                    { key: "smtp_secure", value: smtp.secure },
                    { key: "smtp_from_name", value: smtp.fromName },
                    { key: "smtp_from_email", value: smtp.fromEmail },
                  ].forEach(({ key, value }) => save.mutate({ key, value }));
                }}
              >
                {saved === "email_provider" || saved?.startsWith("smtp") ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved === "email_provider" || saved?.startsWith("smtp") ? "Saved!" : "Save Gmail SMTP"}
              </Button>
            </div>

            <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Send Test Email</p>
              <div className="flex gap-2">
                <Input
                  value={testEmailTo}
                  onChange={e => setTestEmailTo(e.target.value)}
                  placeholder="your@email.com"
                  className="rounded-xl flex-1"
                  type="email"
                />
                <Button
                  disabled={!testEmailTo || testEmailStatus === "sending"}
                  variant="outline"
                  className="rounded-xl border-[#2D3199] text-[#2D3199] gap-2 shrink-0"
                  onClick={sendTestEmail}
                >
                  {testEmailStatus === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   testEmailStatus === "ok" ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                   <Send className="w-4 h-4" />}
                  {testEmailStatus === "sending" ? "Sending…" : testEmailStatus === "ok" ? "Sent!" : "Send Test"}
                </Button>
              </div>
              <p className="text-xs text-[#94A3B8]">Save your settings first, then send a test to confirm emails are working.</p>
            </div>
          </div>
        )}

        {/* Resend fields */}
        {emailProvider === "resend" && (
          <div className="space-y-4">
            <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-700 leading-relaxed">
              Get a free API key at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">resend.com</a> — 3,000 emails/month free. Better deliverability than Gmail SMTP.
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Resend API Key</Label>
              <div className="relative">
                <Input
                  type={showResendKey ? "text" : "password"}
                  value={resendApiKey}
                  onChange={e => setResendApiKey(e.target.value)}
                  placeholder="re_••••••••••••••••••••••••"
                  className="rounded-xl pr-10 font-mono text-sm"
                />
                <button type="button" onClick={() => setShowResendKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#2D3199]">
                  {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-[#94A3B8]">Starts with <span className="font-mono">re_</span> — find it in your Resend Dashboard under API Keys.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">From Address</Label>
              <Input
                value={resendFromEmail}
                onChange={e => setResendFromEmail(e.target.value)}
                placeholder="Raudah Travels & Tours <noreply@yourdomain.com>"
                className="rounded-xl"
              />
              <p className="text-xs text-[#94A3B8]">
                Leave blank to use <span className="font-mono">onboarding@resend.dev</span> (for testing).
                For production, add your domain in Resend Dashboard and use <span className="font-mono">noreply@yourdomain.com</span>.
              </p>
            </div>

            <Button
              disabled={save.isPending || !resendApiKey}
              className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl gap-2"
              onClick={() => {
                save.mutate({ key: "email_provider", value: "resend" });
                save.mutate({ key: "resend_api_key", value: resendApiKey });
                if (resendFromEmail) save.mutate({ key: "resend_from_email", value: resendFromEmail });
              }}
            >
              {saved === "resend_api_key" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved === "resend_api_key" ? "Saved!" : "Save Resend Settings"}
            </Button>

            <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Send Test Email</p>
              <div className="flex gap-2">
                <Input
                  value={testEmailTo}
                  onChange={e => setTestEmailTo(e.target.value)}
                  placeholder="your@email.com"
                  className="rounded-xl flex-1"
                  type="email"
                />
                <Button
                  disabled={!testEmailTo || testEmailStatus === "sending"}
                  variant="outline"
                  className="rounded-xl border-[#2D3199] text-[#2D3199] gap-2 shrink-0"
                  onClick={sendTestEmail}
                >
                  {testEmailStatus === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   testEmailStatus === "ok" ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                   <Send className="w-4 h-4" />}
                  {testEmailStatus === "sending" ? "Sending…" : testEmailStatus === "ok" ? "Sent!" : "Send Test"}
                </Button>
              </div>
              <p className="text-xs text-[#94A3B8]">Save your settings first, then send a test to confirm emails are working.</p>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
