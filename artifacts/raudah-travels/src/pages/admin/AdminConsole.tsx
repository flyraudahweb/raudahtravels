import { Switch, Route, useRoute, useLocation } from "wouter";
import { Link } from "wouter";
import { useUser, useClerk } from "@clerk/react";

import { basePath } from "@/App";
import { useGetProfile, getGetProfileQueryKey, useGetMyPermissions, getGetMyPermissionsQueryKey } from "@workspace/api-client-react";
import { useEffect, useState, createContext, useContext, useMemo } from "react";
import AdminOverview from "./AdminOverview";
import AdminPackages from "./AdminPackages";
import AdminPayments from "./AdminPayments";
import AdminPilgrims from "./AdminPilgrims";
import AdminBookings from "./AdminBookings";
import AdminAgents from "./AdminAgents";
import AdminAnalytics from "./AdminAnalytics";
import AdminSupport from "./AdminSupport";
import AdminStaff from "./AdminStaff";
import AdminBankAccounts from "./AdminBankAccounts";
import AdminActivity from "./AdminActivity";
import AdminAmendments from "./AdminAmendments";
import AdminVisaManagement from "./AdminVisaManagement";
import AdminIdTags from "./AdminIdTags";
import AdminTeamChat from "./AdminTeamChat";
import AdminBookingForm from "./AdminBookingForm";
import AdminSettings from "./AdminSettings";
import AdminEnquiries from "./AdminEnquiries";
import AdminAiAssistant from "./AdminAiAssistant";
import AdminBookPilgrim from "./AdminBookPilgrim";
import AdminPassports from "./AdminPassports";
import AdminBackup from "./AdminBackup";
import {
  LayoutDashboard, Package, CreditCard, Users, BookOpen, UserCheck,
  TrendingUp, MessageSquare, UserCog, LogOut, Home, ChevronRight,
  Building2, History, Pencil, ShieldCheck, Barcode, MessageCircle,
  FormInput, Settings, Bot, UserPlus, ChevronDown, ChevronUp,
  PanelLeftClose, PanelLeftOpen, LayoutGrid, X, FileImage, Inbox,
  HardDrive,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/* ── Sidebar collapse context ─────────────────────────────────────────────── */

const SidebarCtx = createContext(false);
const useSidebar = () => useContext(SidebarCtx);

function getInitialCollapsed() {
  try { return localStorage.getItem("admin-sidebar-collapsed") === "true"; } catch { return false; }
}

/* ── Nav data ─────────────────────────────────────────────────────────────── */

interface NavGroupDef {
  label: string;
  items: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[];
}

const ALL_NAV_GROUPS: (NavGroupDef & { permKey?: string })[] = [
  {
    label: "Main",
    items: [
      { href: "/admin",           label: "Overview",     icon: LayoutDashboard, exact: true, permKey: "overview" },
      { href: "/admin/analytics", label: "Analytics",    icon: TrendingUp,                   permKey: "analytics" },
      { href: "/admin/ai",        label: "AI Assistant", icon: Bot,                          permKey: "analytics" },
    ] as any[],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/packages",     label: "Packages",         icon: Package,  permKey: "packages" },
      { href: "/admin/bookings",     label: "Bookings",         icon: BookOpen, permKey: "bookings" },
      { href: "/admin/payments",     label: "Payments",         icon: CreditCard, permKey: "payments" },
      { href: "/admin/pilgrims",     label: "Pilgrims",         icon: Users,    permKey: "pilgrims" },
      { href: "/admin/book-pilgrim", label: "Register Pilgrim", icon: UserPlus, permKey: "register_pilgrim" },
    ] as any[],
  },
  {
    label: "Pilgrims & Travel",
    items: [
      { href: "/admin/id-tags",         label: "ID Tags",         icon: Barcode,     permKey: "id_tags" },
      { href: "/admin/passports",       label: "Passports",       icon: FileImage,   permKey: "passports" },
      { href: "/admin/visa-management", label: "Visa Management", icon: ShieldCheck, permKey: "visa_management" },
      { href: "/admin/amendments",      label: "Amendments",      icon: Pencil,       permKey: "amendments" },
    ] as any[],
  },
  {
    label: "Agents & Finance",
    items: [
      { href: "/admin/agents",        label: "Agents",        icon: UserCheck, permKey: "agents" },
      { href: "/admin/bank-accounts", label: "Bank Accounts", icon: Building2, permKey: "bank_accounts" },
    ] as any[],
  },
  {
    label: "System",
    items: [
      { href: "/admin/support",      label: "Support",        icon: MessageSquare, permKey: "support_tickets" },
      { href: "/admin/enquiries",    label: "Enquiries",      icon: Inbox,         permKey: "support_tickets" },
      { href: "/admin/chat",         label: "Team Chat",      icon: MessageCircle, permKey: "team_chat" },
      { href: "/admin/staff",        label: "Staff",          icon: UserCog,       permKey: "staff_management" },
      { href: "/admin/activity",     label: "Activity Log",   icon: History,       permKey: "activity_log" },
      { href: "/admin/booking-form", label: "Booking Form",   icon: FormInput,     permKey: "booking_form" },
      { href: "/admin/backup",       label: "Backup",         icon: HardDrive,     permKey: "settings" },
      { href: "/admin/settings",     label: "Settings",       icon: Settings,      permKey: "settings" },
    ] as any[],
  },
];

/* ── Sub-components ───────────────────────────────────────────────────────── */

function NavItem({ href, label, icon: Icon, exact }: {
  href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean;
}) {
  const [isExact] = useRoute(href);
  const [isNested] = useRoute(`${href}/:rest*`);
  const isActive = exact ? isExact : (isExact || isNested);
  const collapsed = useSidebar();

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center gap-3 rounded-xl transition-all duration-200 text-sm font-medium
        ${collapsed ? "justify-center px-0 py-2.5 mx-1" : "px-4 py-2.5"}
        ${isActive
          ? "bg-white text-[#2D3199] shadow-[0_2px_12px_rgba(255,255,255,0.15)]"
          : "text-white/60 hover:bg-white/8 hover:text-white"
        }`}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF3B00] rounded-r-full" />
      )}
      {isActive && collapsed && (
        <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF3B00] rounded-r-full" />
      )}
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#2D3199]" : "text-white/50 group-hover:text-white"}`} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && isActive && <ChevronRight className="w-3 h-3 text-[#2D3199]/50 shrink-0" />}
    </Link>
  );
}

function NavGroup({ group }: { group: NavGroupDef }) {
  const [sectionCollapsed, setSectionCollapsed] = useState(false);
  const collapsed = useSidebar();

  return (
    <div>
      {!collapsed ? (
        <button
          onClick={() => setSectionCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-4 mb-1 group"
        >
          <p className="text-[9px] font-black text-white/25 uppercase tracking-[0.18em]">{group.label}</p>
          {sectionCollapsed
            ? <ChevronDown className="w-3 h-3 text-white/20 group-hover:text-white/40" />
            : <ChevronUp className="w-3 h-3 text-white/20 group-hover:text-white/40" />}
        </button>
      ) : (
        <div className="flex justify-center mb-1 mt-1">
          <div className="w-6 h-px bg-white/10" />
        </div>
      )}

      {!sectionCollapsed && (
        <div className={`space-y-0.5 ${collapsed ? "flex flex-col items-center" : ""}`}>
          {group.items.map(item => <NavItem key={item.href} {...item} />)}
        </div>
      )}
    </div>
  );
}

const MOBILE_NAV = [
  { href: "/admin",          label: "Home",     icon: LayoutDashboard, exact: true },
  { href: "/admin/bookings", label: "Bookings", icon: BookOpen },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/pilgrims", label: "Pilgrims", icon: Users },
];

function MobileNavItem({ href, label, icon: Icon, exact }: {
  href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean;
}) {
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

function AdminMoreSheet({ open, onClose, navGroups }: { open: boolean; onClose: () => void; navGroups: NavGroupDef[] }) {
  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 border-0" style={{ maxHeight: "80vh" }}>
        <div className="flex flex-col overflow-hidden rounded-t-3xl" style={{ maxHeight: "80vh" }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#F1F5F9] shrink-0">
            <div>
              <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-0.5">Admin Portal</p>
              <h2 className="text-base font-black text-[#0F172A]">All Sections</h2>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center hover:bg-[#E2E8F0] transition-colors">
              <X className="w-4 h-4 text-[#64748B]" />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-4 pb-8 space-y-5">
            {navGroups.map(group => {
              const items = group.items.filter(item => !MOBILE_NAV.find(n => n.href === item.href));
              if (items.length === 0) return null;
              return (
                <div key={group.label}>
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.18em] mb-2 px-1">{group.label}</p>
                  <div className="space-y-0.5">
                    {items.map(item => {
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

/* ── Main layout ──────────────────────────────────────────────────────────── */

export default function AdminConsole() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { data: profile } = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const isStaffOnly = profile?.role === "staff";

  // Redirect non-admin users to their correct portal
  useEffect(() => {
    if (!user) return; // User signed out, let Clerk handle redirect
    if (!profile) return; // Still loading
    if (!["admin", "super_admin", "staff"].includes(profile.role)) {
      setLocation(profile.role === "agent" ? "/agent" : "/dashboard", { replace: true });
    }
  }, [profile, user, setLocation]);
  const { data: myPerms } = useGetMyPermissions({
    query: { queryKey: getGetMyPermissionsQueryKey(), enabled: isStaffOnly },
  });

  const NAV_GROUPS: NavGroupDef[] = useMemo(() => {
    if (!isStaffOnly) return ALL_NAV_GROUPS;
    const allowed = new Set(myPerms?.permissions || []);
    // If the staff member has any support specialties, they must be able to see the Support page
    if ((myPerms?.specialties || []).length > 0) allowed.add("support_tickets");
    return ALL_NAV_GROUPS
      .map(group => ({
        ...group,
        items: (group.items as any[]).filter((item: any) => !item.permKey || allowed.has(item.permKey)),
      }))
      .filter(group => group.items.length > 0);
  }, [isStaffOnly, myPerms?.permissions, myPerms?.specialties]);

  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [moreOpen, setMoreOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem("admin-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  };

  const sidebarW = collapsed ? "w-16" : "w-60";
  const mainMl   = collapsed ? "md:ml-16" : "md:ml-60";

  return (
    <SidebarCtx.Provider value={collapsed}>
      <div className="flex min-h-screen bg-[#F0F2FF]">

        {/* ── Mobile top header ── */}
        <header className="md:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between px-4"
          style={{ background: "linear-gradient(135deg, #12145C 0%, #1E2270 100%)" }}>
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Raudah" className="h-7 w-auto object-contain" style={{ filter: "brightness(0) invert(1)" }} />
            <span className="text-white/40 text-[9px] uppercase tracking-[0.15em] font-semibold">Admin</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-[#FF3B00]/20 text-[#FF3B00] px-2 py-0.5 rounded-full font-bold capitalize">
              {profile?.role?.replace(/_/g, " ")}
            </span>
            <Avatar className="h-8 w-8 ring-2 ring-white/20">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="bg-[#FF3B00] text-white font-black text-xs">
                {profile?.fullName?.charAt(0) || user?.firstName?.charAt(0) || "A"}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* ── Sidebar ── */}
        <aside
          className={`hidden md:flex flex-shrink-0 flex-col fixed top-0 left-0 bottom-0 z-30 transition-[width] duration-300 ease-in-out ${sidebarW}`}
          style={{ background: "linear-gradient(180deg, #12145C 0%, #1C1F66 40%, #1E2270 100%)" }}
        >
          <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(45,49,153,0.6) 0%, transparent 70%)" }} />

          {/* Logo + collapse toggle */}
          <div className={`relative flex items-center border-b border-white/8 ${collapsed ? "justify-center px-0 pt-5 pb-4" : "justify-between px-5 pt-6 pb-4"}`}>
            {!collapsed && (
              <Link href="/" className="flex items-center gap-2 min-w-0">
                <img src="/logo.png" alt="Raudah" className="h-8 w-auto object-contain shrink-0" style={{ filter: "brightness(0) invert(1)" }} />
                <span className="text-white/35 text-[9px] uppercase tracking-[0.15em] font-semibold whitespace-nowrap">Admin</span>
              </Link>
            )}

            {/* Toggle button */}
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`relative flex items-center justify-center rounded-xl transition-all duration-200
                text-white/40 hover:text-white hover:bg-white/10 w-8 h-8 shrink-0
                ${collapsed ? "" : "ml-2"}`}
            >
              {collapsed
                ? <PanelLeftOpen  className="w-4 h-4" />
                : <PanelLeftClose className="w-4 h-4" />
              }
            </button>
          </div>

          {/* User card — full when expanded, avatar-only when collapsed */}
          {!collapsed ? (
            <div className="relative mx-4 mt-4 mb-3 p-3 rounded-2xl border border-white/10"
              style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 ring-2 ring-white/20 shrink-0">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback className="bg-[#FF3B00] text-white font-black text-sm">
                    {profile?.fullName?.charAt(0) || user?.firstName?.charAt(0) || "A"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-xs truncate">{profile?.fullName || user?.fullName}</p>
                  <span className="text-[9px] bg-[#FF3B00]/20 text-[#FF3B00] px-1.5 py-0.5 rounded-full font-bold capitalize tracking-wide">
                    {profile?.role?.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mt-4 mb-3">
              <Avatar className="h-9 w-9 ring-2 ring-white/20" title={profile?.fullName || user?.fullName || ""}>
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="bg-[#FF3B00] text-white font-black text-sm">
                  {profile?.fullName?.charAt(0) || user?.firstName?.charAt(0) || "A"}
                </AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* Nav with styled scrollbar */}
          <nav className="admin-sidebar-nav relative flex-1 overflow-y-auto px-3 pb-4 space-y-4">
            {(NAV_GROUPS as NavGroupDef[]).map(group => (
              <NavGroup key={group.label} group={group} />
            ))}
          </nav>

          {/* Bottom actions */}
          <div className={`relative pb-5 pt-3 border-t border-white/8 space-y-0.5 ${collapsed ? "px-1" : "px-3"}`}>
            {!collapsed ? (
              <>
                <Link href="/"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/8 hover:text-white transition-all font-medium">
                  <Home className="w-4 h-4 shrink-0" /> Main Website
                </Link>
                <button
                  onClick={() => signOut({ redirectUrl: basePath || "/" })}
                  data-testid="button-admin-signout"
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/50 hover:bg-[#FF3B00]/15 hover:text-[#FF3B00] transition-all font-medium group">
                  <LogOut className="w-4 h-4 shrink-0 group-hover:text-[#FF3B00]" /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/" title="Main Website"
                  className="flex justify-center items-center py-2.5 rounded-xl text-white/50 hover:bg-white/8 hover:text-white transition-all">
                  <Home className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => signOut({ redirectUrl: basePath || "/" })}
                  title="Sign Out"
                  data-testid="button-admin-signout"
                  className="w-full flex justify-center items-center py-2.5 rounded-xl text-white/50 hover:bg-[#FF3B00]/15 hover:text-[#FF3B00] transition-all group">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </aside>

        {/* ── Content ── */}
        <main className={`flex-1 overflow-auto pb-24 md:pb-0 pt-14 md:pt-0 min-h-screen transition-[margin] duration-300 ease-in-out ${mainMl}`}>
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
            <Switch>
              <Route path="/admin"              component={AdminOverview} />
              <Route path="/admin/packages"     component={AdminPackages} />
              <Route path="/admin/bookings"     component={AdminBookings} />
              <Route path="/admin/payments"     component={AdminPayments} />
              <Route path="/admin/pilgrims"     component={AdminPilgrims} />
              <Route path="/admin/agents"       component={AdminAgents} />
              <Route path="/admin/analytics"    component={AdminAnalytics} />
              <Route path="/admin/support"      component={AdminSupport} />
              <Route path="/admin/enquiries"    component={AdminEnquiries} />
              <Route path="/admin/staff"        component={AdminStaff} />
              <Route path="/admin/bank-accounts"component={AdminBankAccounts} />
              <Route path="/admin/activity"     component={AdminActivity} />
              <Route path="/admin/amendments"   component={AdminAmendments} />
              <Route path="/admin/visa-management" component={AdminVisaManagement} />
              <Route path="/admin/id-tags"      component={AdminIdTags} />
              <Route path="/admin/chat"         component={AdminTeamChat} />
              <Route path="/admin/booking-form" component={AdminBookingForm} />
              <Route path="/admin/settings"     component={AdminSettings} />
              <Route path="/admin/ai"           component={AdminAiAssistant} />
              <Route path="/admin/book-pilgrim" component={AdminBookPilgrim} />
              <Route path="/admin/passports"    component={AdminPassports} />
              <Route path="/admin/backup"       component={AdminBackup} />
            </Switch>
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40">
          <div className="bg-white/95 backdrop-blur-xl border-t border-[#E2E8F0] shadow-[0_-8px_32px_rgba(45,49,153,0.10)]">
            <div className="flex items-stretch h-16">
              {MOBILE_NAV.map(item => <MobileNavItem key={item.href} {...item} />)}
              <button onClick={() => setMoreOpen(true)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2">
                <div className={`w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${moreOpen ? "bg-[#2D3199]" : ""}`}>
                  <LayoutGrid className={`w-[18px] h-[18px] transition-colors ${moreOpen ? "text-white" : "text-[#94A3B8]"}`} />
                </div>
                <span className={`text-[10px] font-bold transition-colors ${moreOpen ? "text-[#2D3199]" : "text-[#94A3B8]"}`}>More</span>
              </button>
            </div>
          </div>
        </nav>

        <AdminMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} navGroups={NAV_GROUPS} />
      </div>
    </SidebarCtx.Provider>
  );
}
