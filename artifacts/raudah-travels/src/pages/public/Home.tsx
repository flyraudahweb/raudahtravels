import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useListPackages, getListPackagesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MapPin, CalendarDays, Star, CheckCircle2, Phone, MessageCircle, Users, Search, ArrowRight, ChevronRight, Check, Globe, ChevronDown, Minus, Plus, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import consultancyImg from "@/assets/images/consultancy.png";
/* ── Custom branded dropdown ────────────────────────────────────────────── */
interface DropdownOption { value: string; label: string; }

function SearchDropdown({
  options, value, onChange, placeholder, icon,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  const openDropdown = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const panel = open && rect && createPortal(
    <div
      style={{ position: "absolute", top: rect.top, left: rect.left, width: Math.max(rect.width, 180), zIndex: 9999, maxHeight: "208px", overflowY: "auto" }}
      className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(13,15,78,0.18)] border border-[#E8ECFA] py-1.5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {options.map(opt => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-left transition-colors
              ${isSelected ? "bg-[#EEF0FF] text-[#2D3199]" : "text-[#334155] hover:bg-[#F5F7FF] hover:text-[#2D3199]"}`}
          >
            <span className="flex-1">{opt.label}</span>
            {isSelected && <Check className="w-3.5 h-3.5 text-[#2D3199] shrink-0" />}
          </button>
        );
      })}
    </div>,
    document.body
  );

  return (
    <>
      <div
        ref={triggerRef}
        className="flex-1 group relative flex items-center gap-3 px-5 py-5 hover:bg-[#F5F7FF] rounded-xl transition-colors cursor-pointer"
        onClick={() => open ? setOpen(false) : openDropdown()}
      >
        <div className="w-9 h-9 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black text-[#2D3199] uppercase tracking-[0.16em] mb-0.5">{placeholder}</p>
          <div className="flex items-center gap-1">
            <span className={`text-sm font-bold truncate flex-1 ${selected ? "text-[#0F172A]" : "text-[#94A3B8]"}`}>
              {selected ? selected.label : `Select ${placeholder.toLowerCase()}`}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#94A3B8] shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
      </div>
      {panel}
    </>
  );
}

function getPackageImage(id: string, imageUrl?: string | null) {
  const imgs = [
    "https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg",
    "https://images.pexels.com/photos/26436662/pexels-photo-26436662.jpeg",
    "https://images.pexels.com/photos/34246939/pexels-photo-34246939.jpeg",
    "https://images.pexels.com/photos/29676866/pexels-photo-29676866.jpeg",
  ];
  if (imageUrl) return imageUrl;
  const idx = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % imgs.length;
  return imgs[idx];
}

const TESTIMONIALS = [
  {
    name: "Hajiya Fatima Usman",
    city: "Abuja",
    rating: 5,
    text: "Raudah Travels made our Hajj journey absolutely seamless. The hotels were excellent, the guides were knowledgeable, and the team was always reachable. Alhamdulillah, it was a life-changing experience.",
    trip: "Hajj 2024",
  },
  {
    name: "Alhaji Musa Ibrahim",
    city: "Kano",
    rating: 5,
    text: "I have used other operators before, but Raudah Travels stands apart. Their transparency in pricing and service quality from Lagos to Medina was outstanding. Highly recommended.",
    trip: "Umrah 2024",
  },
  {
    name: "Dr. Amina Bello",
    city: "Lagos",
    rating: 5,
    text: "My elderly parents needed extra care and Raudah's team went above and beyond. Visa processing was smooth, the group was well-organised, and we felt safe throughout.",
    trip: "Hajj 2023",
  },
];

function getEmbedUrl(url: string): string {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
  if (ytMatch) {
    const id = ytMatch[1];
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&rel=0&modestbranding=1`;
  }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1&loop=1&background=1`;
  }
  return url;
}

function HeroVideoCard({ videoUrl }: { videoUrl?: string }) {
  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null;
  return (
    <div className="relative w-full max-w-[560px] mx-auto lg:ml-8">
      <div className="rounded-3xl overflow-hidden bg-[#0d1b2a] shadow-2xl border border-white/10 aspect-[1/1] sm:aspect-[6/5]">
        {embedUrl ? (
          <div className="relative w-full h-full">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ border: "none" }}
              title="Raudah Travels hero video"
            />
            {/* Transparent overlay to suppress YouTube/Vimeo hover UI (title bar, share button) */}
            <div className="absolute inset-0 z-10" style={{ pointerEvents: "auto", background: "transparent" }} />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-[#0d1b2a] to-[#1a2f45]">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#FF3B00]/20 animate-ping" style={{ animationDuration: "2s" }} />
              <div className="relative w-20 h-20 rounded-full bg-[#FF3B00]/15 border-2 border-[#FF3B00]/40 flex items-center justify-center">
                <Play className="w-9 h-9 text-[#FF3B00] ml-1" />
              </div>
            </div>
            <div className="text-center px-8">
              <p className="text-white font-bold text-base mb-2">Our Journey Awaits</p>
              <p className="text-white/35 text-xs leading-relaxed">
                Add a YouTube or Vimeo URL in<br />
                Admin → Settings → Landing Page Edits
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {["🕌 Makkah", "✈️ Direct Flights", "🌙 Madinah"].map(t => (
                <span key={t} className="text-[10px] text-white/30 font-medium">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="absolute -inset-6 bg-indigo-500/10 rounded-3xl blur-3xl -z-10" />
    </div>
  );
}

const HERO_IMAGES = [
  "https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg",
  "https://images.pexels.com/photos/26436662/pexels-photo-26436662.jpeg",
  "https://images.pexels.com/photos/34246939/pexels-photo-34246939.jpeg",
  "https://images.pexels.com/photos/29676866/pexels-photo-29676866.jpeg",
];

export default function Home() {
  const [searchForm, setSearchForm] = useState({ country: "Nigeria", packageType: "", month: "", persons: "" });
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const onScroll = () => setShowWhatsApp(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setSlideIndex(i => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const { data: pubSettings } = useQuery<Record<string, any>>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const r = await fetch("/api/public/settings");
      return r.ok ? r.json() as Promise<Record<string, any>> : {};
    },
    staleTime: 60_000,
  });
  const heroVideoUrl = pubSettings?.landing_video_url as string | undefined;

  const { data: packagesData, isLoading } = useListPackages(
    { limit: 3, available: true },
    { query: { queryKey: getListPackagesQueryKey({ limit: 3, available: true }) } }
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      <main className="flex-1">

        {/* ── HERO — Deep Royal Indigo with image slideshow ── */}
        <section className="relative min-h-screen flex flex-col overflow-hidden bg-[#1C1F66]">
          {/* Slideshow images */}
          {HERO_IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 pointer-events-none"
              style={{ opacity: i === slideIndex ? 0.58 : 0 }}
            />
          ))}
          {/* Dark gradient overlay — keeps text readable */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, rgba(13,15,78,0.72) 0%, rgba(28,31,102,0.58) 50%, rgba(45,49,153,0.42) 100%)" }} />
          {/* Slide dots */}
          <div className="absolute bottom-28 md:bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {HERO_IMAGES.map((_, i) => (
              <button key={i} onClick={() => setSlideIndex(i)} aria-label={`Slide ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${i === slideIndex ? "w-6 h-2 bg-[#FF3B00]" : "w-2 h-2 bg-white/40 hover:bg-white/60"}`} />
            ))}
          </div>

          {/* Navbar — transparent, becomes solid on scroll */}
          <Navbar transparent />

          {/* Hero content */}
          <div className="relative z-10 flex-1 flex items-center">
            <div className="container mx-auto px-4 md:px-8 pt-28 md:pt-32 pb-[340px] md:pb-52 max-w-7xl">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-4 items-center">

                {/* Left */}
                <div className="space-y-6">
                  <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white/90 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#FF3B00] inline-block" />
                    Nigeria's Most Trusted Hajj &amp; Umrah Partner
                  </span>

                  <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-black text-white leading-[1.1] tracking-tight" style={{ color: "white" }}>
                    Raudah Travels &amp; Tours,{" "}
                    <span className="text-[#FF3B00]">Your Gateway</span>{" "}
                    to the Holy Lands
                  </h1>

                  <p className="text-white/75 text-base leading-relaxed max-w-lg">
                    Experience Hajj and Umrah with Nigeria's Most Trusted Travel Partner — premium packages, expert guidance, seamless logistics.
                  </p>

                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <Button size="lg" asChild
                      className="bg-[#FF3B00] hover:bg-[#D63200] text-white font-bold px-8 py-6 text-base rounded-full shadow-cta transition-all hover:-translate-y-0.5">
                      <Link href="/packages">Explore Packages</Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild
                      className="border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white font-semibold px-8 py-6 text-base rounded-full backdrop-blur-sm transition-all">
                      <Link href="/become-agent">Become an Agent</Link>
                    </Button>
                  </div>

                </div>

                {/* Right — Hero video / placeholder */}
                <HeroVideoCard videoUrl={heroVideoUrl} />
              </div>
            </div>
          </div>

          {/* Search bar — overlapping hero bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 md:px-8 pb-14 md:pb-18">
            <div className="max-w-4xl mx-auto">
              {/* Label strip */}
              <div className="hidden md:flex items-center gap-1 mb-2 px-1">
                <span className="text-white/60 text-[11px] font-bold uppercase tracking-widest">Quick Search</span>
                <div className="flex-1 h-px bg-white/15 ml-2" />
              </div>

              <div className="bg-white rounded-2xl shadow-[0_8px_48px_rgba(13,15,78,0.35)] border border-white/80">
                <div className="flex flex-col md:flex-row items-stretch divide-y md:divide-y-0 md:divide-x divide-[#E8ECFA]">

                  {/* Country */}
                  <SearchDropdown
                    placeholder="Country"
                    icon={<Globe className="w-4 h-4 text-[#2D3199]" />}
                    value={searchForm.country}
                    onChange={(v) => setSearchForm(f => ({ ...f, country: v }))}
                    options={[
                      { value: "Nigeria", label: "🇳🇬  Nigeria" },
                      { value: "Niger",   label: "🇳🇪  Niger" },
                    ]}
                  />

                  {/* Package Type */}
                  <SearchDropdown
                    placeholder="Package Type"
                    icon={<MapPin className="w-4 h-4 text-[#2D3199]" />}
                    value={searchForm.packageType}
                    onChange={(v) => setSearchForm(f => ({ ...f, packageType: v }))}
                    options={[
                      { value: "hajj",   label: "✦  Hajj" },
                      { value: "umrah",  label: "✦  Umrah" },
                    ]}
                  />

                  {/* Month */}
                  <SearchDropdown
                    placeholder="Month"
                    icon={<CalendarDays className="w-4 h-4 text-[#2D3199]" />}
                    value={searchForm.month}
                    onChange={(v) => setSearchForm(f => ({ ...f, month: v }))}
                    options={[
                      "January","February","March","April","May","June",
                      "July","August","September","October","November","December",
                    ].map(m => ({ value: m, label: m }))}
                  />

                  {/* Persons — stepper */}
                  <div className="flex-1 group relative flex items-center gap-3 px-5 py-5 hover:bg-[#F5F7FF] rounded-xl transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
                      <Users className="w-4.5 h-4.5 text-[#2D3199]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black text-[#2D3199] uppercase tracking-[0.16em] mb-0.5">Persons</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSearchForm(f => ({ ...f, persons: String(Math.max(1, (parseInt(f.persons) || 1) - 1)) }))}
                          className="w-5 h-5 rounded-full border border-[#DCE3F0] flex items-center justify-center text-[#2D3199] hover:bg-[#EEF0FF] transition-colors shrink-0"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-sm font-bold text-[#0F172A] min-w-[1.5rem] text-center">
                          {searchForm.persons || "1"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSearchForm(f => ({ ...f, persons: String((parseInt(f.persons) || 1) + 1) }))}
                          className="w-5 h-5 rounded-full border border-[#DCE3F0] flex items-center justify-center text-[#2D3199] hover:bg-[#EEF0FF] transition-colors shrink-0"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Search CTA */}
                  <div className="flex items-center px-3 py-3">
                    <Link
                      href={`/packages${searchForm.packageType ? `?type=${searchForm.packageType}` : ""}`}
                      className="flex items-center gap-2 px-6 py-3.5 bg-[#FF3B00] hover:bg-[#D63200] text-white text-sm font-black rounded-xl transition-all hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(255,59,0,0.40)] whitespace-nowrap"
                    >
                      <Search className="w-4 h-4" />
                      <span className="hidden sm:inline">Search</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURED PACKAGES ── */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <p className="text-[#2D3199] text-sm font-bold uppercase tracking-widest mb-3">Our Packages</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] mb-4">Featured Pilgrimages</h2>
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#2D3199]" />
                <div className="w-2 h-2 rotate-45 bg-[#2D3199]" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#2D3199]" />
              </div>
              <p className="text-[#64748B] text-lg leading-relaxed">
                Thoughtfully designed packages ensuring comfort, proximity to the Haramain, and deeply guided spiritual experiences.
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => <div key={i} className="h-[440px] rounded-3xl animate-pulse bg-[#F1F5F9]" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(packagesData?.packages || []).map((pkg) => {
                  const spacesLeft = pkg.maxCapacity - pkg.currentBookings;
                  const isLowAvail = spacesLeft > 0 && spacesLeft <= 10;
                  const imgSrc = getPackageImage(pkg.id, pkg.imageUrl);
                  return (
                    <Link key={pkg.id} href={`/packages/${pkg.id}`}
                      className="group block bg-white rounded-3xl border border-[#DCE3F0] overflow-hidden shadow-[0_2px_16px_rgba(45,49,153,0.06)] hover:shadow-[0_8px_40px_rgba(45,49,153,0.14)] hover:-translate-y-1 transition-all duration-300">
                      {/* Image */}
                      <div className="relative h-52 overflow-hidden bg-[#1C1F66]">
                        <img src={imgSrc} alt={pkg.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0"
                          style={{ background: "linear-gradient(to top, rgba(28,31,102,0.80) 0%, transparent 60%)" }} />
                        <span className="absolute top-4 left-4 px-3 py-1 bg-[#FF3B00] text-white text-xs font-black uppercase tracking-wider rounded-full">
                          {pkg.type}
                        </span>
                        <span className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1 bg-white/15 backdrop-blur border border-white/20 text-white text-xs font-bold rounded-full">
                          <Star className="w-3 h-3 fill-white" /> {pkg.starRating} Star
                        </span>
                        {isLowAvail && (
                          <span className="absolute bottom-4 left-4 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
                            Only {spacesLeft} left!
                          </span>
                        )}
                        <div className="absolute bottom-4 right-4 text-right">
                          <p className="text-white text-xl font-black leading-none">₦{pkg.price.toLocaleString()}</p>
                          <p className="text-white/60 text-[10px] font-medium">per person</p>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-5">
                        <h3 className="text-lg font-black text-[#0F172A] leading-snug mb-3 group-hover:text-[#2D3199] transition-colors line-clamp-1">
                          {pkg.name}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-[#64748B] mb-4">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="w-4 h-4 text-[#2D3199]" /> {pkg.durationDays} Days
                          </span>
                          <span className="w-1 h-1 rounded-full bg-[#DCE3F0]" />
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-[#2D3199]" /> {spacesLeft} spaces
                          </span>
                          <span className="w-1 h-1 rounded-full bg-[#DCE3F0]" />
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-[#2D3199]" /> Makkah
                          </span>
                        </div>
                        <div className="space-y-1.5 mb-5">
                          {pkg.inclusions.slice(0, 3).map((inc, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-[#475569]">
                              <span className="w-4 h-4 rounded-full bg-[#EEF0FF] flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 text-[#2D3199]" />
                              </span>
                              <span className="truncate">{inc}</span>
                            </div>
                          ))}
                          {pkg.inclusions.length > 3 && (
                            <p className="text-xs text-[#94A3B8] pl-6">+{pkg.inclusions.length - 3} more inclusions</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-[#F1F5F9]">
                          <div>
                            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Departure</p>
                            <p className="text-sm font-bold text-[#334155]">
                              {new Date(pkg.departureDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          </div>
                          <span className="flex items-center gap-1 px-4 py-2 bg-[#2D3199] group-hover:bg-[#FF3B00] text-white text-sm font-bold rounded-full transition-colors duration-300">
                            View Details <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="text-center mt-12">
              <Button asChild className="bg-[#2D3199] hover:bg-[#25297F] text-white rounded-full px-8 font-bold shadow-brand">
                <Link href="/packages" className="flex items-center gap-2">View All Packages <ArrowRight className="w-4 h-4" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── WHY CHOOSE US ── */}
        <section className="py-24 bg-[#F8FAFC] overflow-hidden">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <p className="text-[#2D3199] text-sm font-bold uppercase tracking-widest mb-3">Our Promise</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] mb-4">Why Choose Raudah Travels?</h2>
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#2D3199]" />
                <div className="w-2 h-2 rotate-45 bg-[#2D3199]" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#2D3199]" />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-6">
                {[
                  { title: "Premium Accommodations", desc: "Carefully selected hotels within walking distance of the Haramain in Mecca and Medina.", color: "#EEF0FF", icon: "🏨" },
                  { title: "Expert Scholars On-Trip", desc: "Accompanied by knowledgeable scholars who guide you through every ritual and supplication.", color: "#FFF4F1", icon: "📖" },
                  { title: "Transparent, Fair Pricing", desc: "No hidden fees. Clear payment plans and flexible deposit options for every budget.", color: "#F0FDF4", icon: "✅" },
                  { title: "End-to-End Visa Support", desc: "We handle all Nigerian Consulate and Saudi Embassy documentation from start to finish.", color: "#EFF6FF", icon: "🛂" },
                ].map((val, i) => (
                  <div key={i} className="flex gap-4 p-5 rounded-2xl bg-white border border-[#DCE3F0] shadow-soft hover:-translate-y-0.5 hover:shadow-soft-lg transition-all">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: val.color }}>
                      {val.icon}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-[#0F172A] mb-1">{val.title}</h4>
                      <p className="text-[#64748B] text-sm leading-relaxed">{val.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative">
                <div className="aspect-[4/5] rounded-3xl overflow-hidden border-4 border-[#EEF0FF] shadow-brand-glow relative z-10">
                  <img src={consultancyImg} alt="Raudah Travel Consultancy" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-[#2D3199]/10 rounded-full blur-3xl -z-10" />
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section className="relative py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0D0F4E 0%, #1C1F66 45%, #12145C 100%)" }}>

          {/* Background decoration */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#2D3199]/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#FF3B00]/15 rounded-full blur-[100px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#2D3199]/10 rounded-full blur-[140px]" />
            {/* Subtle dot grid */}
            <div className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          </div>

          <div className="relative container mx-auto px-4 md:px-6">

            {/* Header */}
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/8 text-white/70 text-xs font-bold uppercase tracking-widest mb-5">
                <Star className="w-3 h-3 fill-[#FF3B00] text-[#FF3B00]" /> Testimonials
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                What Our Pilgrims Say
              </h2>
              <p className="text-white/55 text-lg leading-relaxed">
                Thousands of Nigerian Muslims have trusted Raudah Travels for their sacred journey.
              </p>
            </div>

            {/* Trust stats bar */}
            {(() => {
              const defaultLandingStats = [
                { val: "4.9 / 5", label: "Average Rating" },
                { val: "2,400+", label: "Happy Pilgrims" },
                { val: "8 yrs", label: "Trusted Since 2016" },
                { val: "100%", label: "Visa Success Rate" },
              ];
              const landingStats = (pubSettings?.landing_stats as typeof defaultLandingStats | undefined) ?? defaultLandingStats;
              return (
                <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 mb-14">
                  {landingStats.map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-2xl font-black text-white leading-none">{s.val}</p>
                      <p className="text-white/45 text-xs mt-1 font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {TESTIMONIALS.map((t, i) => (
                <div key={i}
                  className={`relative rounded-3xl p-7 border transition-all duration-300 hover:-translate-y-2 group ${
                    i === 1
                      ? "border-[#FF3B00]/30 bg-gradient-to-br from-[#FF3B00]/10 to-[#2D3199]/20 md:mt-[-20px]"
                      : "border-white/10 bg-white/6"
                  }`}
                  style={{ backdropFilter: "blur(12px)" }}>

                  {/* Featured badge on center card */}
                  {i === 1 && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#FF3B00] rounded-full text-white text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-[0_4px_12px_rgba(255,59,0,0.4)]">
                      Most Helpful
                    </div>
                  )}

                  {/* Giant quote mark */}
                  <div className="text-7xl font-black leading-none mb-2 select-none"
                    style={{ color: i === 1 ? "rgba(255,59,0,0.25)" : "rgba(255,255,255,0.08)", fontFamily: "Georgia, serif" }}>
                    "
                  </div>

                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-[#FF3B00] text-[#FF3B00]" />
                    ))}
                  </div>

                  {/* Quote text */}
                  <p className="text-white/80 leading-relaxed text-sm mb-7 font-medium">
                    {t.text}
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-5 border-t border-white/10">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-lg ${
                      i === 0 ? "bg-gradient-to-br from-[#2D3199] to-[#4C56B8]" :
                      i === 1 ? "bg-gradient-to-br from-[#FF3B00] to-[#FF6B35]" :
                               "bg-gradient-to-br from-[#0EA5E9] to-[#2D3199]"
                    } text-white`}>
                      {t.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm leading-tight truncate">{t.name}</p>
                      <p className="text-white/45 text-xs mt-0.5">{t.city}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 ${
                      i === 1
                        ? "bg-[#FF3B00]/20 text-[#FF3B00] border border-[#FF3B00]/30"
                        : "bg-white/8 text-white/60 border border-white/10"
                    }`}>
                      {t.trip}
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="py-20" style={{ background: "linear-gradient(135deg, #2D3199 0%, #4C56B8 100%)" }}>
          <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Begin Your Sacred Journey Today</h2>
            <p className="text-white/75 text-lg mb-10 leading-relaxed">
              Spaces are limited for each season. Reserve your package now and let our team handle every detail — from visa to hotel to ziyarah.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="bg-[#FF3B00] hover:bg-[#D63200] text-white font-bold text-lg px-8 py-6 w-full sm:w-auto rounded-full shadow-cta hover:-translate-y-0.5 transition-all">
                <Link href="/packages">Book a Package</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white font-semibold text-lg px-8 py-6 w-full sm:w-auto rounded-full">
                <a href="tel:+2348012345678" className="flex items-center gap-2">
                  <Phone className="w-5 h-5" /> Call Us Now
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* WhatsApp float — hidden on hero, visible after scrolling into packages section */}
      <a
        href="https://wa.me/2348012345678?text=Assalamu%20Alaikum!%20I%20would%20like%20to%20enquire%20about%20your%20Hajj%20and%20Umrah%20packages."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white rounded-full shadow-2xl hover:bg-[#20b958] hover:scale-105 active:scale-95 px-4 py-3.5 group transition-all duration-500 ${
          showWhatsApp ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <MessageCircle className="w-6 h-6 shrink-0" />
        <span className="text-sm font-bold max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
          Chat with Us
        </span>
      </a>
    </div>
  );
}
