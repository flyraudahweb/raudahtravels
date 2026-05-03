import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Star, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const HERO_IMG = "https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg";
const STORY_IMG = "https://images.pexels.com/photos/26436662/pexels-photo-26436662.jpeg";

const DEFAULT_STATS = [
  { val: "15+",    label: "Years of Service" },
  { val: "5,000+", label: "Pilgrims Served" },
  { val: "100%",   label: "Visa Success Rate" },
  { val: "4.9/5",  label: "Pilgrim Rating" },
];

const DEFAULT_TEAM = [
  { name: "Alhaji Kabiru Raudah",  role: "Founder & CEO",            photoUrl: "", initials: "KR" },
  { name: "Hajia Fatima Suleiman", role: "Head of Pilgrim Services",  photoUrl: "", initials: "FS" },
  { name: "Malam Ibrahim Yusuf",   role: "Hajj & Umrah Coordinator",  photoUrl: "", initials: "IY" },
  { name: "Amina Musa Bello",      role: "Operations Manager",        photoUrl: "", initials: "AB" },
];

const AVATAR_COLORS = [
  "from-[#2D3199] to-[#4C56B8]", "from-[#FF3B00] to-[#FF6B35]",
  "from-[#0EA5E9] to-[#2D3199]", "from-[#8134AF] to-[#DD2A7B]",
  "from-[#10B981] to-[#0EA5E9]", "from-[#F59E0B] to-[#FF3B00]",
];

const VALUES = [
  { icon: "🕌", title: "Faith First",          desc: "Every decision is grounded in Islamic values — honesty, trust, and sincerity in serving Allah's guests." },
  { icon: "⭐", title: "Excellence in Service", desc: "From booking to return, we deliver the highest standards of hospitality and logistical precision." },
  { icon: "🤝", title: "Community Trust",       desc: "Built on word-of-mouth referrals and repeat pilgrims. Our reputation is our most prized possession." },
  { icon: "📋", title: "Full Compliance",        desc: "NAHCON licensed and registered, we operate within all regulatory frameworks for Nigerian pilgrims." },
  { icon: "🌐", title: "End-to-End Support",     desc: "Visa processing, airline ticketing, hotels, ground transport, guided ziyarah — we handle it all." },
  { icon: "💰", title: "Fair & Transparent",     desc: "Clear pricing, no hidden charges, and flexible payment plans to make the sacred journey accessible." },
];

export default function About() {
  const { data: pub } = useQuery<Record<string, any>>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/public/settings").then(r => r.ok ? r.json() : {}),
    staleTime: 60_000,
  });

  const stats = (pub?.about_stats as typeof DEFAULT_STATS | undefined) ?? DEFAULT_STATS;
  const team  = (pub?.leadership_team as typeof DEFAULT_TEAM | undefined) ?? DEFAULT_TEAM;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">

      {/* ── HERO ── */}
      <section className="relative min-h-[60vh] flex flex-col overflow-hidden bg-[#1C1F66]">
        <img src={HERO_IMG} alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(135deg, rgba(13,15,78,0.88) 0%, rgba(45,49,153,0.60) 100%)" }} />

        <Navbar transparent />

        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="container mx-auto px-4 md:px-8 py-20 text-center max-w-3xl">
            <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white/90 text-xs font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-[#FF3B00] inline-block" />
              NAHCON Licensed · Est. 2009
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-6">
              About Raudah <span className="text-[#FF3B00]">Travels &amp; Tours</span>
            </h1>
            <p className="text-white/70 text-lg leading-relaxed max-w-2xl mx-auto">
              For over 15 years, we have guided Nigerian Muslims on their most sacred journey —
              with care, deep expertise, and unwavering faith.
            </p>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-16 bg-white border-b border-[#F1F5F9]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-3xl md:text-4xl font-black text-[#2D3199] leading-none mb-2">{s.val}</p>
                <p className="text-[#64748B] text-sm font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STORY ── */}
      <section className="py-24 bg-[#F8FAFC]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-5xl mx-auto">
            <div>
              <p className="text-[#2D3199] text-sm font-bold uppercase tracking-widest mb-3">Our Mission</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] mb-6 leading-tight">
                Making the Holy Journey{" "}
                <span className="text-[#FF3B00]">Accessible to Every Nigerian</span>
              </h2>
              <div className="space-y-4 text-[#475569] leading-relaxed text-[15px]">
                <p>
                  Raudah Travels &amp; Tours was founded with a single purpose: to make the spiritual
                  journey of Hajj and Umrah as smooth, affordable, and spiritually fulfilling as possible
                  for Nigerian Muslims.
                </p>
                <p>
                  We understand the deep significance of answering the call to the Holy Lands.
                  That is why we handle every logistical detail — from your Nigerian passport to
                  your hotel room in Makkah — so you can focus entirely on worship and connection
                  with Allah.
                </p>
                <p>
                  NAHCON licensed and serving pilgrims from across Nigeria, we combine deep
                  Islamic knowledge with world-class travel management.
                </p>
              </div>
              <div className="mt-8 space-y-3">
                {[
                  "NAHCON Licensed & Fully Compliant",
                  "100% Visa Success Rate",
                  "Serving pilgrims since 2009",
                  "Offices in Lagos, Abuja & Kano",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#2D3199] shrink-0" />
                    <span className="text-[#334155] text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden border-4 border-[#EEF0FF] shadow-[0_12px_60px_rgba(45,49,153,0.18)]">
                <img src={STORY_IMG} alt="Makkah Al-Mukarrama" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-[#2D3199] rounded-2xl p-5 shadow-2xl text-white text-center w-36">
                <p className="text-3xl font-black leading-none">15+</p>
                <p className="text-white/70 text-xs mt-1 font-medium">Years of Trust</p>
              </div>
              <div className="absolute -top-6 -left-6 w-36 h-36 bg-[#FF3B00]/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <p className="text-[#2D3199] text-sm font-bold uppercase tracking-widest mb-3">What Drives Us</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] mb-4">Our Core Values</h2>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#2D3199]" />
              <div className="w-2 h-2 rotate-45 bg-[#2D3199]" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#2D3199]" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {VALUES.map((v, i) => (
              <div key={i}
                className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#DCE3F0] hover:border-[#2D3199]/30 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(45,49,153,0.10)] transition-all">
                <div className="text-3xl mb-4">{v.icon}</div>
                <h3 className="text-base font-black text-[#0F172A] mb-2">{v.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEAM ── */}
      {team.length > 0 && (
        <section className="py-24 bg-[#F8FAFC]">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <p className="text-[#2D3199] text-sm font-bold uppercase tracking-widest mb-3">The People</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] mb-4">Our Leadership Team</h2>
              <p className="text-[#64748B] text-base leading-relaxed">
                Experienced professionals united by a shared commitment to serving Nigeria's pilgrims.
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {team.map((member, idx) => {
                const initials = member.initials || member.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <div key={member.name}
                    className="text-center p-6 rounded-2xl bg-white border border-[#DCE3F0] hover:shadow-[0_4px_24px_rgba(45,49,153,0.10)] transition-all">
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt={member.name}
                        className="w-20 h-20 rounded-3xl object-cover mx-auto mb-4 shadow-lg border-2 border-[#EEF0FF]" />
                    ) : (
                      <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${color} flex items-center justify-center text-2xl font-black text-white mx-auto mb-4 shadow-lg`}>
                        {initials}
                      </div>
                    )}
                    <h3 className="font-black text-[#0F172A] text-sm mb-1 leading-snug">{member.name}</h3>
                    <p className="text-[#2D3199] text-xs font-semibold">{member.role}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS TEASER ── */}
      <section className="relative py-20 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0D0F4E 0%, #1C1F66 45%, #12145C 100%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-80 h-80 bg-[#2D3199]/30 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#FF3B00]/15 rounded-full blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        </div>
        <div className="relative container mx-auto px-4 md:px-6 text-center max-w-2xl">
          <div className="inline-flex items-center gap-1.5 mb-5">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-[#FF3B00] text-[#FF3B00]" />)}
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Trusted by 5,000+ Nigerian Pilgrims
          </h2>
          <p className="text-white/60 text-lg leading-relaxed mb-10">
            "Raudah Travels made our Hajj journey completely stress-free. Every detail was handled
            perfectly. We will use them again, insha'Allah." — Alhaji Musa, Kano
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild
              className="bg-[#FF3B00] hover:bg-[#D63200] text-white font-bold text-base px-8 py-6 rounded-full shadow-cta hover:-translate-y-0.5 transition-all">
              <Link href="/packages" className="flex items-center gap-2">
                Explore Packages <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild
              className="border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white font-semibold px-8 py-6 rounded-full">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
