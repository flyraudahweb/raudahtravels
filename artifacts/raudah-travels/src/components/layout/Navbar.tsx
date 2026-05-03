import { useState, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { useUser, UserButton } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Menu, Globe, Thermometer, MapPin, Clock, Calendar, ChevronRight } from "lucide-react";

interface NavbarProps {
  transparent?: boolean;
}

const NAV_LINKS = [
  { href: "/", label: "Home", exact: true },
  { href: "/packages", label: "Packages" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function NavLink({ href, label, exact, solid }: { href: string; label: string; exact?: boolean; solid: boolean }) {
  const [isActive] = useRoute(exact ? href : `${href}/*?`);
  return (
    <Link href={href} className={`relative text-sm font-semibold transition-colors group ${
      solid
        ? isActive ? "text-[#2D3199]" : "text-[#334155] hover:text-[#2D3199]"
        : isActive ? "text-white" : "text-white/80 hover:text-white"
    }`}>
      {label}
      <span className={`absolute -bottom-1 left-0 h-0.5 rounded-full transition-all duration-300 ${
        isActive
          ? "w-full bg-[#FF3B00]"
          : solid
            ? "w-0 bg-[#2D3199] group-hover:w-full"
            : "w-0 bg-white group-hover:w-full"
      }`} />
    </Link>
  );
}

export function Navbar({ transparent = false }: NavbarProps) {
  const { isSignedIn, isLoaded } = useUser();
  const { data: profile } = useGetProfile({ query: { enabled: !!isSignedIn, queryKey: getGetProfileQueryKey() } });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const liveTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const hijriDate = (() => {
    try {
      const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "short", year: "numeric" });
      return fmt.format(now).replace(" AH", "").replace(" ah", "");
    } catch {
      return new Intl.DateTimeFormat("en-u-ca-islamic", { day: "numeric", month: "short", year: "numeric" }).format(now).replace(" AH", "");
    }
  })();

  const getDashboardLink = () => {
    if (!profile) return "/dashboard";
    if (profile.role === "admin" || profile.role === "super_admin") return "/admin";
    if (profile.role === "agent") return "/agent";
    return "/dashboard";
  };

  const solid = !transparent || scrolled;

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500 ${
      solid
        ? "bg-white/95 backdrop-blur-xl shadow-[0_1px_32px_rgba(45,49,153,0.08)] border-b border-[#DCE3F0]"
        : "bg-transparent"
    }`}>

      {/* ── Top info bar ── */}
      <div className={`hidden md:block overflow-hidden transition-all duration-500 ${
        solid ? "h-0 opacity-0" : "h-9 opacity-100"
      }`}>
        <div className={`h-9 border-b flex items-center justify-center gap-5 text-xs ${
          solid ? "border-[#DCE3F0] bg-[#1C1F66] text-white/80" : "border-white/10 text-white/70"
        }`}>
          <span className="flex items-center gap-1.5 font-medium">
            <Thermometer className="w-3 h-3 text-[#FF3B00]" /> 38°C
          </span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 opacity-60" /> {hijriDate}
          </span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 opacity-60" /> {liveTime}
          </span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 opacity-60" /> Makkah
          </span>
        </div>
      </div>

      {/* Solid top bar (visible when scrolled) */}
      {solid && (
        <div className="hidden md:block bg-[#1C1F66] h-8 overflow-hidden">
          <div className="flex items-center justify-center gap-5 h-full text-xs text-white/70">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-3 h-3 text-[#FF3B00]" /> 38°C
            </span>
            <span className="w-px h-3 bg-white/20" />
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 opacity-60" /> {hijriDate}
            </span>
            <span className="w-px h-3 bg-white/20" />
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 opacity-60" /> {liveTime}
            </span>
            <span className="w-px h-3 bg-white/20" />
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 opacity-60" /> Makkah
            </span>
          </div>
        </div>
      )}

      {/* ── Main nav row ── */}
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">

        {/* Logo */}
        <Link href="/" className="flex items-center group">
          <img
            src="/logo.png"
            alt="Raudah Travels & Tours"
            className="h-10 w-auto object-contain transition-all duration-300"
            style={{ filter: solid ? "none" : "brightness(0) invert(1)" }}
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} {...link} solid={solid} />
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2.5">
          <button className={`hidden lg:flex items-center gap-1.5 text-xs font-semibold transition-colors px-2 py-1 rounded-lg ${
            solid ? "text-[#64748B] hover:text-[#2D3199] hover:bg-[#F1F5F9]" : "text-white/60 hover:text-white"
          }`}>
            <Globe className="w-3.5 h-3.5" /> EN
          </button>

          {isLoaded && !isSignedIn && (
            <>
              <Link href="/sign-in"
                className={`hidden md:block text-sm font-semibold transition-colors px-3 py-1.5 rounded-lg ${
                  solid ? "text-[#334155] hover:text-[#2D3199] hover:bg-[#F8F9FF]" : "text-white/80 hover:text-white"
                }`}>
                Log in
              </Link>
              <Link href="/sign-up"
                className={`hidden md:inline-flex items-center gap-1.5 text-sm font-bold px-5 py-2 rounded-full transition-all duration-200 ${
                  solid
                    ? "bg-[#2D3199] text-white hover:bg-[#25297F] shadow-[0_4px_14px_rgba(45,49,153,0.35)] hover:shadow-[0_6px_20px_rgba(45,49,153,0.45)] hover:-translate-y-0.5"
                    : "bg-white text-[#2D3199] hover:bg-white/90 shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
                }`}>
                Get Started <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}

          {isLoaded && isSignedIn && (
            <>
              <Link href={getDashboardLink()}
                className={`hidden md:inline-flex items-center gap-1.5 text-sm font-bold px-5 py-2 rounded-full border transition-all duration-200 ${
                  solid
                    ? "border-[#2D3199]/30 text-[#2D3199] hover:bg-[#EEF0FF]"
                    : "border-white/30 text-white hover:bg-white/10"
                }`}>
                Dashboard
              </Link>
              <div className={`rounded-full ring-2 transition-all ${solid ? "ring-[#2D3199]/20" : "ring-white/30"}`}>
                <UserButton />
              </div>
            </>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className={`md:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  solid ? "text-[#334155] hover:bg-[#F1F5F9]" : "text-white hover:bg-white/10"
                }`}
                data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 border-0"
              style={{ background: "linear-gradient(180deg, #12145C 0%, #1C1F66 100%)" }}>
              <MobileDrawer
                navLinks={NAV_LINKS}
                isLoaded={isLoaded}
                isSignedIn={!!isSignedIn}
                dashboardLink={getDashboardLink()}
                onClose={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MobileDrawer({ navLinks, isLoaded, isSignedIn, dashboardLink, onClose }: {
  navLinks: { href: string; label: string }[];
  isLoaded: boolean;
  isSignedIn: boolean;
  dashboardLink: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full px-6 pt-8 pb-10">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <img
          src="/logo.png"
          alt="Raudah Travels & Tours"
          className="h-10 w-auto object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 flex-1">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={onClose}
            className="flex items-center justify-between px-4 py-3.5 rounded-2xl text-white/75 hover:bg-white/10 hover:text-white transition-all font-semibold group">
            {link.label}
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </nav>

      {/* Auth buttons */}
      {isLoaded && !isSignedIn && (
        <div className="space-y-2.5 mt-6">
          <Link href="/sign-in" onClick={onClose}
            className="flex items-center justify-center px-4 py-3 rounded-2xl text-white/75 border border-white/15 hover:bg-white/10 hover:text-white transition-all font-semibold">
            Log in
          </Link>
          <Link href="/sign-up" onClick={onClose}
            className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#FF3B00] text-white font-black text-center shadow-[0_4px_14px_rgba(255,59,0,0.4)] hover:bg-[#D63200] transition-colors">
            Get Started <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
      {isLoaded && isSignedIn && (
        <Link href={dashboardLink} onClick={onClose}
          className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#FF3B00] text-white font-black shadow-[0_4px_14px_rgba(255,59,0,0.4)] hover:bg-[#D63200] transition-colors">
          My Dashboard <ChevronRight className="w-4 h-4" />
        </Link>
      )}

      {/* Bottom weather strip */}
      <div className="mt-6 px-4 py-3 rounded-2xl bg-white/5 border border-white/8 flex items-center gap-3 text-xs text-white/50">
        <Thermometer className="w-3.5 h-3.5 text-[#FF3B00] shrink-0" />
        <span>38°C</span>
        <span className="w-px h-3 bg-white/20" />
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span>Makkah</span>
      </div>
    </div>
  );
}
