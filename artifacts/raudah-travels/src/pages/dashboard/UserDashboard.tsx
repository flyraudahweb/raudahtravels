import { useState, useEffect } from "react";
import { Switch, Route, useRoute, useLocation } from "wouter";
import { Link } from "wouter";
import { useUser, useClerk } from "@clerk/react";

import { basePath } from "@/App";
import UserDashboardIndex from "./UserDashboardIndex";
import DashboardBookings from "./DashboardBookings";
import DashboardPayments from "./DashboardPayments";
import DashboardDocuments from "./DashboardDocuments";
import DashboardVisa from "./DashboardVisa";
import DashboardProfile from "./DashboardProfile";
import DashboardSupport from "./DashboardSupport";
import DashboardNotifications from "./DashboardNotifications";
import DashboardAmendments from "./DashboardAmendments";
import BookingWizard from "./BookingWizard";
import DashboardPayExisting from "./DashboardPayExisting";
import {
  LayoutDashboard, BookOpen, CreditCard, FileText, User, LogOut,
  Map, Bell, MessageSquare, Home, ChevronRight, ShieldCheck, Pencil,
  LayoutGrid, X
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useGetProfile, getGetProfileQueryKey, useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";

function NavItem({ href, label, icon: Icon, exact, badge }: {
  href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; badge?: number;
}) {
  const [isExact] = useRoute(href);
  const [isNested] = useRoute(`${href}/:rest*`);
  const isActive = exact ? isExact : (isExact || isNested);
  return (
    <Link href={href} className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm ${
      isActive
        ? "bg-white text-[#2D3199] font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15)]"
        : "text-white/60 hover:bg-white/8 hover:text-white font-medium"
    }`}>
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF3B00] rounded-r-full" />
      )}
      <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-[#2D3199]" : "text-white/50 group-hover:text-white"}`} />
      <span className="flex-1 truncate">{label}</span>
      {badge && badge > 0 ? (
        <span className="bg-[#FF3B00] text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-black px-1 shrink-0">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; badge?: boolean }[] }[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/bookings", label: "My Bookings", icon: BookOpen },
      { href: "/dashboard/packages", label: "Browse Packages", icon: Map },
    ]
  },
  {
    label: "Finance & Travel",
    items: [
      { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
      { href: "/dashboard/documents", label: "Documents", icon: FileText },
      { href: "/dashboard/visa", label: "Visa & Tickets", icon: ShieldCheck },
    ]
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/amendments", label: "Amendments", icon: Pencil },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell, badge: true },
      { href: "/dashboard/support", label: "Support", icon: MessageSquare },
      { href: "/dashboard/profile", label: "Profile", icon: User },
    ]
  },
];

const MOBILE_NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/bookings", label: "Bookings", icon: BookOpen },
  { href: "/dashboard/payments", label: "Pay", icon: CreditCard },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

function PilgrimMoreSheet({ open, onClose, unreadCount }: { open: boolean; onClose: () => void; unreadCount: number }) {
  const mobileSet = new Set(MOBILE_NAV.map(n => n.href));
  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 border-0" style={{ maxHeight: "80vh" }}>
        <div className="flex flex-col overflow-hidden rounded-t-3xl" style={{ maxHeight: "80vh" }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#F1F5F9] shrink-0">
            <div>
              <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-0.5">Pilgrim Portal</p>
              <h2 className="text-base font-black text-[#0F172A]">All Sections</h2>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center hover:bg-[#E2E8F0] transition-colors">
              <X className="w-4 h-4 text-[#64748B]" />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-4 pb-8 space-y-5">
            {NAV_GROUPS.map(group => {
              const items = group.items.filter(item => !mobileSet.has(item.href));
              if (items.length === 0) return null;
              return (
                <div key={group.label}>
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.18em] mb-2 px-1">{group.label}</p>
                  <div className="space-y-0.5">
                    {items.map(item => {
                      const Icon = item.icon;
                      const badge = item.badge && unreadCount > 0 ? unreadCount : 0;
                      return (
                        <Link key={item.href} href={item.href} onClick={onClose}
                          className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-[#F8FAFF] active:bg-[#EEF0FF] transition-colors group">
                          <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0 group-hover:bg-[#2D3199] transition-colors">
                            <Icon className="w-[18px] h-[18px] text-[#2D3199] group-hover:text-white transition-colors" />
                          </div>
                          <span className="font-semibold text-[#334155] text-sm flex-1 group-hover:text-[#2D3199]">{item.label}</span>
                          {badge > 0 && (
                            <span className="bg-[#FF3B00] text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-black px-1">
                              {badge > 99 ? "99+" : badge}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-[#CBD5E1] shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="border-t border-[#F1F5F9] pt-5">
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
        </div>
      </SheetContent>
    </Sheet>
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

export default function UserDashboard() {
  const { user, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { data: profile, isLoading: isProfileLoading } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey(), enabled: !!isSignedIn },
  });
  const { data: notifData } = useListNotifications({}, {
    query: { queryKey: getListNotificationsQueryKey({}), enabled: !!isSignedIn },
  });

  // ── Auth gate: redirect to sign-in if not authenticated ──────────────────
  useEffect(() => {
    if (!isClerkLoaded) return;
    if (!isSignedIn) {
      setLocation("/sign-in", { replace: true });
      return;
    }
    if (!profile) return;
    if (!["user", "pilgrim"].includes(profile.role)) {
      setLocation(["admin", "super_admin", "staff"].includes(profile.role) ? "/admin" : "/agent", { replace: true });
    }
  }, [isClerkLoaded, isSignedIn, profile, setLocation]);

  const unreadCount = notifData?.unreadCount || 0;
  const displayName = profile?.fullName || user?.fullName || "Pilgrim";
  const initials = displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const [moreOpen, setMoreOpen] = useState(false);

  // ── Block rendering until auth is confirmed ──────────────────────────────
  if (!isClerkLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0F2FF]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#2D3199] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#64748B]">Checking authentication…</p>
        </div>
      </div>
    );
  }

  if (isProfileLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0F2FF]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#2D3199] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#64748B]">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (!["user", "pilgrim"].includes(profile.role)) {
    return null;
  }

  return (
      <div className="flex min-h-screen bg-[#F0F2FF]">

      {/* ── Mobile top header ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between px-4"
        style={{ background: "linear-gradient(135deg, #12145C 0%, #1E2270 100%)" }}>
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Raudah" className="h-7 w-auto object-contain" style={{ filter: "brightness(0) invert(1)" }} />
          <span className="text-white/40 text-[9px] uppercase tracking-[0.15em] font-semibold">Pilgrim Portal</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-white/10 text-white/80 px-2 py-0.5 rounded-full font-bold capitalize">
            {profile?.fullName?.split(" ")[0] || user?.firstName || "Pilgrim"}
          </span>
          <Avatar className="h-8 w-8 ring-2 ring-white/20">
            <AvatarImage src={profile?.avatarUrl || user?.imageUrl} />
            <AvatarFallback className="bg-[#2D3199] text-white font-black text-xs">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-[240px] flex-shrink-0 flex-col fixed top-0 left-0 bottom-0 z-30"
        style={{ background: "linear-gradient(180deg, #12145C 0%, #1C1F66 40%, #1E2270 100%)" }}>

        {/* Subtle top glow */}
        <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(45,49,153,0.6) 0%, transparent 70%)" }} />

        {/* Brand */}
        <div className="relative px-5 pt-6 pb-5">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Raudah Travels & Tours"
              className="h-9 w-auto object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <span className="text-white/35 text-[9px] uppercase tracking-[0.15em] font-semibold whitespace-nowrap">Pilgrim Portal</span>
          </Link>
        </div>

        {/* User card */}
        <div className="relative mx-4 mb-5 p-3 rounded-2xl border border-white/10"
          style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-white/20">
              <AvatarImage src={profile?.avatarUrl || user?.imageUrl} />
              <AvatarFallback className="bg-[#2D3199] text-white font-black text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate leading-tight">{displayName}</p>
              <p className="text-white/40 text-[10px] truncate mt-0.5">
                {profile?.email || user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <Link href="/dashboard/profile"
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-white/60" />
            </Link>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="relative flex-1 overflow-y-auto px-3 space-y-5 pb-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[9px] font-black text-white/25 uppercase tracking-[0.18em] px-4 mb-1.5">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem
                    key={item.href}
                    {...item}
                    badge={item.badge ? unreadCount : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="relative px-3 pb-5 pt-3 border-t border-white/8 space-y-0.5">
          <Link href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/8 hover:text-white transition-all font-medium">
            <Home className="w-4 h-4 shrink-0" />
            <span>Main Website</span>
          </Link>
          <button
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            data-testid="button-sign-out"
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/50 hover:bg-[#FF3B00]/15 hover:text-[#FF3B00] transition-all font-medium group">
            <LogOut className="w-4 h-4 shrink-0 group-hover:text-[#FF3B00]" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <main className="flex-1 md:ml-[240px] overflow-auto pb-24 md:pb-0 pt-14 md:pt-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          <Switch>
            <Route path="/dashboard" component={UserDashboardIndex} />
            <Route path="/dashboard/bookings" component={DashboardBookings} />
            <Route path="/dashboard/packages" component={() => {
              window.location.href = "/packages";
              return null;
            }} />
            <Route path="/dashboard/payments" component={DashboardPayments} />
            <Route path="/dashboard/documents" component={DashboardDocuments} />
            <Route path="/dashboard/visa" component={DashboardVisa} />
            <Route path="/dashboard/profile" component={DashboardProfile} />
            <Route path="/dashboard/notifications" component={DashboardNotifications} />
            <Route path="/dashboard/support" component={DashboardSupport} />
            <Route path="/dashboard/amendments" component={DashboardAmendments} />
            <Route path="/dashboard/bookings/:id/pay" component={DashboardPayExisting} />
            <Route path="/dashboard/book/:id" component={BookingWizard} />
          </Switch>
        </div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="bg-white/95 backdrop-blur-xl border-t border-[#E2E8F0] shadow-[0_-8px_32px_rgba(45,49,153,0.10)]">
          <div className="flex items-stretch h-16">
            {MOBILE_NAV.map((item) => (
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

      <PilgrimMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} unreadCount={unreadCount} />
      </div>
  );
}
