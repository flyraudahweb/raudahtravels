import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { BookOpen, CreditCard, Bell, Plane, ArrowRight, TrendingUp, CheckCircle2, Clock, XCircle, CalendarDays, Users } from "lucide-react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  pending:   { label: "Pending",   color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",  icon: Clock },
  confirmed: { label: "Confirmed", color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-red-500",    bg: "bg-red-50 border-red-200",      icon: XCircle },
  completed: { label: "Completed", color: "text-[#2D3199]",  bg: "bg-[#EEF0FF] border-[#DCE3F0]",icon: CheckCircle2 },
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 100_000)       return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toLocaleString()}`;
}
function fmtMoneyFull(n: number): string {
  return `₦${n.toLocaleString()}`;
}

const STAT_CARDS = [
  {
    key: "totalBookings",
    label: "Total Bookings",
    sub: (s: Record<string,number>) => `${s.confirmedBookings ?? 0} confirmed`,
    icon: BookOpen,
    gradient: "from-[#2D3199] to-[#4C56B8]",
    glow: "rgba(45,49,153,0.25)",
  },
  {
    key: "totalAmountPaid",
    label: "Amount Paid",
    format: true,
    sub: (s: Record<string,number>) => `${fmtMoney(s.totalAmountDue ?? 0)} remaining`,
    icon: CreditCard,
    gradient: "from-[#FF3B00] to-[#FF6B35]",
    glow: "rgba(255,59,0,0.20)",
  },
  {
    key: "upcomingCount",
    label: "Upcoming Trips",
    sub: () => "Departures scheduled",
    icon: Plane,
    gradient: "from-[#0EA5E9] to-[#38BDF8]",
    glow: "rgba(14,165,233,0.20)",
  },
  {
    key: "unreadNotifications",
    label: "Notifications",
    sub: () => "Unread messages",
    icon: Bell,
    gradient: "from-[#8B5CF6] to-[#A78BFA]",
    glow: "rgba(139,92,246,0.20)",
  },
];

export default function UserDashboardIndex() {
  const { user } = useUser();
  const { data: profile } = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const { data: summary, isLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const firstName = profile?.fullName?.split(" ")[0] || user?.firstName || "Pilgrim";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const statsValues: Record<string, number> = {
    totalBookings: summary?.totalBookings ?? 0,
    confirmedBookings: summary?.confirmedBookings ?? 0,
    totalAmountPaid: summary?.totalAmountPaid ?? 0,
    totalAmountDue: summary?.totalAmountDue ?? 0,
    upcomingCount: summary?.upcomingDepartures?.length ?? 0,
    unreadNotifications: summary?.unreadNotifications ?? 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-32 rounded-3xl bg-white/60" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl bg-white/60" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 rounded-2xl bg-white/60" />
          <div className="h-64 rounded-2xl bg-white/60" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8"
        style={{ background: "linear-gradient(135deg, #1C1F66 0%, #2D3199 60%, #4C56B8 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-white/60 text-sm font-semibold mb-1">{greeting},</p>
            <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-2">
              {firstName} 👋
            </h1>
            <p className="text-white/55 text-sm max-w-sm">
              Manage your Hajj &amp; Umrah journey from your personal pilgrim portal.
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2 shrink-0">
            <Link href="/packages"
              className="flex items-center gap-2 px-4 py-2 bg-[#FF3B00] hover:bg-[#D63200] text-white text-sm font-bold rounded-full transition-colors shadow-[0_4px_14px_rgba(255,59,0,0.35)]">
              Book a Package <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Mobile CTA */}
        <Link href="/packages"
          className="md:hidden mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#FF3B00] hover:bg-[#D63200] text-white text-sm font-bold rounded-full transition-colors">
          Book a Package <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(card => {
          const Icon = card.icon;
          const raw = statsValues[card.key] ?? 0;
          const mobileVal = card.format ? fmtMoney(raw) : raw.toString();
          const desktopVal = card.format ? fmtMoneyFull(raw) : raw.toString();
          const desktopLen = desktopVal.length;
          const desktopSize = desktopLen > 11 ? "text-base" : desktopLen > 8 ? "text-lg" : "text-xl";
          return (
            <div key={card.key} className="relative bg-white rounded-2xl p-4 sm:p-5 border border-[#DCE3F0] overflow-hidden"
              style={{ boxShadow: `0 4px 24px ${card.glow}` }}>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] opacity-10 pointer-events-none"
                style={{ background: `linear-gradient(135deg, transparent, ${card.glow.replace('0.20','1').replace('0.25','1')})` }} />
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-3 sm:mb-4 shadow-sm`}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <p className="text-[10px] sm:text-[11px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1 truncate">{card.label}</p>
              {/* Mobile: abbreviated value */}
              <p className={`md:hidden text-2xl font-black text-[#0F172A] leading-none mb-1 truncate`}>{mobileVal}</p>
              {/* Desktop: full value */}
              <p className={`hidden md:block ${desktopSize} font-black text-[#0F172A] leading-none mb-1 truncate`}>{desktopVal}</p>
              <p className="text-[11px] sm:text-xs text-[#94A3B8] font-medium truncate">{card.sub(statsValues)}</p>
            </div>
          );
        })}
      </div>

      {/* Lower panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden shadow-[0_2px_16px_rgba(45,49,153,0.05)]">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF3B00] to-[#FF6B35] flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-black text-[#0F172A] text-base">Recent Payments</h2>
            </div>
            <Link href="/dashboard/payments"
              className="text-xs font-bold text-[#2D3199] hover:text-[#FF3B00] flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="px-6 py-4">
            {summary?.recentPayments && summary.recentPayments.length > 0 ? (
              <div className="space-y-3">
                {summary.recentPayments.slice(0, 5).map(payment => {
                  const isVerified = payment.status === "verified";
                  const isRejected = payment.status === "rejected";
                  return (
                    <div key={payment.id} className="flex items-center justify-between py-2.5 border-b border-[#F8F9FF] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isVerified ? "bg-emerald-50" : isRejected ? "bg-red-50" : "bg-amber-50"
                        }`}>
                          {isVerified ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                           isRejected ? <XCircle className="w-4 h-4 text-red-400" /> :
                           <Clock className="w-4 h-4 text-amber-500" />}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F172A] text-sm">₦{payment.amount.toLocaleString()}</p>
                          <p className="text-[11px] text-[#94A3B8]">
                            {new Date(payment.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border capitalize ${
                        isVerified ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        isRejected ? "bg-red-50 text-red-600 border-red-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {payment.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-3">
                  <TrendingUp className="w-6 h-6 text-[#94A3B8]" />
                </div>
                <p className="text-sm font-bold text-[#334155] mb-1">No payments yet</p>
                <p className="text-xs text-[#94A3B8]">Your payment history will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Trips */}
        <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden shadow-[0_2px_16px_rgba(45,49,153,0.05)]">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-black text-[#0F172A] text-base">Upcoming Trips</h2>
            </div>
            <Link href="/dashboard/bookings"
              className="text-xs font-bold text-[#2D3199] hover:text-[#FF3B00] flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="px-6 py-4">
            {summary?.upcomingDepartures && summary.upcomingDepartures.length > 0 ? (
              <div className="space-y-3">
                {summary.upcomingDepartures.map(trip => {
                  const cfg = STATUS_CONFIG[trip.status] || STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={trip.id}
                      className="flex items-start gap-4 p-4 rounded-2xl border border-[#F1F5F9] hover:border-[#DCE3F0] hover:shadow-sm transition-all bg-[#FAFBFF]">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D3199]/10 to-[#4C56B8]/10 flex items-center justify-center shrink-0">
                        <Plane className="w-5 h-5 text-[#2D3199]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#0F172A] text-sm truncate mb-1">
                          {trip.package?.name || "Pilgrimage Package"}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-[#64748B]">
                          {trip.package?.departureDate && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {new Date(trip.package.departureDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {trip.pilgrimCount} pilgrim{trip.pilgrimCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <span className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full border capitalize shrink-0 ${cfg.bg} ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-3">
                  <Plane className="w-6 h-6 text-[#94A3B8]" />
                </div>
                <p className="text-sm font-bold text-[#334155] mb-1">No upcoming trips</p>
                <p className="text-xs text-[#94A3B8] mb-4">Your booked pilgrimages will appear here</p>
                <Link href="/packages"
                  className="px-5 py-2 bg-[#2D3199] text-white text-xs font-bold rounded-full hover:bg-[#25297F] transition-colors">
                  Browse Packages
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick links row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/packages", label: "Browse Packages", icon: "🕌", color: "from-[#2D3199] to-[#4C56B8]" },
          { href: "/dashboard/documents", label: "My Documents", icon: "📄", color: "from-[#2D3199] to-[#4C56B8]" },
          { href: "/dashboard/support", label: "Get Support", icon: "💬", color: "from-[#2D3199] to-[#4C56B8]" },
          { href: "/dashboard/profile", label: "Edit Profile", icon: "👤", color: "from-[#2D3199] to-[#4C56B8]" },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className={`group flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${item.color} text-white hover:opacity-90 transition-opacity shadow-sm`}>
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm font-bold leading-tight">{item.label}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-60 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
