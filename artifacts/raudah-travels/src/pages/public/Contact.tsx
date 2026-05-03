import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, MessageCircle, Clock, Send, ArrowRight, CheckCircle2 } from "lucide-react";
import { SiFacebook, SiInstagram, SiX, SiYoutube } from "react-icons/si";
import { useQuery } from "@tanstack/react-query";

const HERO_IMG = "https://images.pexels.com/photos/34246939/pexels-photo-34246939.jpeg";

const SOCIAL_DEFS = [
  { key: "facebook",  icon: SiFacebook,  label: "Facebook",    color: "bg-[#1877F2]" },
  { key: "instagram", icon: SiInstagram, label: "Instagram",   color: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]" },
  { key: "twitter",   icon: SiX,         label: "X / Twitter", color: "bg-black" },
  { key: "youtube",   icon: SiYoutube,   label: "YouTube",     color: "bg-[#FF0000]" },
];

type FormState = { name: string; email: string; phone: string; subject: string; message: string };

export default function Contact() {
  const { data: pub } = useQuery<Record<string, any>>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const r = await fetch("/api/public/settings");
      return r.ok ? r.json() : {};
    },
    staleTime: 60_000,
  });

  const ci      = pub?.contact_info  ?? {};
  const sl      = pub?.social_links  ?? {};
  const phone   = ci.phone    || "+234 800 RAUDAH (728-324)";
  const whatsapp = ci.whatsapp || "2348001234567";
  const email   = ci.email    || "info@raudahtravels.com";
  const address = ci.address  || "14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria";

  const socials = SOCIAL_DEFS.map(s => ({ ...s, href: sl[s.key] || "#" }));

  const [form, setForm] = useState<FormState>({
    name: "", email: "", phone: "", subject: "General Enquiry", message: "",
  });
  const [sent, setSent] = useState(false);

  const setF = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, email: form.email || null, phone: form.phone || null, subject: form.subject, message: form.message }),
    }).catch(() => {});
    const text = encodeURIComponent(
      `Assalamu Alaikum! My name is ${form.name}.\nSubject: ${form.subject}\n\nMessage: ${form.message}\n\nPhone: ${form.phone || "—"}\nEmail: ${form.email || "—"}`
    );
    window.open(`https://wa.me/${whatsapp}?text=${text}`, "_blank");
    setSent(true);
  };

  const METHODS = [
    {
      icon: Phone,
      label: "Call Us",
      value: phone,
      sub: "Mon – Sat, 8am – 6pm",
      href: `tel:${phone.replace(/\s/g, "")}`,
      color: "bg-[#EEF0FF]",
      iconColor: "text-[#2D3199]",
      accent: "#2D3199",
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: `+${whatsapp}`,
      sub: "Quick responses",
      href: `https://wa.me/${whatsapp}`,
      color: "bg-[#F0FDF4]",
      iconColor: "text-[#25D366]",
      accent: "#25D366",
    },
    {
      icon: Mail,
      label: "Email Us",
      value: email,
      sub: "Reply within 24 hours",
      href: `mailto:${email}`,
      color: "bg-[#FFF4F1]",
      iconColor: "text-[#FF3B00]",
      accent: "#FF3B00",
    },
    {
      icon: MapPin,
      label: "Visit Our Office",
      value: address,
      sub: "Walk-in welcome",
      href: `https://maps.google.com/?q=${encodeURIComponent(address)}`,
      color: "bg-[#F8F0FF]",
      iconColor: "text-[#8134AF]",
      accent: "#8134AF",
    },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">

      {/* ── HERO ── */}
      <section className="relative min-h-[55vh] flex flex-col overflow-hidden bg-[#1C1F66]">
        <img src={HERO_IMG} alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(135deg, rgba(13,15,78,0.90) 0%, rgba(45,49,153,0.65) 100%)" }} />

        <Navbar transparent />

        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="container mx-auto px-4 md:px-8 py-20 text-center max-w-2xl">
            <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white/90 text-xs font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-[#FF3B00] inline-block" />
              We're Here to Help
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-5">
              Get in <span className="text-[#FF3B00]">Touch</span>
            </h1>
            <p className="text-white/70 text-lg leading-relaxed">
              Whether you have questions about packages, need help with a booking, or want to
              join us as an agent — our team is ready to assist.
            </p>
          </div>
        </div>
      </section>

      {/* ── CONTACT METHODS ── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {METHODS.map((m) => (
              <a key={m.label} href={m.href}
                target={m.href.startsWith("http") ? "_blank" : undefined}
                rel={m.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="group flex flex-col gap-4 p-6 rounded-2xl border border-[#DCE3F0] hover:border-[#2D3199]/30 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(45,49,153,0.12)] transition-all bg-white">
                <div className={`w-12 h-12 rounded-xl ${m.color} flex items-center justify-center`}>
                  <m.icon className={`w-5 h-5 ${m.iconColor}`} />
                </div>
                <div>
                  <p className="text-xs font-black text-[#94A3B8] uppercase tracking-widest mb-1">{m.label}</p>
                  <p className="text-sm font-bold text-[#0F172A] leading-snug group-hover:text-[#2D3199] transition-colors break-words">{m.value}</p>
                  <p className="text-xs text-[#94A3B8] mt-1">{m.sub}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM + HOURS ── */}
      <section className="py-8 pb-24 bg-[#F8FAFC]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 max-w-5xl mx-auto">

            {/* Form */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-[#DCE3F0] p-8">
              <div className="mb-8">
                <p className="text-[#2D3199] text-sm font-bold uppercase tracking-widest mb-1">Reach Out</p>
                <h2 className="text-2xl font-black text-[#0F172A]">Send Us a Message</h2>
                <p className="text-[#64748B] text-sm mt-1">We'll respond via WhatsApp within a few hours.</p>
              </div>

              {sent ? (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-[#0F172A] mb-1">Message Sent!</p>
                    <p className="text-[#64748B] text-sm">We've opened WhatsApp with your message. Jazakallahu Khayran.</p>
                  </div>
                  <Button onClick={() => setSent(false)} variant="outline" className="rounded-xl border-[#DCE3F0]">
                    Send Another
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1">Full Name *</label>
                      <input required value={form.name} onChange={setF("name")} placeholder="Alhaji Musa Abubakar"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#DCE3F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10 transition-all" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1">Phone Number</label>
                      <input value={form.phone} onChange={setF("phone")} placeholder="+234 800 000 0000" type="tel"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#DCE3F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1">Email Address</label>
                    <input value={form.email} onChange={setF("email")} placeholder="your@email.com" type="email"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#DCE3F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1">Subject *</label>
                    <select required value={form.subject} onChange={setF("subject")}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#DCE3F0] text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10 transition-all">
                      {["General Enquiry", "Hajj Package", "Umrah Package", "Visa Assistance", "Payment & Pricing", "Become an Agent", "Other"].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1">Message *</label>
                    <textarea required value={form.message} onChange={setF("message")} rows={5}
                      placeholder="Assalamu Alaikum! I would like to enquire about…"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#DCE3F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#2D3199] focus:ring-2 focus:ring-[#2D3199]/10 transition-all resize-none" />
                  </div>
                  <Button type="submit"
                    className="w-full bg-[#FF3B00] hover:bg-[#D63200] text-white font-bold py-6 rounded-xl gap-2 shadow-[0_4px_20px_rgba(255,59,0,0.35)] hover:-translate-y-0.5 transition-all">
                    <Send className="w-4 h-4" /> Send via WhatsApp
                  </Button>
                  <p className="text-xs text-[#94A3B8] text-center">
                    Your message will open in WhatsApp for a fast, personal response.
                  </p>
                </form>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">

              {/* Office Hours */}
              <div className="bg-white rounded-2xl border border-[#DCE3F0] p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-[#EEF0FF] flex items-center justify-center">
                    <Clock className="w-4.5 h-4.5 text-[#2D3199]" />
                  </div>
                  <h3 className="font-black text-[#0F172A] text-sm">Office Hours</h3>
                </div>
                <div className="space-y-2.5">
                  {[
                    { days: "Monday – Friday", hours: "8:00 AM – 6:00 PM" },
                    { days: "Saturday",         hours: "9:00 AM – 4:00 PM" },
                    { days: "Sunday",            hours: "Closed" },
                  ].map((row) => (
                    <div key={row.days} className="flex items-center justify-between text-sm">
                      <span className="text-[#64748B] font-medium">{row.days}</span>
                      <span className={`font-bold ${row.hours === "Closed" ? "text-red-400" : "text-[#0F172A]"}`}>{row.hours}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-[#F1F5F9]">
                  <p className="text-xs text-[#64748B]">
                    <span className="text-[#25D366] font-bold">WhatsApp</span> is available outside office hours for urgent queries.
                  </p>
                </div>
              </div>

              {/* Social Links */}
              <div className="bg-white rounded-2xl border border-[#DCE3F0] p-6">
                <h3 className="font-black text-[#0F172A] text-sm mb-4">Follow Us</h3>
                <div className="grid grid-cols-2 gap-3">
                  {socials.map(({ icon: Icon, label, href, color }) => (
                    <a key={label} href={href}
                      target={href !== "#" ? "_blank" : undefined}
                      rel={href !== "#" ? "noopener noreferrer" : undefined}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${color} text-white text-xs font-bold hover:opacity-90 hover:scale-[1.02] transition-all`}>
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Quick CTA */}
              <div className="rounded-2xl p-6 text-white"
                style={{ background: "linear-gradient(135deg, #2D3199 0%, #4C56B8 100%)" }}>
                <p className="font-black text-base mb-2">Ready to Book?</p>
                <p className="text-white/70 text-sm mb-5 leading-relaxed">
                  Browse our Hajj and Umrah packages and secure your spot today.
                </p>
                <Button asChild
                  className="w-full bg-[#FF3B00] hover:bg-[#D63200] text-white font-bold rounded-xl gap-2">
                  <Link href="/packages" className="flex items-center gap-2">
                    View Packages <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
