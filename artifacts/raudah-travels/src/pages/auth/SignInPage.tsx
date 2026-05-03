import { SignIn } from "@clerk/react";
import { Link } from "wouter";
import { Thermometer, MapPin, Clock, Calendar, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";

export default function SignInPage() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const liveDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  const liveTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Top info bar */}
      <div className="hidden md:block bg-[#1C1F66] text-white/80 text-xs">
        <div className="flex items-center justify-center gap-5 h-8">
          <span className="flex items-center gap-1.5"><Thermometer className="w-3 h-3 text-[#FF3B00]" /> 38°C</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {liveDate}</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {liveTime}</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Makkah</span>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left brand panel */}
        <div
          className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #1C1F66 0%, #2D3199 60%, #4C56B8 100%)" }}
        >
          {/* Dot pattern */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)`,
              backgroundSize: "36px 36px"
            }} />
          {/* Blobs */}
          <div className="absolute top-20 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-0 w-48 h-48 bg-[#FF3B00]/10 rounded-full blur-3xl" />

          {/* Logo */}
          <Link href="/" className="relative z-10">
            <img src="/logo.png" alt="Raudah Travels & Tours" className="h-12 w-auto object-contain" style={{ filter: "brightness(0) invert(1)" }} />
          </Link>

          {/* Brand copy */}
          <div className="relative z-10 space-y-6">
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B00]" />
                Nigeria's Most Trusted Pilgrimage Partner
              </p>
              <h2 className="text-4xl font-black text-white leading-tight">
                Your Gateway<br />
                <span className="text-[#FF3B00]">to the Holy Lands</span>
              </h2>
              <p className="text-white/65 text-base leading-relaxed">
                Join thousands of Nigerian pilgrims who have trusted Raudah Travels for their Hajj &amp; Umrah journey.
              </p>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-4">
              {[["5,000+", "Pilgrims Served"], ["15+", "Years Experience"], ["4.9★", "Average Rating"]].map(([v, l]) => (
                <div key={l} className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                  <p className="text-xl font-black text-white">{v}</p>
                  <p className="text-[10px] text-white/55 font-medium mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <p className="relative z-10 text-white/40 text-xs">
            © {now.getFullYear()} Raudah Travels &amp; Tours Ltd. · Lagos, Nigeria
          </p>
        </div>

        {/* Right form panel */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[#F8F9FF] px-4 sm:px-6 py-8 sm:py-12 overflow-x-hidden">

          {/* Back to home */}
          <div className="w-full max-w-md mb-4">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#64748B] hover:text-[#2D3199] transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to home
            </Link>
          </div>

          {/* Mobile logo */}
          <Link href="/" className="lg:hidden mb-6">
            <img src="/logo.png" alt="Raudah Travels & Tours" className="h-9 w-auto object-contain" />
          </Link>

          <div className="w-full max-w-md">
            <div className="mb-5 text-center lg:text-left">
              <h1 className="text-2xl font-black text-[#0F172A]">Welcome Back</h1>
              <p className="text-[#64748B] mt-1 text-sm">Sign in to manage your pilgrimage journey</p>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_4px_32px_rgba(45,49,153,0.08)] border border-[#DCE3F0] p-3 sm:p-6 overflow-hidden">
              <SignIn
                routing="path"
                path={`${basePath}/sign-in`}
                signUpUrl={`${basePath}/sign-up`}
                forceRedirectUrl={`${basePath}/auth/redirect`}
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    cardBox: "w-full shadow-none border-0 bg-transparent",
                    card: "shadow-none border-0 bg-transparent p-0",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    header: "hidden",
                  }
                }}
              />
            </div>

            <div className="mt-5 flex flex-col items-center gap-2">
              <p className="text-center text-xs text-[#94A3B8]">
                Don't have an account?{" "}
                <Link href="/sign-up" className="text-[#2D3199] font-bold hover:underline">Create one free</Link>
              </p>
              <Link href="/forgot-password" className="text-xs text-[#64748B] hover:text-[#2D3199] font-medium hover:underline transition-colors">
                Forgot your password?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
