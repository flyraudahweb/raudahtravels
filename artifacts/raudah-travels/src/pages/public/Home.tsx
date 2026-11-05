import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  useListPackages,
  getListPackagesQueryKey,
} from "@workspace/api-client-react";
import {
  CalendarDays,
  Star,
  CheckCircle2,
  Phone,
  MessageCircle,
  ArrowRight,
  Check,
  Plane,
  Package,
  Building2,
  BookOpen,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import consultancyImg from "@/assets/images/consultancy.png";
import heroAircraftImg from "@/assets/images/hero-aircraft.jpg";
import PackageCard from "@/components/packages/PackageCard";
import AppSection from "@/components/home/AppSection";
import OtaSearchWidget from "@/components/ota/OtaSearchWidget";
import ExchangeRates from "@/components/ota/ExchangeRates";
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

const HERO_IMAGES = [
  "https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg",
  "https://images.pexels.com/photos/26436662/pexels-photo-26436662.jpeg",
  "https://images.pexels.com/photos/34246939/pexels-photo-34246939.jpeg",
  "https://images.pexels.com/photos/29676866/pexels-photo-29676866.jpeg",
];
export default function Home() {
  const [featuredType, setFeaturedType] = useState<"all" | "hajj" | "umrah">(
    "all",
  );
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const onScroll = () =>
      setShowWhatsApp(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: pubSettings } = useQuery<Record<string, any>>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const r = await fetch("/api/public/settings");
      if (!r.ok) throw new Error("Could not refresh public settings");
      return r.json() as Promise<Record<string, any>>;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const slideshowEnabled =
    pubSettings?.landing_hero?.slideshowEnabled !== false;
  const aircraftEnabled = pubSettings?.landing_hero?.aircraftEnabled !== false;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      clearInterval(timer);
      if (slideshowEnabled && !media.matches)
        timer = setInterval(
          () => setSlideIndex((index) => (index + 1) % HERO_IMAGES.length),
          5000,
        );
    };
    update();
    media.addEventListener("change", update);
    return () => {
      clearInterval(timer);
      media.removeEventListener("change", update);
    };
  }, [slideshowEnabled]);
  const packageParams = {
    limit: 3,
    available: true,
    type: featuredType === "all" ? undefined : featuredType,
  };
  const {
    data: packagesData,
    isLoading,
    isError,
    refetch,
  } = useListPackages(packageParams, {
    query: { queryKey: getListPackagesQueryKey(packageParams) },
  });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      <main className="flex-1">
        <Navbar transparent />
        <div>
          <section className="relative isolate bg-[#1C1F66] px-4 pb-28 pt-28 text-white sm:pb-36 sm:pt-36 md:px-8 md:pt-40">
            <div
              className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
              aria-label="Raudah travel photography"
            >
              {slideshowEnabled &&
                HERO_IMAGES.map((src, index) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full object-cover motion-safe:transition-opacity motion-safe:duration-1000"
                    style={{ opacity: index === slideIndex ? 1 : 0 }}
                    decoding="async"
                  />
                ))}
              {aircraftEnabled && (
                <img
                  src={heroAircraftImg}
                  alt=""
                  aria-hidden
                  className={`absolute inset-y-0 right-0 h-full w-full object-cover ${slideshowEnabled ? "md:w-[75%] opacity-75" : ""}`}
                  style={
                    slideshowEnabled
                      ? {
                          maskImage:
                            "linear-gradient(to right, transparent, black 35%)",
                          WebkitMaskImage:
                            "linear-gradient(to right, transparent, black 35%)",
                        }
                      : undefined
                  }
                  fetchPriority="high"
                  decoding="async"
                />
              )}
              <div className="absolute inset-0 bg-[#1C1F66]/65" />
            </div>
            <div className="mx-auto max-w-6xl text-center">
              <p className="mb-5 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white sm:text-sm">
                Online Travel Agency • Nigeria's Most Trusted Partner
              </p>
              <h1 className="text-[26px] font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
                Every check-in is a new beginning
                <span className="mt-3 block text-[#FF4E00]">
                  Raudah Travels &amp; Tours
                </span>
              </h1>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-white sm:text-sm">
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-white" />
                  Compare flight options
                </span>
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4 shrink-0 text-white" />
                  Hajj &amp; Umrah specialists
                </span>
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-white" />
                  Find your next stay
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
                  Personal travel support
                </span>
              </div>
            </div>
          </section>
          <div className="relative z-20 mx-auto -mt-20 w-full max-w-7xl px-4 md:px-8 sm:-mt-24">
            <OtaSearchWidget
              packagesSectionId="featured-packages"
              variant="landing"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm">
              <div>
                <p className="font-bold text-slate-900">
                  Already have a booking?
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Track confirmation, view travel documents or request help.
                </p>
              </div>
              <Link
                href="/dashboard/my-trips"
                className="inline-flex items-center gap-2 font-bold text-indigo-700"
              >
                Manage my trips <ArrowRight size={16} />
              </Link>
            </div>
            <details className="mt-3 rounded-2xl border border-slate-200 bg-white px-5 py-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                Currency reference rates
              </summary>
              <div className="mt-3">
                <ExchangeRates />
              </div>
            </details>
          </div>
        </div>
        <section
          id="featured-packages"
          tabIndex={-1}
          aria-label="Featured Hajj and Umrah packages"
          className="scroll-mt-28 bg-white py-16 outline-none md:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="mb-3 inline-flex rounded-full bg-[#EEF0FF] px-3 py-1.5 text-sm font-medium text-[#2D3199]">
                  Our Packages
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                  Featured Pilgrimages
                </h2>
                <p className="mt-4 leading-relaxed text-slate-600">
                  Thoughtfully designed packages ensuring comfort, proximity to
                  the Haramain, and deeply guided spiritual experiences.
                </p>
              </div>
              <Link
                href="/packages"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-[#2D3199] hover:text-[#2D3199]"
              >
                View All Packages
                <ArrowRight size={16} />
              </Link>
            </div>
            <div
              role="group"
              aria-label="Featured package type"
              className="mb-8 flex gap-5 border-b border-slate-200"
            >
              {(
                [
                  ["all", "All Types"],
                  ["hajj", "Hajj"],
                  ["umrah", "Umrah"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFeaturedType(value)}
                  aria-pressed={featuredType === value}
                  className={`min-h-12 border-b-2 px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199] ${featuredType === value ? "border-[#2D3199] text-[#2D3199]" : "border-transparent text-slate-500 hover:text-[#2D3199]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {isLoading ? (
              <div
                role="status"
                aria-label="Loading packages"
                className="grid gap-6 md:grid-cols-3"
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[520px] animate-pulse rounded-2xl bg-slate-100"
                  />
                ))}
              </div>
            ) : isError ? (
              <div
                role="alert"
                className="rounded-2xl bg-slate-50 p-8 text-center"
              >
                <p className="text-slate-600">Unable to load packages.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-4 min-h-11 rounded-lg bg-[#2D3199] px-5 text-sm font-semibold text-white"
                >
                  Try again
                </button>
              </div>
            ) : (packagesData?.packages.length ?? 0) === 0 ? (
              <p className="py-12 text-center text-slate-500">
                No packages found. View all packages for more options.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {packagesData?.packages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── INTERACTIVE ROUTE & FLIGHT EXPLORER (Trip.com style) ── */}
        <section
          id="flight-routes"
          className="py-12 md:py-16 bg-[#F8FAFC] border-b border-slate-200/80"
        >
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-10 md:mb-12 max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1C1F66]/10 text-[#1C1F66] text-xs font-bold uppercase tracking-wider mb-3">
                <Plane className="w-3.5 h-3.5 text-[#FF4E00]" /> A world of
                possibilities
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#0F172A] tracking-tight">
                From your home city to your next chapter.
              </h2>
              <div className="flex items-center justify-center gap-3 my-4">
                <div className="h-px w-12 bg-[#2D3199]/20" />
                <div className="h-1 w-8 rounded-full bg-[#2D3199]" />
                <div className="h-px w-12 bg-[#2D3199]/20" />
              </div>
              <p className="text-[#64748B] text-base md:text-lg leading-relaxed">
                Search flights from Nigeria and beyond, explore available
                hotels, and keep your travel plans together in your Raudah
                account.
              </p>
            </div>
          </div>
        </section>
        <AppSection />

        {/* ── WHY CHOOSE US ── */}
        <section className="py-16 md:py-24 bg-white overflow-hidden">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <p className="text-[#2D3199] text-sm font-bold uppercase tracking-widest mb-3">
                Our Promise
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-[#0F172A] mb-4">
                Why Choose Raudah Travels?
              </h2>
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-12 bg-[#2D3199]/20" />
                <div className="h-1 w-8 rounded-full bg-[#2D3199]" />
                <div className="h-px w-12 bg-[#2D3199]/20" />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-6">
                {[
                  {
                    title: "Premium Accommodations",
                    desc: "Carefully selected hotels within walking distance of the Haramain in Mecca and Medina.",
                    color: "#EEF0FF",
                    icon: Building2,
                  },
                  {
                    title: "Expert Scholars On-Trip",
                    desc: "Accompanied by knowledgeable scholars who guide you through every ritual and supplication.",
                    color: "#FFF4F1",
                    icon: BookOpen,
                  },
                  {
                    title: "Transparent, Fair Pricing",
                    desc: "No hidden fees. Clear payment plans and flexible deposit options for every budget.",
                    color: "#F0FDF4",
                    icon: ShieldCheck,
                  },
                  {
                    title: "End-to-End Visa Support",
                    desc: "We handle all Nigerian Consulate and Saudi Embassy documentation from start to finish.",
                    color: "#EFF6FF",
                    icon: FileCheck,
                  },
                ].map((val, i) => (
                  <div
                    key={i}
                    className="flex gap-4 p-5 rounded-xl bg-[#F8FAFC]"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{ background: val.color }}
                    >
                      <val.icon
                        className="h-6 w-6 text-[#2D3199]"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-[#0F172A] mb-1">
                        {val.title}
                      </h4>
                      <p className="text-[#64748B] text-sm leading-relaxed">
                        {val.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative">
                <div className="aspect-[4/5] rounded-3xl overflow-hidden border border-[#EEF0FF] relative z-10">
                  <img
                    src={consultancyImg}
                    alt="Raudah Travel Consultancy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-[#2D3199]/10 rounded-full blur-3xl -z-10" />
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section
          className="relative py-28 overflow-hidden"
          style={{ background: "#1C1F66" }}
        >
          <div className="relative container mx-auto px-4 md:px-6">
            {/* Header */}
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/8 text-white/70 text-xs font-bold uppercase tracking-widest mb-5">
                <Star className="w-3 h-3 fill-[#FF3B00] text-[#FF3B00]" />{" "}
                Testimonials
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                What Our Pilgrims Say
              </h2>
              <p className="text-white/55 text-lg leading-relaxed">
                Thousands of Nigerian Muslims have trusted Raudah Travels for
                their sacred journey.
              </p>
            </div>

            {/* Trust stats bar */}
            {(() => {
              const defaultLandingStats = [
                { val: "4.9 / 5", label: "Average Rating" },
                { val: "30,000+", label: "Happy Pilgrims" },
                { val: "8 yrs", label: "Trusted Since 2016" },
                { val: "100%", label: "Visa Success Rate" },
              ];
              const landingStats =
                (pubSettings?.landing_stats as
                  | typeof defaultLandingStats
                  | undefined) ?? defaultLandingStats;
              return (
                <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 mb-14">
                  {landingStats.map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-2xl font-black text-white leading-none">
                        {s.val}
                      </p>
                      <p className="text-white/45 text-xs mt-1 font-medium">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  className={`relative rounded-3xl p-7 border transition-all duration-300 group ${
                    i === 1
                      ? "border-white/20 bg-white/10"
                      : "border-white/20 bg-white/5"
                  }`}
                  style={{ backdropFilter: "blur(12px)" }}
                >
                  {/* Featured badge on center card */}
                  {i === 1 && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#FF3B00] rounded-full text-white text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-[0_4px_12px_rgba(255,59,0,0.4)]">
                      Most Helpful
                    </div>
                  )}

                  {/* Giant quote mark */}
                  <div
                    className="text-7xl font-black leading-none mb-2 select-none"
                    style={{
                      color:
                        i === 1
                          ? "rgba(255,59,0,0.25)"
                          : "rgba(255,255,255,0.08)",
                      fontFamily: "Georgia, serif",
                    }}
                  >
                    "
                  </div>

                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4 fill-[#FF3B00] text-[#FF3B00]"
                      />
                    ))}
                  </div>

                  {/* Quote text */}
                  <p className="text-white/80 leading-relaxed text-sm mb-7 font-medium">
                    {t.text}
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-5 border-t border-white/10">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-lg ${
                        i === 0
                          ? "bg-gradient-to-br from-[#2D3199] to-[#4C56B8]"
                          : i === 1
                            ? "bg-gradient-to-br from-[#FF3B00] to-[#FF6B35]"
                            : "bg-gradient-to-br from-[#0EA5E9] to-[#2D3199]"
                      } text-white`}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm leading-tight truncate">
                        {t.name}
                      </p>
                      <p className="text-white/45 text-xs mt-0.5">{t.city}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 ${
                        i === 1
                          ? "bg-[#FF3B00]/20 text-[#FF3B00] border border-[#FF3B00]/30"
                          : "bg-white/8 text-white/60 border border-white/10"
                      }`}
                    >
                      {t.trip}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="py-20" style={{ background: "#2D3199" }}>
          <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Begin Your Sacred Journey Today
            </h2>
            <p className="text-white/75 text-lg mb-10 leading-relaxed">
              Spaces are limited for each season. Reserve your package now and
              let our team handle every detail — from visa to hotel to ziyarah.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                asChild
                className="bg-[#FF3B00] hover:bg-[#D63200] text-white font-bold text-lg px-8 py-6 w-full sm:w-auto rounded-lg transition-colors"
              >
                <Link href="/packages">Book a Package</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white/30 text-white bg-transparent hover:bg-white/10 hover:text-white font-semibold text-lg px-8 py-6 w-full sm:w-auto rounded-full"
              >
                <a
                  href="tel:+2348012345678"
                  className="flex items-center gap-2"
                >
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
          showWhatsApp
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
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
