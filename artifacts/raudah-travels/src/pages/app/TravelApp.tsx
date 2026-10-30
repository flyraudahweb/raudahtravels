import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { SignIn, SignUp, UserButton, useUser } from "@clerk/react";
import { useListPackages } from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronRight,
  Compass,
  Headphones,
  Heart,
  MapPin,
  Package,
  Plane,
  ShieldCheck,
  Ticket,
  UserRound,
} from "lucide-react";
import TravelSearchForm from "@/components/ota/TravelSearchForm";
import aircraft from "@/assets/images/hero-aircraft.jpg";
import makkah from "@/assets/images/hero-kaaba.png";
import madinah from "@/assets/images/medina-mosque.png";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const focusStyle =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199] focus-visible:ring-offset-4";

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/app"
      aria-label="Raudah app home"
      className={`inline-flex items-center gap-2.5 rounded-lg ${focusStyle}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF4E00] text-white">
        <Plane size={23} aria-hidden="true" />
      </span>
      <span
        className={`text-xl font-black tracking-tight ${light ? "text-white" : "text-[#252976]"}`}
      >
        raudah<span className="text-[#FF4E00]">.</span>
        <span
          className={`block text-[9px] font-bold uppercase tracking-[.25em] ${light ? "text-indigo-200" : "text-slate-500"}`}
        >
          Travel & tours
        </span>
      </span>
    </Link>
  );
}

function PackagesSection() {
  const packages = useListPackages({ limit: 3, available: true });
  return (
    <section
      id="app-packages"
      tabIndex={-1}
      aria-labelledby="app-packages-heading"
      className="scroll-mt-6 outline-none"
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-[#FF4E00]">
            Journeys with meaning
          </p>
          <h2
            id="app-packages-heading"
            className="text-xl font-black tracking-tight text-slate-900"
          >
            Hajj & Umrah packages
          </h2>
        </div>
        <Link
          href="/packages"
          className={`flex shrink-0 items-center gap-1 rounded-lg text-xs font-bold text-[#2D3199] ${focusStyle}`}
        >
          View all <ArrowRight size={15} />
        </Link>
      </div>
      {packages.isLoading ? (
        <div
          role="status"
          aria-label="Loading packages"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-72 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : packages.isError ? (
        <div
          role="alert"
          className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600"
        >
          We couldn’t load packages right now.{" "}
          <button
            type="button"
            onClick={() => void packages.refetch()}
            className={`rounded font-bold text-[#2D3199] ${focusStyle}`}
          >
            Try again
          </button>
        </div>
      ) : !packages.data?.packages.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="font-bold text-slate-900">
            Let’s plan your pilgrimage.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Contact our team for upcoming Hajj and Umrah departures.
          </p>
          <Link
            href="/contact"
            className={`mt-4 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-[#2D3199] ${focusStyle}`}
          >
            Talk to our team <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {packages.data.packages.map((pkg) => (
            <Link
              key={pkg.id}
              href={`/packages/${pkg.id}`}
              className={`group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-indigo-300 ${focusStyle}`}
            >
              <div className="relative h-40 overflow-hidden bg-indigo-50">
                <img
                  loading="lazy"
                  src={
                    pkg.imageUrl ||
                    (pkg.type.toLowerCase().includes("umrah")
                      ? madinah
                      : makkah)
                  }
                  alt={pkg.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
                />
                <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#2D3199]">
                  {pkg.type}
                </span>
              </div>
              <div className="p-4">
                <h3 className="truncate font-bold text-slate-900">
                  {pkg.name}
                </h3>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarDays size={13} />
                  {pkg.durationDays} days
                  <span className="mx-1 text-slate-300">·</span>
                  {pkg.starRating}-star stay
                </p>
                <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-[10px] text-slate-500">
                      From, per person
                    </p>
                    <p className="mt-0.5 text-lg font-black text-[#2D3199]">
                      {new Intl.NumberFormat("en-NG", {
                        style: "currency",
                        currency: "NGN",
                        maximumFractionDigits: 0,
                      }).format(pkg.price)}
                    </p>
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F1FC] text-[#2D3199]">
                    <ArrowRight size={16} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function AppHome() {
  const { user, isSignedIn } = useUser();
  return (
    <>
      <header className="mb-6 flex items-center justify-between gap-4 md:mb-8">
        <div>
          <p className="text-xs text-slate-500">
            {isSignedIn
              ? `Welcome back${user?.firstName ? `, ${user.firstName}` : ""}`
              : "Welcome to Raudah"}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
            <MapPin size={12} className="text-[#FF4E00]" /> Nigeria{" "}
            <span className="mx-1 text-slate-300">/</span> NGN
          </p>
        </div>
        {isSignedIn ? (
        <UserButton />
        ) : (
          <Link
            href="/app/login"
            className={`rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#2D3199] ${focusStyle}`}
          >
            Log in <span aria-hidden="true">↗</span>
          </Link>
        )}
      </header>
      <section
        aria-labelledby="app-hero-heading"
        className="relative mb-7 overflow-hidden rounded-[26px] bg-[#202563] text-white"
      >
        <img
          src={aircraft}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[64%_center] opacity-40 sm:opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1C205E]/95 via-[#1C205E]/65 to-transparent" />
        <div className="relative max-w-xl px-6 py-8 sm:px-8 sm:py-10">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-indigo-100">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF4E00]" /> Your next
            chapter
          </p>
          <h1
            id="app-hero-heading"
            className="text-[32px] font-black leading-[1.12] tracking-tight text-white sm:text-[42px]"
          >
            A world of journeys.
            <br />
            <span className="text-[#FF8149]">One simple start.</span>
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-indigo-50">
            Flights, comfortable stays and meaningful pilgrimages. All with
            Raudah.
          </p>
        </div>
        <span className="absolute bottom-5 right-5 hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-semibold text-white sm:flex">
          <ShieldCheck size={14} /> Your journey, thoughtfully arranged.
        </span>
      </section>
      <section
        id="app-book"
        tabIndex={-1}
        aria-labelledby="app-book-heading"
        className="mb-8 scroll-mt-6 outline-none"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            id="app-book-heading"
            className="text-xl font-black tracking-tight text-slate-900"
          >
            Where are we going?
          </h2>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck size={13} className="text-[#2D3199]" /> Prices in naira
          </span>
        </div>
        <TravelSearchForm
          variant="app"
          compact
          packagesSectionId="app-packages"
        />
        <ol
          aria-label="How booking works"
          className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-slate-500"
        >
          {[
            "Find your journey",
            "Review your details",
            "Pay & track your booking",
          ].map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-[#2D3199]">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>
      <Link
        href={isSignedIn ? "/dashboard/my-trips" : "/app/login"}
        className={`mb-9 flex items-center gap-4 rounded-2xl bg-[#ECEEF9] p-5 ${focusStyle}`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#2D3199]">
          <Ticket size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-[#252976]">
            Your next trip, all in one place.
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {isSignedIn
              ? "View your bookings, travel documents and updates."
              : "Log in to keep your bookings and travel updates together."}
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-[#2D3199]" />
      </Link>
      <PackagesSection />
      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <Headphones size={22} className="text-[#FF4E00]" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              A little help goes a long way.
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Our team is here for your travel questions.
            </p>
          </div>
        </div>
        <Link
          href="/contact"
          className={`flex items-center gap-1 rounded text-xs font-bold text-[#2D3199] ${focusStyle}`}
        >
          Get in touch <ArrowRight size={14} />
        </Link>
      </section>
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-500">
        <span>© {new Date().getFullYear()} Raudah Travels & Tours</span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-[#2D3199]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#2D3199]">
            Terms
          </Link>
        </div>
      </footer>
    </>
  );
}

const authAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full max-w-none shadow-none border-0",
    card: "w-full p-0 bg-transparent shadow-none border-0",
    header: "hidden",
    footer: "bg-transparent",
    footerAction: "hidden",
    formFieldInput: "min-h-12 rounded-xl border-slate-200 text-base",
    formButtonPrimary:
      "min-h-12 rounded-xl bg-[#2D3199] text-sm font-bold shadow-none",
    socialButtonsBlockButton: "min-h-12 rounded-xl border-slate-200",
  },
};

function AppAuth({ signup }: { signup: boolean }) {
  const { isLoaded } = useUser();
  return (
    <main className="flex min-h-[100dvh] bg-[#FAFAFC]">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#202563] p-10 text-white lg:flex xl:p-14">
        <img
          src={aircraft}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[58%_center] opacity-25"
        />
        <div className="relative">
          <Brand light />
        </div>
        <div className="relative my-12">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs text-indigo-100">
            <Heart size={13} className="text-[#FF8149]" /> Travel, with a
            personal touch.
          </span>
          <h2 className="text-5xl font-black leading-[1.1] tracking-tight text-white">
            Your next journey
            <br />
            starts with <span className="text-[#FF8149]">you.</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-indigo-100">
            From a quick getaway to a journey of faith. Make room for what
            matters.
          </p>
          <div className="mt-8 space-y-4">
            {[
              [Plane, "Find flights that fit your plans"],
              [Building2, "Explore your next stay"],
              [Ticket, "Keep your bookings together"],
            ].map(([Icon, label]: any) => (
              <div
                key={label}
                className="flex items-center gap-3 text-sm text-indigo-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <Icon size={17} />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-indigo-200">
          Raudah Travels & Tours · Your journey, thoughtfully arranged.
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/app"
            className={`flex items-center gap-2 rounded-lg text-xs font-semibold text-slate-500 ${focusStyle}`}
          >
            <ArrowLeft size={16} /> Back to explore
          </Link>
          <Link
            href={signup ? "/app/login" : "/app/signup"}
            className={`rounded-lg text-xs font-bold text-[#2D3199] ${focusStyle}`}
          >
            {signup ? "Log in" : "Create account"}
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#FF4E00]">
            {signup ? "Let’s make new memories" : "Good to see you again"}
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            {signup ? "Your journey starts here." : "Welcome back."}
          </h1>
          <p className="mb-8 mt-3 text-sm leading-relaxed text-slate-500">
            {signup
              ? "Create your Raudah account to plan, book and keep your travels together."
              : "Log in to pick up your plans and find your next adventure."}
          </p>
          <div className="min-h-64 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            {!isLoaded ? (
              <p
                role="status"
                className="py-10 text-center text-sm text-slate-500"
              >
                Preparing secure sign-in…
              </p>
            ) : signup ? (
              <SignUp
                routing="path"
                path={`${base}/app/signup`}
                signInUrl={`${base}/app/login`}
                forceRedirectUrl={`${base}/app`}
                appearance={authAppearance}
              />
            ) : (
              <SignIn
                routing="path"
                path={`${base}/app/login`}
                signUpUrl={`${base}/app/signup`}
                forceRedirectUrl={`${base}/app`}
                appearance={authAppearance}
              />
            )}
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            {signup ? "Already travelling with us?" : "New to Raudah?"}{" "}
            <Link
              href={signup ? "/app/login" : "/app/signup"}
              className={`rounded font-bold text-[#2D3199] ${focusStyle}`}
            >
              {signup ? "Log in" : "Create an account"}
            </Link>
          </p>
          <p className="mt-8 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck size={13} /> One account for all your Raudah journeys.
          </p>
        </div>
        <div className="flex justify-center gap-5 text-[11px] text-slate-500">
          <Link href="/terms">Terms of service</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/contact">Help</Link>
        </div>
      </div>
    </main>
  );
}

function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const { isSignedIn } = useUser();
  const items = [
    { label: "Explore", href: "/app", Icon: Compass, active: true },
    {
      label: "My trips",
      href: isSignedIn ? "/dashboard/my-trips" : "/app/login",
      Icon: Ticket,
      active: false,
    },
    { label: "Packages", href: "/packages", Icon: Package, active: false },
    {
      label: "Account",
      href: isSignedIn ? "/dashboard/profile" : "/app/login",
      Icon: UserRound,
      active: false,
    },
  ];
  return (
    <nav
      aria-label={mobile ? "App bottom navigation" : "App navigation"}
      className={mobile ? "grid grid-cols-4" : "space-y-2"}
    >
      {items.map(({ label, href, Icon, active }) => (
        <Link
          key={label}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`${focusStyle} ${mobile ? "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px]" : "flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm"} ${active ? (mobile ? "font-bold text-[#2D3199]" : "bg-[#ECEEF9] font-bold text-[#2D3199]") : "text-slate-500 hover:bg-slate-50 hover:text-[#2D3199]"}`}
        >
          <Icon size={mobile ? 21 : 19} strokeWidth={active ? 2.5 : 1.7} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default function TravelApp() {
  const [location, navigate] = useLocation();
  const { isLoaded, isSignedIn } = useUser();
  const login = /^\/app\/login(?:\/|$)/.test(location);
  const signup = /^\/app\/signup(?:\/|$)/.test(location);
  const auth = login || signup;
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (auth && isLoaded && isSignedIn) navigate("/app", { replace: true });
  }, [location, auth, isLoaded, isSignedIn, navigate]);
  if (auth)
    return isSignedIn ? (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center text-[#2D3199]"
      >
        Taking you to your journeys…
      </div>
    ) : (
      <AppAuth signup={signup} />
    );
  if (location !== "/app" && location !== "/app/")
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div>
          <h1 className="text-xl font-bold">This page hasn’t landed yet.</h1>
          <Link
            href="/app"
            className="mt-4 inline-flex text-sm font-bold text-[#2D3199]"
          >
            Back to explore
          </Link>
        </div>
      </div>
    );
  return (
    <div className="min-h-[100dvh] bg-[#FAFAFC] text-slate-900">
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[224px] flex-col border-r border-slate-200 bg-white px-5 py-8 md:flex">
        <div className="px-2">
          <Brand />
        </div>
        <p className="mb-4 mt-12 px-4 text-[9px] font-bold uppercase tracking-[.2em] text-slate-400">
          Your travel companion
        </p>
        <AppNavigation />
        <div className="mt-auto">
          <div className="mb-5 rounded-2xl bg-[#F7F5F1] p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#FF4E00]">
              <Headphones size={17} />
            </span>
            <p className="mt-3 text-xs font-bold">Travel with a little help.</p>
            <Link
              href="/contact"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#2D3199]"
            >
              Contact our team <ArrowRight size={12} />
            </Link>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 px-3 text-xs text-slate-500"
          >
            <ArrowLeft size={14} /> Visit our website
          </Link>
        </div>
      </aside>
      <div className="border-b border-slate-100 bg-white px-5 py-4 md:hidden">
        <Brand />
      </div>
      <main
        id="app-main"
        className="px-4 pb-28 pt-6 sm:px-7 md:ml-[224px] md:px-8 md:pb-10 lg:px-12"
      >
        <div className="mx-auto max-w-[1100px]">
          <AppHome />
        </div>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-1 md:hidden">
        <AppNavigation mobile />
      </div>
    </div>
  );
}
