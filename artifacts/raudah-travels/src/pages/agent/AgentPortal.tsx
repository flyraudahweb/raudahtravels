import { useState, useEffect } from "react";
import { Switch, Route, useRoute, useLocation } from "wouter";
import { Link } from "wouter";
import { useUser, useClerk } from "@clerk/react";

import { basePath } from "@/App";
import AgentOverview from "./AgentOverview";
import AgentBookings from "./AgentBookings";
import AgentCommissions from "./AgentCommissions";
import AgentProfile from "./AgentProfile";
import AgentPackages from "./AgentPackages";
import AgentVisas from "./AgentVisas";
import AgentClients from "./AgentClients";
import AgentWallet from "./AgentWallet";
import DashboardSupport from "@/pages/dashboard/DashboardSupport";
import {
  LayoutDashboard, BookOpen, TrendingUp, User, Map, MessageSquare,
  LogOut, Home, ShieldCheck, Users, Wallet, LayoutGrid, X, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useGetProfile, getGetProfileQueryKey, useGetAgentProfile, getGetAgentProfileQueryKey } from "@workspace/api-client-react";

function NavItem({ href, label, icon: Icon, exact }: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }) {
  const [isActive] = useRoute(exact ? href : `${href}/*`);
  return (
    <Link href={href} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${
      isActive
        ? "bg-white text-[#2D3199] shadow-sm font-bold"
        : "text-white/70 hover:bg-white/10 hover:text-white"
    }`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function MobileNavItem({ href, label, icon: Icon, exact }: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }) {
  const [isActive] = useRoute(exact ? href : `${href}/*`);
  return (
    <Link href={href} className="flex-1 flex flex-col items-center justify-center gap-1 py-2">
      <div className={`w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
        isActive ? "bg-[#2D3199]" : ""
      }`}>
        <Icon className={`w-[18px] h-[18px] transition-colors ${isActive ? "text-white" : "text-[#94A3B8]"}`} />
      </div>
      <span className={`text-[10px] font-bold transition-colors ${isActive ? "text-[#2D3199]" : "text-[#94A3B8]"}`}>
        {label}
      </span>
    </Link>
  );
}

function AgentMoreSheet({ open, onClose, navItems, mobileNavSet }: {
  open: boolean; onClose: () => void;
  navItems: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[];
  mobileNavSet: Set<string>;
}) {
  const extras = navItems.filter(item => !mobileNavSet.has(item.href));
  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 border-0" style={{ maxHeight: "80vh" }}>
        <div className="flex flex-col overflow-hidden rounded-t-3xl" style={{ maxHeight: "80vh" }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#F1F5F9] shrink-0">
            <div>
              <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-0.5">Agent Portal</p>
              <h2 className="text-base font-black text-[#0F172A]">All Sections</h2>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center hover:bg-[#E2E8F0] transition-colors">
              <X className="w-4 h-4 text-[#64748B]" />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-4 pb-8 space-y-0.5">
            {extras.map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={onClose}
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-[#F8FAFF] active:bg-[#EEF0FF] transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0 group-hover:bg-[#2D3199] transition-colors">
                    <Icon className="w-[18px] h-[18px] text-[#2D3199] group-hover:text-white transition-colors" />
                  </div>
                  <span className="font-semibold text-[#334155] text-sm flex-1 group-hover:text-[#2D3199]">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-[#CBD5E1] shrink-0" />
                </Link>
              );
            })}
          </div>
          <div className="border-t border-[#F1F5F9] px-4 py-4">
            <button
              onClick={() => { signOut({ redirectUrl: basePath || "/" }); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-red-50 active:bg-red-100 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0 group-hover:bg-red-200 transition-colors">
                <LogOut className="w-[18px] h-[18px] text-red-600" />
              </div>
              <span className="font-semibold text-red-600 text-sm flex-1">Sign Out</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AgentPortal() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { data: profile } = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const { data: agentProfile } = useGetAgentProfile({ query: { queryKey: getGetAgentProfileQueryKey() } });

  // Redirect non-agent users to their correct portal
  useEffect(() => {
    if (!user) return; // User signed out, let Clerk handle redirect
    if (!profile) return; // Still loading
    if (profile.role !== "agent") {
      setLocation(["admin", "super_admin", "staff"].includes(profile.role) ? "/admin" : "/dashboard", { replace: true });
    }
  }, [profile, user, setLocation]);

  const navItems = [
    { href: "/agent", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/agent/clients", label: "My Clients", icon: Users },
    { href: "/agent/packages", label: "Packages", icon: Map },
    { href: "/agent/bookings", label: "Bookings", icon: BookOpen },
    { href: "/agent/visas", label: "Client Visas", icon: ShieldCheck },
    { href: "/agent/wallet", label: "Wallet", icon: Wallet },
    { href: "/agent/commissions", label: "Commissions", icon: TrendingUp },
    { href: "/agent/support", label: "Support", icon: MessageSquare },
    { href: "/agent/profile", label: "Agency Profile", icon: User },
  ];

  const mobileNav = [
    { href: "/agent", label: "Home", icon: LayoutDashboard, exact: true },
    { href: "/agent/clients", label: "Clients", icon: Users },
    { href: "/agent/wallet", label: "Wallet", icon: Wallet },
    { href: "/agent/profile", label: "Profile", icon: User },
  ];

  const mobileNavSet = new Set(mobileNav.map(n => n.href));
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">

      {/* Mobile top header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between px-4"
        style={{ background: "linear-gradient(135deg, #12145C 0%, #1E2270 100%)" }}>
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Raudah" className="h-7 w-auto object-contain" style={{ filter: "brightness(0) invert(1)" }} />
          <span className="text-white/40 text-[9px] uppercase tracking-[0.15em] font-semibold">Agent Portal</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-white/10 text-white/80 px-2 py-0.5 rounded-full font-bold capitalize truncate max-w-[120px]">
            {agentProfile?.businessName || profile?.fullName || "Agent"}
          </span>
          <Avatar className="h-8 w-8 ring-2 ring-white/20">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="bg-[#2D3199] text-white font-black text-xs">
              {profile?.fullName?.charAt(0) || user?.firstName?.charAt(0) || "A"}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col" style={{ background: "#1C1F66" }}>
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Raudah Travels & Tours"
              className="h-9 w-auto object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <span className="text-white/40 text-[9px] uppercase tracking-widest font-semibold whitespace-nowrap">Agent Portal</span>
          </Link>
        </div>

        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="bg-[#2D3199] text-white font-bold">
                {profile?.fullName?.charAt(0) || user?.firstName?.charAt(0) || "A"}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="font-bold text-white text-sm truncate">{agentProfile?.businessName || profile?.fullName}</p>
              <p className="text-xs text-white/50 truncate">{profile?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1">
          <Button variant="ghost" asChild className="w-full justify-start text-white/60 hover:bg-white/10 hover:text-white rounded-xl">
            <Link href="/"><Home className="w-4 h-4 mr-3" /> Main Site</Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-white/60 hover:bg-white/10 hover:text-white rounded-xl"
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            data-testid="button-agent-signout"
          >
            <LogOut className="w-4 h-4 mr-3" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-24 md:pb-0 pt-14 md:pt-0">
        <div className="p-6 md:p-8 max-w-5xl mx-auto">
          <Switch>
            <Route path="/agent" component={AgentOverview} />
            <Route path="/agent/clients" component={AgentClients} />
            <Route path="/agent/packages" component={AgentPackages} />
            <Route path="/agent/bookings" component={AgentBookings} />
            <Route path="/agent/visas" component={AgentVisas} />
            <Route path="/agent/wallet" component={AgentWallet} />
            <Route path="/agent/commissions" component={AgentCommissions} />
            <Route path="/agent/support" component={DashboardSupport} />
            <Route path="/agent/profile" component={AgentProfile} />
          </Switch>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="bg-white/95 backdrop-blur-xl border-t border-[#E2E8F0] shadow-[0_-8px_32px_rgba(45,49,153,0.10)]">
          <div className="flex items-stretch h-16">
            {mobileNav.map((item) => (
              <MobileNavItem key={item.href} {...item} />
            ))}
            <button onClick={() => setMoreOpen(true)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2">
              <div className={`w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${moreOpen ? "bg-[#2D3199]" : ""}`}>
                <LayoutGrid className={`w-[18px] h-[18px] transition-colors ${moreOpen ? "text-white" : "text-[#94A3B8]"}`} />
              </div>
              <span className={`text-[10px] font-bold transition-colors ${moreOpen ? "text-[#2D3199]" : "text-[#94A3B8]"}`}>More</span>
            </button>
          </div>
        </div>
      </nav>

      <AgentMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} navItems={navItems} mobileNavSet={mobileNavSet} />
    </div>
  );
}
