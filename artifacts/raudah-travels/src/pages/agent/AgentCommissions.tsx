import { useListCommissions, getListCommissionsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, CheckCircle2, Clock, ArrowUpRight, Wallet, XCircle } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; pill: string; icon: typeof Clock }> = {
  pending:   { label: "Pending",   pill: "bg-amber-100 text-amber-700 border border-amber-200",  icon: Clock },
  paid:      { label: "Paid",      pill: "bg-emerald-100 text-emerald-700 border border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", pill: "bg-red-100 text-red-700 border border-red-200",        icon: XCircle },
};

export default function AgentCommissions() {
  const { data, isLoading } = useListCommissions({}, { query: { queryKey: getListCommissionsQueryKey({}) } });
  const commissions = data?.commissions || [];

  const totalEarned = commissions.filter(c => c.status === "paid").reduce((sum, c) => sum + c.amount, 0);
  const pending = commissions.filter(c => c.status === "pending").reduce((sum, c) => sum + c.amount, 0);
  const cancelled = commissions.filter(c => (c.status as string) === "cancelled").reduce((sum, c) => sum + c.amount, 0);

  const fmtCurrency = (n: number) =>
    n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `₦${(n / 1_000).toFixed(0)}K`
    : `₦${n.toLocaleString()}`;

  return (
    <div className="space-y-6" data-testid="page-agent-commissions">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D3199]/60 mb-1">AGENT PORTAL</p>
        <h1 className="text-3xl font-black text-[#1C1F66] tracking-tight">Commissions</h1>
        <p className="text-[#64748B] text-sm mt-1">Track your earnings from client bookings</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -right-2 w-24 h-24 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/70">Total Earned</p>
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-black tabular-nums">{fmtCurrency(totalEarned)}</p>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight className="w-3 h-3 text-white/70" />
              <p className="text-[10px] text-white/70 font-semibold">Paid out</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-amber-500 to-orange-500">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -right-2 w-24 h-24 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/70">Pending</p>
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-black tabular-nums">{fmtCurrency(pending)}</p>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight className="w-3 h-3 text-white/70" />
              <p className="text-[10px] text-white/70 font-semibold">Awaiting confirmation</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-[#2D3199] to-[#4C56B8]">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -right-2 w-24 h-24 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/70">Total Records</p>
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-black tabular-nums">{commissions.length}</p>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight className="w-3 h-3 text-white/70" />
              <p className="text-[10px] text-white/70 font-semibold">All time commissions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Commission history */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F5F9]">
          <h2 className="font-black text-[#1C1F66] text-sm">Commission History</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">All your commission records</p>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : commissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-3">
              <Wallet className="w-6 h-6 text-[#CBD5E1]" />
            </div>
            <p className="font-black text-[#94A3B8] text-sm">No commissions yet</p>
            <p className="text-xs text-[#CBD5E1] mt-1 max-w-xs">Commissions are earned when client bookings are confirmed.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {commissions.map((c) => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
              const CfgIcon = cfg.icon;
              return (
                <div key={c.id} data-testid={`row-commission-${c.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-[#FAFBFF] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <p className="font-black text-[#1C1F66] text-sm">Commission #{c.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-[#94A3B8]">{new Date(c.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-black capitalize ${cfg.pill}`}>
                      <CfgIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    <p className="font-black text-[#1C1F66] text-base min-w-[80px] text-right">₦{c.amount.toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
