import { useGetAgentOverview, getGetAgentOverviewQueryKey, useGetAgentProfile, getGetAgentProfileQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Users, BookOpen, TrendingUp, ArrowUpRight, ChevronRight, CheckCircle2, UserPlus, ArrowDownLeft, Printer } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface WalletTx { id: string; type: string; amount: number; description?: string; createdAt: string; }

function printWalletReceipt(tx: WalletTx, agentBalance: number) {
  const isCredit = ["topup", "commission"].includes(tx.type);
  const typeLabel = tx.type === "topup" ? "Wallet Top-Up" : tx.type === "commission" ? "Commission Credit" : tx.type === "debit" ? "Debit" : tx.type === "booking_payment" ? "Booking Payment" : "Payment";
  const date = new Date(tx.createdAt).toLocaleString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wallet Receipt</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#111;}
  .header{text-align:center;border-bottom:2px solid #2D3199;padding-bottom:12px;margin-bottom:16px;}
  .logo{font-size:18px;font-weight:900;color:#2D3199;letter-spacing:1px;}
  .sub{font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:2px;}
  .receipt-title{font-size:13px;font-weight:700;color:#64748B;margin:12px 0 4px;}
  .amount{font-size:36px;font-weight:900;color:${isCredit ? "#059669" : "#EF4444"};text-align:center;margin:16px 0;}
  .row{display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #F1F5F9;}
  .label{color:#64748B;font-weight:600;}
  .val{font-weight:700;color:#0F172A;}
  .footer{text-align:center;font-size:10px;color:#94A3B8;margin-top:16px;padding-top:12px;border-top:1px solid #E2E8F0;}
  @media print{body{padding:0;}}
</style></head><body>
<div class="header">
  <div class="logo">RAUDAH TRAVELS &amp; TOURS</div>
  <div class="sub">Agent Wallet Receipt</div>
</div>
<div style="text-align:center;margin-bottom:12px;">
  <div style="display:inline-block;padding:6px 16px;border-radius:999px;font-size:11px;font-weight:900;text-transform:uppercase;background:${isCredit ? "#D1FAE5" : "#FEE2E2"};color:${isCredit ? "#065F46" : "#991B1B"};">${isCredit ? "CREDIT" : "DEBIT"}</div>
</div>
<div class="amount">${isCredit ? "+" : "−"}₦${Math.abs(tx.amount).toLocaleString()}</div>
<div class="row"><span class="label">Transaction Type</span><span class="val">${typeLabel}</span></div>
<div class="row"><span class="label">Date &amp; Time</span><span class="val">${date}</span></div>
${tx.description ? `<div class="row"><span class="label">Description</span><span class="val">${tx.description}</span></div>` : ""}
<div class="row"><span class="label">Reference</span><span class="val">${tx.id.slice(0, 12).toUpperCase()}</span></div>
<div class="row"><span class="label">Wallet Balance After</span><span class="val">₦${agentBalance.toLocaleString()}</span></div>
<div class="footer">Raudah Travels &amp; Tours · Official Hajj &amp; Umrah Operator<br>This is a computer-generated receipt.</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
  w.document.close();
}

const STATUS_PILL: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border border-amber-200",
  cancelled: "bg-red-100 text-red-700 border border-red-200",
  completed: "bg-blue-100 text-blue-700 border border-blue-200",
};

export default function AgentOverview() {
  const { user } = useUser();
  const { data: overview, isLoading } = useGetAgentOverview({ query: { queryKey: getGetAgentOverviewQueryKey() } });
  const { data: agentProfile } = useGetAgentProfile({ query: { queryKey: getGetAgentProfileQueryKey() } });
  const { data: walletData } = useQuery<{ balance: number; transactions: WalletTx[] }>({
    queryKey: ["agent-wallet"],
    queryFn: () => fetch("/api/agents/wallet", { credentials: "include" }).then(r => r.json()),
    staleTime: 30000,
  });
  const recentTxs = (walletData?.transactions ?? []).slice(0, 4);

  const fmtCurrency = (n: number) =>
    n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `₦${(n / 1_000).toFixed(0)}K`
    : `₦${n.toLocaleString()}`;

  const stats = [
    {
      label: "Wallet Balance",
      value: fmtCurrency(overview?.walletBalance || 0),
      icon: Wallet,
      gradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
      trend: "Available balance",
      href: "/agent/wallet",
    },
    {
      label: "Total Earned",
      value: fmtCurrency(overview?.totalCommissionsEarned || 0),
      icon: TrendingUp,
      gradient: "bg-gradient-to-br from-[#FF3B00] to-[#FF6B35]",
      trend: "All commissions",
      href: "/agent/commissions",
    },
    {
      label: "Active Bookings",
      value: overview?.activeBookings ?? 0,
      icon: BookOpen,
      gradient: "bg-gradient-to-br from-[#2D3199] to-[#4C56B8]",
      trend: "Confirmed",
      href: "/agent/bookings",
    },
    {
      label: "Total Clients",
      value: overview?.totalClients ?? 0,
      icon: Users,
      gradient: "bg-gradient-to-br from-[#7C3AED] to-[#A78BFA]",
      trend: "Registered",
      href: "/agent/clients",
    },
  ];

  const quickActions = [
    {
      href: "/agent/clients",
      label: "Register a Client",
      sub: "Quickly add pilgrims to a package",
      icon: UserPlus,
      gradient: "from-[#FF3B00] to-[#FF6B35]",
    },
    {
      href: "/agent/packages",
      label: "Browse Packages",
      sub: "View available Hajj & Umrah packages",
      icon: BookOpen,
      gradient: "from-[#2D3199] to-[#4C56B8]",
    },
    {
      href: "/agent/wallet",
      label: "View Wallet",
      sub: "Check balance & transaction history",
      icon: Wallet,
      gradient: "from-emerald-500 to-teal-600",
    },
  ];

  return (
    <div className="space-y-8" data-testid="page-agent-overview">
      {/* Page header */}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D3199]/60 mb-1">AGENT PORTAL</p>
        <h1 className="text-3xl font-black text-[#1C1F66] tracking-tight">Agent Overview</h1>
        <p className="text-[#64748B] text-sm mt-1">Your business performance at a glance</p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.label} href={stat.href}>
                <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-transform ${stat.gradient}`}>
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
                  <div className="absolute -bottom-6 -right-2 w-24 h-24 rounded-full bg-white/5" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/70">{stat.label}</p>
                      <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                    <p className="text-2xl font-black tabular-nums">{stat.value}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <ArrowUpRight className="w-3 h-3 text-white/70" />
                      <p className="text-[10px] text-white/70 font-semibold">{stat.trend}</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Wallet Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D3199] via-[#3D4699] to-[#1C1F66] shadow-xl text-white">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-14 -left-6 w-56 h-56 rounded-full bg-white/[0.03]" />
        <div className="relative p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">Commission Wallet</p>
              <p className="text-4xl font-black tabular-nums">
                {walletData ? `₦${(walletData.balance ?? 0).toLocaleString()}` : <span className="opacity-40">—</span>}
              </p>
              <p className="text-xs text-white/50 mt-1 font-semibold">Available balance</p>
            </div>
            <Link href="/agent/wallet">
              <div className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-4 py-2 cursor-pointer">
                <Wallet className="w-4 h-4 text-white" />
                <span className="text-xs font-bold text-white whitespace-nowrap">Full Wallet</span>
                <ChevronRight className="w-3.5 h-3.5 text-white/70" />
              </div>
            </Link>
          </div>

          {/* Recent transactions */}
          {recentTxs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-3">Recent Transactions</p>
              {recentTxs.map(tx => {
                const isCredit = ["topup", "commission"].includes(tx.type);
                const typeLabel = tx.type === "topup" ? "Top-up" : tx.type === "commission" ? "Commission" : tx.type === "debit" ? "Debit" : tx.type === "booking_payment" ? "Booking" : "Payment";
                return (
                  <div key={tx.id} className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isCredit ? "bg-emerald-500/30" : "bg-red-500/30"}`}>
                        <ArrowDownLeft className={`w-3.5 h-3.5 ${isCredit ? "text-emerald-300" : "text-red-300"} ${!isCredit ? "rotate-180" : ""}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{typeLabel}</p>
                        {tx.description && <p className="text-[10px] text-white/50 truncate">{tx.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`text-sm font-black tabular-nums ${isCredit ? "text-emerald-300" : "text-red-300"}`}>
                        {isCredit ? "+" : "−"}₦{Math.abs(tx.amount).toLocaleString()}
                      </p>
                      <button onClick={() => printWalletReceipt(tx, walletData?.balance ?? 0)}
                        title="Print receipt"
                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors">
                        <Printer className="w-3 h-3 text-white/70" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white/10 rounded-xl px-4 py-4 text-center">
              <p className="text-xs text-white/50 font-semibold">No transactions yet — commissions will appear here after confirmed bookings.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Bookings */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
            <div>
              <h2 className="font-black text-[#1C1F66] text-sm">Recent Clients</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">Latest registered clients</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-[#2D3199] hover:bg-[#EEF0FF] text-xs font-bold h-8 px-3 rounded-lg">
              <Link href="/agent/clients">View all <ChevronRight className="w-3.5 h-3.5 ml-1" /></Link>
            </Button>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {!overview?.recentBookings?.length ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-[#CBD5E1]" />
                </div>
                <p className="font-bold text-[#94A3B8] text-sm">No clients yet</p>
                <p className="text-xs text-[#CBD5E1] mt-1">Start registering pilgrims for available packages</p>
                <Button asChild size="sm" className="mt-4 bg-[#FF3B00] hover:bg-[#D63200] rounded-xl text-xs gap-2">
                  <Link href="/agent/clients"><UserPlus className="w-3.5 h-3.5" /> Register Client</Link>
                </Button>
              </div>
            ) : (
              overview.recentBookings.slice(0, 5).map((b) => (
                <div key={b.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#FAFBFF] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
                      <span className="text-sm font-black text-[#2D3199]">
                        {((b as any).fullName || "?").charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#1C1F66] text-sm truncate">{(b as any).fullName || b.package?.name || "Client"}</p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">{b.package?.name || "Package"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-black text-[#1C1F66] text-sm">₦{b.totalPrice.toLocaleString()}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black capitalize ${STATUS_PILL[b.status] || "bg-slate-100 text-slate-600"}`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-3">
          <div className="px-1">
            <h2 className="font-black text-[#1C1F66] text-sm">Quick Actions</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">Jump to what you need</p>
          </div>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <div className={`flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r ${action.gradient} shadow-md cursor-pointer hover:scale-[1.02] transition-transform`}>
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white text-sm">{action.label}</p>
                    <p className="text-white/70 text-xs">{action.sub}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/60 shrink-0" />
                </div>
              </Link>
            );
          })}

          {/* Status indicator */}
          <div className="mt-4 rounded-2xl bg-[#EEF0FF] border border-[#C7CBF5] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-[#2D3199] flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="font-black text-[#2D3199] text-xs">Your Account Status</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs text-[#2D3199]/70 font-semibold">Active Agent</p>
            </div>
            <p className="text-[10px] text-[#2D3199]/50 mt-1">You can register clients and earn commissions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
