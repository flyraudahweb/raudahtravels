import { Link, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plane, Search, Shield, Sparkles, Menu, X, ArrowLeft } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";

const navLinks = [
  { href: "/flights", label: "Search", icon: Search },
  { href: "/flights/admin", label: "Admin", icon: Shield },
] as const;

function NavLink({ href, label, icon: Icon }: (typeof navLinks)[number]) {
  const [isActive] = useRoute(href === "/flights" ? "/flights" : `${href}/*?`);
  const [isSearchActive] = useRoute("/flights/search");
  const active = href === "/flights" ? (isActive || isSearchActive) : isActive;

  return (
    <Link
      href={href}
      className={`
        relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300
        ${active
          ? "text-white bg-primary/90 shadow-brand"
          : "text-primary/80 hover:text-primary hover:bg-white/50"
        }
      `}
    >
      <Icon className="w-4 h-4" />
      {label}
      {active && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute inset-0 rounded-lg bg-primary shadow-brand -z-10"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </Link>
  );
}

interface FlightsLayoutProps {
  children: ReactNode;
}

export default function FlightsLayout({ children }: FlightsLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEEDF7] via-[#F6F5FC] to-[#F0F4FF] relative">
      {/* Decorative background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary/3 rounded-full blur-3xl" />
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Brand */}
            <Link href="/flights" className="flex items-center gap-2.5 group">
              <div className="relative">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-brand group-hover:shadow-brand-lg transition-shadow duration-300">
                  <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-white rotate-[-30deg]" />
                </div>
                <Sparkles className="absolute -top-1 -right-1 w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent opacity-80" />
              </div>
              <div className="flex flex-col">
                <span className="text-base sm:text-lg font-black tracking-tight text-primary leading-none">
                  Raudah Flights
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
                  Premium Booking
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <NavLink key={link.href} {...link} />
              ))}
              <Link
                href="/"
                className="ml-3 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-white/40 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Main Site
              </Link>
            </nav>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden w-9 h-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="sm:hidden overflow-hidden border-t border-white/20"
            >
              <div className="px-4 py-3 space-y-1.5">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-foreground hover:bg-white/50 transition-colors"
                  >
                    <link.icon className="w-4 h-4 text-primary" />
                    {link.label}
                  </Link>
                ))}
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-white/50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Main Site
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={typeof window !== "undefined" ? window.location.pathname : ""}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
