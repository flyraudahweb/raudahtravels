import { SignUp } from "@clerk/react";
import { Link } from "wouter";
import { Thermometer, MapPin, Clock, Calendar, CheckCircle2, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";

export default function SignUpPage() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const liveDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  const liveTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const perks = [
    "Browse & book Hajj and Umrah packages",
    "Track your application in real-time",
    "Dedicated 24/7 support team",
    "Secure Nigerian Naira payments",
  ];

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
                Start Your Spiritual Journey
              </p>
              <h2 className="text-4xl font-black text-white leading-tight">
                Begin Your<br />
                <span className="text-[#FF3B00]">Hajj &amp; Umrah</span><br />
                Journey Today
              </h2>
            </div>

            {/* Perks */}
            <ul className="space-y-3">
              {perks.map((p) => (
                <li key={p} className="flex items-start gap-3 text-white/75 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-[#FF3B00] shrink-0 mt-0.5" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

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
              <h1 className="text-2xl font-black text-[#0F172A]">Create Your Account</h1>
              <p className="text-[#64748B] mt-1 text-sm">Book your pilgrimage in minutes — it's free</p>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_4px_32px_rgba(45,49,153,0.08)] border border-[#DCE3F0] p-3 sm:p-6 overflow-hidden">
              <SignUp
                routing="path"
                path={`${basePath}/sign-up`}
                signInUrl={`${basePath}/sign-in`}
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

            <p className="mt-5 text-center text-xs text-[#94A3B8]">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-[#2D3199] font-bold hover:underline">Sign in here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
