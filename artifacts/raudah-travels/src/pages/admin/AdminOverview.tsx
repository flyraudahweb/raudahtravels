import { useGetAdminOverview, getGetAdminOverviewQueryKey, useListBookings, getListBookingsQueryKey, useListPayments, getListPaymentsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { DollarSign, Users, Package, Clock, UserCheck, LifeBuoy, TrendingUp, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

const PIE_COLORS = ["#2D3199", "#FF3B00", "#10B981", "#F59E0B"];

function StatCard({ label, value, icon: Icon, gradient, trend }: {
  label: string; value: string | number;
  icon: typeof DollarSign; gradient: string; trend?: string;
}) {
  const display = String(value);
  const isLong = display.length > 7;
  return (
    <div className={`relative overflow-hidden rounded-2xl p-3.5 sm:p-5 text-white ${gradient}`}>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 bg-white -translate-y-8 translate-x-8" />
      <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full opacity-5 bg-white translate-y-6 -translate-x-6" />
      <div className="relative">
        <div className="flex items-start justify-between gap-1 mb-2.5">
          <p className="text-white/70 text-[10px] sm:text-xs font-semibold uppercase tracking-widest leading-tight min-w-0 break-words">{label}</p>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
        <p className={`font-black leading-tight break-all ${isLong ? "text-lg sm:text-2xl" : "text-2xl sm:text-3xl"}`}>
          {display}
        </p>
        {trend && (
          <p className="flex items-center gap-1 text-white/70 text-[10px] sm:text-xs mt-1.5">
            <ArrowUpRight className="w-3 h-3 shrink-0" /> {trend}
          </p>
        )}
      </div>
    </div>
  );
}

const statusStyle: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
};

export default function AdminOverview() {
  const { data: overview, isLoading } = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey(), staleTime: 0, refetchOnMount: true } });
  const { data: bookingsData } = useListBookings({ limit: 5 } as Record<string, unknown>, { query: { queryKey: getListBookingsQueryKey({ limit: 5 } as Record<string, unknown>), staleTime: 0 } });
  const { data: paymentsData } = useListPayments({ status: "pending" } as Record<string, unknown>, { query: { queryKey: getListPaymentsQueryKey({ status: "pending" } as Record<string, unknown>), staleTime: 0 } });

  const rawRevenue = overview?.totalRevenue || 0;
  const fmtRev = (n: number) =>
    n >= 1_000_000_000 ? `₦${(n / 1_000_000_000).toFixed(1)}B`
    : n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `₦${(n / 1_000).toFixed(0)}K`
    : `₦${n.toLocaleString()}`;
  const revenueDisplay = fmtRev(rawRevenue);
  const ov2 = overview as any;
  const expectedRev = ov2?.expectedRevenue || 0;
  const revTrend = rawRevenue === 0 && expectedRev > 0
    ? `Expected: ${fmtRev(expectedRev)}`
    : "All time";

  const stats = [
    { label: "Total Revenue", value: revenueDisplay, icon: DollarSign, gradient: "bg-gradient-to-br from-[#2D3199] to-[#4C56B8]", trend: revTrend },
    { label: "Total Pilgrims", value: overview?.totalPilgrims || 0, icon: Users, gradient: "bg-gradient-to-br from-[#059669] to-[#10B981]", trend: "Registered" },
    { label: "Active Packages", value: overview?.activePackages || 0, icon: Package, gradient: "bg-gradient-to-br from-[#7C3AED] to-[#A78BFA]", trend: "Live now" },
    { label: "Pending Payments", value: overview?.pendingPayments || 0, icon: Clock, gradient: "bg-gradient-to-br from-[#D97706] to-[#F59E0B]", trend: "Need review" },
    { label: "Total Agents", value: overview?.totalAgents || 0, icon: UserCheck, gradient: "bg-gradient-to-br from-[#0284C7] to-[#38BDF8]", trend: "Approved" },
    { label: "Open Tickets", value: overview?.openSupportTickets || 0, icon: LifeBuoy, gradient: "bg-gradient-to-br from-[#DC2626] to-[#F87171]", trend: "Needs attention" },
  ];

  const ov = overview as any;
  const hajjVsUmrah = ov?.hajjVsUmrah;
  const bookingTypeData = hajjVsUmrah
    ? [
        { name: "Hajj", value: hajjVsUmrah.hajj, pct: hajjVsUmrah.hajjPercent, color: "#2D3199" },
        { name: "Umrah", value: hajjVsUmrah.umrah, pct: hajjVsUmrah.umrahPercent, color: "#FF3B00" },
      ]
    : [
        { name: "Hajj", value: 0, pct: 0, color: "#2D3199" },
        { name: "Umrah", value: 0, pct: 0, color: "#FF3B00" },
      ];

  return (
    <div className="space-y-7" data-testid="page-admin-overview">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Admin Console</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Platform Overview</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Welcome back — here's what's happening today</p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-[#DCE3F0] text-sm text-[#64748B]">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          System operational
        </div>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stats.map(s => <StatCard key={s.label} {...s} />)}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Revenue area chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-black text-[#0F172A] text-base">Revenue Trend</p>
              <p className="text-[#64748B] text-xs mt-0.5">Monthly revenue performance</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" /> Growing
            </div>
          </div>
          {overview?.revenueByMonth && overview.revenueByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={overview.revenueByMonth}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2D3199" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2D3199" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, "Revenue"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #DCE3F0", fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#2D3199" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3, fill: "#2D3199" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-[#94A3B8] text-sm">
              No revenue data yet
            </div>
          )}
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] p-5">
          <p className="font-black text-[#0F172A] text-base mb-1">Package Split</p>
          <p className="text-[#64748B] text-xs mb-5">Hajj vs Umrah bookings</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={bookingTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={3}>
                {bookingTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #DCE3F0", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {bookingTypeData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                  <span className="text-[#475569] font-medium">{d.name}</span>
                </div>
                <span className="font-bold text-[#0F172A]">{d.value} <span className="text-[#94A3B8] text-xs font-normal">({d.pct}%)</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent bookings */}
        <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)]">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#F1F5F9]">
            <p className="font-black text-[#0F172A] text-base">Recent Bookings</p>
            <Link href="/admin/bookings" className="text-[#2D3199] text-xs font-bold hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#F8F9FF]">
            {!bookingsData?.bookings?.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F0F2FF] flex items-center justify-center mb-3">
                  <Package className="w-5 h-5 text-[#2D3199]/40" />
                </div>
                <p className="text-[#94A3B8] text-sm">No bookings yet</p>
              </div>
            ) : bookingsData.bookings.map(b => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F8F9FF] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#EEF0FF] flex items-center justify-center font-black text-[#2D3199] text-sm shrink-0">
                    {(b.user?.fullName || "P").charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F172A] text-sm">{b.user?.fullName || "Pilgrim"}</p>
                    <p className="text-[#94A3B8] text-xs truncate max-w-[140px]">{b.package?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <p className="font-bold text-[#0F172A] text-sm">₦{b.totalPrice.toLocaleString()}</p>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold capitalize border ${statusStyle[b.status] || statusStyle.pending}`}>{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending payments */}
        <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)]">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#F1F5F9]">
            <p className="font-black text-[#0F172A] text-base">Pending Payments</p>
            <Link href="/admin/payments" className="text-[#2D3199] text-xs font-bold hover:underline flex items-center gap-1">
              Review all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#F8F9FF]">
            {!paymentsData?.payments?.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-[#94A3B8] text-sm">All clear — no pending payments</p>
              </div>
            ) : paymentsData.payments.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F8F9FF] transition-colors">
                <div>
                  <p className="font-bold text-[#0F172A] text-sm">₦{p.amount.toLocaleString()}</p>
                  <p className="text-[#94A3B8] text-xs capitalize">{p.method.replace("_", " ")} · {new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <Link href="/admin/payments"
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#EEF0FF] text-[#2D3199] hover:bg-[#2D3199] hover:text-white transition-colors">
                  Verify
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
