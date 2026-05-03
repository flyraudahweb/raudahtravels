import { Link } from "wouter";
import { Phone, Mail, MapPin, ArrowRight } from "lucide-react";
import { SiFacebook, SiInstagram, SiX, SiYoutube, SiWhatsapp } from "react-icons/si";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const QUICK_LINKS = [
  { href: "/packages", label: "All Packages" },
  { href: "/packages?type=hajj", label: "Hajj 2026" },
  { href: "/packages?type=umrah", label: "Umrah Packages" },
  { href: "/about", label: "About Raudah" },
  { href: "/agent", label: "Become an Agent" },
  { href: "/dashboard", label: "Pilgrim Portal" },
];

const SUPPORT_LINKS = [
  { href: "/contact", label: "Contact Us" },
  { href: "/faq", label: "FAQs" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/dashboard/support", label: "Help Centre" },
];

const SOCIAL_DEFS = [
  { key: "facebook",  icon: SiFacebook,  label: "Facebook",   color: "hover:bg-[#1877F2]" },
  { key: "instagram", icon: SiInstagram, label: "Instagram",  color: "hover:bg-gradient-to-br hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF]" },
  { key: "twitter",   icon: SiX,         label: "X / Twitter", color: "hover:bg-black" },
  { key: "youtube",   icon: SiYoutube,   label: "YouTube",    color: "hover:bg-[#FF0000]" },
];

const DEF_CONTACT = {
  phone:    "+234 800 RAUDAH (728-324)",
  whatsapp: "2348001234567",
  email:    "info@raudahtravels.com",
  address:  "14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
};

const DEF_BADGES = [
  { icon: "🕌", label: "NAHCON Licensed" },
  { icon: "📋", label: "RC No. 1234567" },
  { icon: "🔐", label: "NIN Registered" },
  { icon: "⭐", label: "15+ Years Experience" },
  { icon: "🤝", label: "5,000+ Pilgrims Served" },
];

type SocialLinks  = Record<string, string>;
type ContactInfo  = { phone?: string; whatsapp?: string; email?: string; address?: string };
type Badge        = { icon: string; label: string };
type PubSettings  = { contact_info?: ContactInfo; social_links?: SocialLinks; trust_badges?: Badge[] };

export function Footer() {
  const [email, setEmail]       = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const { data: pub } = useQuery<PubSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const r = await fetch("/api/public/settings");
      return r.ok ? r.json() : {};
    },
    staleTime: 60_000,
  });

  const ci      = pub?.contact_info  ?? {};
  const sl      = pub?.social_links  ?? {};
  const badges  = pub?.trust_badges  ?? DEF_BADGES;

  const phone   = ci.phone    || DEF_CONTACT.phone;
  const whatsapp = ci.whatsapp || DEF_CONTACT.whatsapp;
  const emailAddr = ci.email  || DEF_CONTACT.email;
  const address = ci.address  || DEF_CONTACT.address;

  const socials = SOCIAL_DEFS.map(s => ({ ...s, href: sl[s.key] || "#" }));

  return (
    <footer className="relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #07093A 0%, #0D0F52 40%, #12145C 100%)" }}>

      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#2D3199]/25 rounded-full blur-[120px]" />
        <div className="absolute top-0 right-1/3 w-64 h-64 bg-[#FF3B00]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#2D3199]/20 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      </div>

      {/* Orange accent line */}
      <div className="relative h-1 w-full"
        style={{ background: "linear-gradient(90deg, transparent 0%, #FF3B00 30%, #FF6B00 70%, transparent 100%)" }} />

      {/* Main content */}
      <div className="relative container mx-auto px-4 md:px-8 pt-16 pb-10">

        {/* Top row */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 pb-14 border-b border-white/8">

          {/* Brand column */}
          <div className="lg:w-80 shrink-0">
            <Link href="/" className="inline-flex items-center mb-6 group">
              <img
                src="/logo.png"
                alt="Raudah Travels & Tours"
                className="h-12 w-auto object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </Link>

            <p className="text-white/55 text-sm leading-relaxed mb-6 max-w-xs">
              Nigeria's most trusted Hajj &amp; Umrah operator. NAHCON licensed, serving pilgrims
              nationwide with premium, spiritually enriching journeys since 2009.
            </p>

            {/* Dynamic contact details */}
            <div className="space-y-3">
              <a href={`tel:${phone.replace(/\s/g, "")}`}
                className="flex items-center gap-3 text-white/55 hover:text-white text-sm font-medium transition-colors group">
                <span className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0 group-hover:bg-[#2D3199]/50 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-[#FF3B00]" />
                </span>
                {phone}
              </a>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/55 hover:text-white text-sm font-medium transition-colors group">
                <span className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0 group-hover:bg-[#25D366]/20 transition-colors">
                  <SiWhatsapp className="w-3.5 h-3.5 text-[#25D366]" />
                </span>
                WhatsApp: +{whatsapp}
              </a>
              <a href={`mailto:${emailAddr}`}
                className="flex items-center gap-3 text-white/55 hover:text-white text-sm font-medium transition-colors group">
                <span className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0 group-hover:bg-[#2D3199]/50 transition-colors">
                  <Mail className="w-3.5 h-3.5 text-[#FF3B00]" />
                </span>
                {emailAddr}
              </a>
              <div className="flex items-start gap-3 text-white/55 text-sm">
                <span className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FF3B00]" />
                </span>
                {address}
              </div>
            </div>
          </div>

          {/* Links + Newsletter */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-10">

            {/* Quick Links */}
            <div>
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-5 flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#FF3B00] inline-block" />
                Packages
              </h3>
              <ul className="space-y-2.5">
                {QUICK_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="text-white/50 hover:text-white text-sm font-medium transition-colors flex items-center gap-2 group">
                      <span className="w-0 group-hover:w-3 overflow-hidden transition-all duration-200 shrink-0">
                        <ArrowRight className="w-3 h-3 text-[#FF3B00]" />
                      </span>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-5 flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#FF3B00] inline-block" />
                Support
              </h3>
              <ul className="space-y-2.5">
                {SUPPORT_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}
                      className="text-white/50 hover:text-white text-sm font-medium transition-colors flex items-center gap-2 group">
                      <span className="w-0 group-hover:w-3 overflow-hidden transition-all duration-200 shrink-0">
                        <ArrowRight className="w-3 h-3 text-[#FF3B00]" />
                      </span>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter + Social */}
            <div>
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-5 flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#FF3B00] inline-block" />
                Stay Updated
              </h3>
              <p className="text-white/45 text-xs leading-relaxed mb-4">
                Get early access to new packages, Hajj dates, and exclusive agent offers.
              </p>
              {subscribed ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-sm font-semibold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">✓</span>
                  You're subscribed!
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); if (email) setSubscribed(true); }}
                  className="flex flex-col gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/6 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#FF3B00]/50 focus:bg-white/8 transition-all"
                  />
                  <button type="submit"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF3B00] hover:bg-[#D63200] text-white text-sm font-bold rounded-xl transition-colors">
                    Subscribe <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {/* Dynamic social icons */}
              <div className="mt-6">
                <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-3">Follow Us</p>
                <div className="flex items-center gap-2">
                  {socials.map(({ icon: Icon, label, href, color }) => (
                    <a key={label} href={href} aria-label={label}
                      target={href !== "#" ? "_blank" : undefined}
                      rel={href !== "#" ? "noopener noreferrer" : undefined}
                      className={`w-9 h-9 rounded-xl bg-white/6 border border-white/8 flex items-center justify-center text-white/50 hover:text-white ${color} hover:border-transparent transition-all duration-200 hover:scale-110`}>
                      <Icon className="w-3.5 h-3.5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic trust badges */}
        <div className="flex flex-wrap items-center gap-3 py-8 border-b border-white/8">
          {badges.map((badge, i) => (
            <span key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/8 text-white/45 text-xs font-semibold">
              <span>{badge.icon}</span>
              {badge.label}
            </span>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-7">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Raudah Travels &amp; Tours Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-white/25">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
            <span>·</span>
            <Link href="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
          </div>
          <p className="text-white/20 text-[10px] tracking-wider">
            Made with <span className="text-[#FF3B00]">♥</span> for Nigerian Pilgrims
          </p>
        </div>
      </div>
    </footer>
  );
}
