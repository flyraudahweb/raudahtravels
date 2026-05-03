import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2,
  XCircle, MessageSquare, Plus, RefreshCw, Printer,
} from "lucide-react";

function printReceipt(t: WalletTransaction, balance: number) {
  const isCredit = ["topup", "commission"].includes(t.type);
  const typeLabel = t.type === "topup" ? "Wallet Top-Up" : t.type === "commission" ? "Commission Credit" : t.type === "debit" ? "Debit" : t.type === "withdrawal" ? "Withdrawal" : "Payment";
  const date = new Date(t.createdAt).toLocaleString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const w = window.open("", "_blank", "width=480,height=680");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wallet Receipt</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#111;max-width:400px;margin:0 auto;}
  .header{text-align:center;border-bottom:3px solid #2D3199;padding-bottom:14px;margin-bottom:18px;}
  .logo{font-size:20px;font-weight:900;color:#2D3199;letter-spacing:1px;}
  .sub{font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:2px;margin-top:2px;}
  .badge{display:inline-block;padding:5px 14px;border-radius:999px;font-size:11px;font-weight:900;text-transform:uppercase;background:${isCredit ? "#D1FAE5" : "#FEE2E2"};color:${isCredit ? "#065F46" : "#991B1B"};margin:10px 0;}
  .amount{font-size:42px;font-weight:900;color:${isCredit ? "#059669" : "#EF4444"};text-align:center;margin:14px 0 18px;}
  .row{display:flex;justify-content:space-between;font-size:12px;padding:8px 0;border-bottom:1px solid #F1F5F9;}
  .label{color:#64748B;font-weight:600;}
  .val{font-weight:700;color:#0F172A;text-align:right;max-width:60%;}
  .footer{text-align:center;font-size:10px;color:#94A3B8;margin-top:18px;padding-top:12px;border-top:1px solid #E2E8F0;line-height:1.6;}
  @media print{body{padding:0;}}
</style></head><body>
<div class="header">
  <div class="logo">RAUDAH TRAVELS &amp; TOURS</div>
  <div class="sub">Agent Wallet Receipt</div>
</div>
<div style="text-align:center;"><div class="badge">${isCredit ? "CREDIT" : "DEBIT"}</div></div>
<div class="amount">${isCredit ? "+" : "−"}₦${t.amount.toLocaleString()}</div>
<div class="row"><span class="label">Transaction Type</span><span class="val">${typeLabel}</span></div>
<div class="row"><span class="label">Date &amp; Time</span><span class="val">${date}</span></div>
${t.description ? `<div class="row"><span class="label">Description</span><span class="val">${t.description}</span></div>` : ""}
<div class="row"><span class="label">Reference</span><span class="val">${t.id.slice(0, 14).toUpperCase()}</span></div>
<div class="row"><span class="label">Status</span><span class="val">${t.status.charAt(0).toUpperCase() + t.status.slice(1)}</span></div>
<div class="row"><span class="label">Wallet Balance</span><span class="val">₦${balance.toLocaleString()}</span></div>
<div class="footer">Raudah Travels &amp; Tours · Official Hajj &amp; Umrah Operator<br>This is a computer-generated receipt and does not require a signature.</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
  w.document.close();
}

interface WalletTransaction {
  id: string; type: string; amount: number; description?: string;
  status: string; createdAt: string;
}
interface WalletData { balance: number; transactions: WalletTransaction[]; }

const TYPE_CFG: Record<string, { label: string; color: string; icon: typeof ArrowDownLeft; dir: "in" | "out" }> = {
  topup:      { label: "Top-up",      color: "text-emerald-600", icon: ArrowDownLeft, dir: "in" },
  commission: { label: "Commission",  color: "text-emerald-600", icon: ArrowDownLeft, dir: "in" },
  debit:      { label: "Debit",       color: "text-red-500",     icon: ArrowUpRight,  dir: "out" },
  withdrawal: { label: "Withdrawal",  color: "text-red-500",     icon: ArrowUpRight,  dir: "out" },
  payment:    { label: "Payment",     color: "text-[#2D3199]",   icon: ArrowUpRight,  dir: "out" },
};

const STATUS_CFG: Record<string, { label: string; icon: typeof Clock }> = {
  pending:   { label: "Pending",   icon: Clock },
  completed: { label: "Completed", icon: CheckCircle2 },
  failed:    { label: "Failed",    icon: XCircle },
};

export default function AgentWallet() {
  const { data, isLoading, refetch, isFetching } = useQuery<WalletData>({
    queryKey: ["agent-wallet"],
    queryFn: () => fetch("/api/agents/wallet", { credentials: "include" }).then(r => r.json()),
    staleTime: 30000,
  });

  const balance = data?.balance ?? 0;
  const transactions = data?.transactions ?? [];

  const totalIn  = transactions.filter(t => TYPE_CFG[t.type]?.dir === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => TYPE_CFG[t.type]?.dir === "out").reduce((s, t) => s + t.amount, 0);

  const fmtCurrency = (n: number) =>
    n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `₦${(n / 1_000).toFixed(1)}K`
    : `₦${n.toLocaleString()}`;

  return (
    <div className="space-y-6 max-w-2xl" data-testid="page-agent-wallet">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D3199]/60 mb-1">AGENT PORTAL</p>
        <h1 className="text-3xl font-black text-[#1C1F66] tracking-tight">Wallet</h1>
        <p className="text-[#64748B] text-sm mt-1">Your commission wallet balance and transaction history</p>
      </div>

      {/* Balance card */}
      {isLoading ? (
        <Skeleton className="h-44 rounded-2xl" />
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D3199] via-[#3D4699] to-[#1C1F66] p-7 text-white shadow-xl">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-12 -right-4 w-52 h-52 rounded-full bg-white/[0.03]" />
          <div className="absolute top-1/2 -left-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                  <Wallet className="w-5.5 h-5.5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Available Balance</p>
                  <p className="text-[10px] text-white/40 font-semibold">Commission Wallet</p>
                </div>
              </div>
              <button onClick={() => refetch()} disabled={isFetching}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <RefreshCw className={`w-4 h-4 text-white/70 ${isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
            <p className="text-5xl font-black tabular-nums mb-1">{fmtCurrency(balance)}</p>
            <p className="text-white/50 text-sm font-semibold">Nigerian Naira</p>

            <div className="grid grid-cols-2 gap-4 mt-7 pt-5 border-t border-white/10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Total Received</p>
                <p className="text-xl font-black text-emerald-400 mt-0.5">{fmtCurrency(totalIn)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Total Used</p>
                <p className="text-xl font-black text-red-400 mt-0.5">{fmtCurrency(totalOut)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top-up request info */}
      <div className="bg-[#EEF0FF] border border-[#C7CBF5] rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#2D3199] flex items-center justify-center shrink-0">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-[#1C1F66] text-sm">Need a Wallet Top-up?</h3>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Wallet top-ups are processed by Raudah Travels admin. Contact our team via Support and they will credit your wallet.
              Commission earnings are automatically added after each confirmed booking.
            </p>
            <Button asChild size="sm" className="mt-3 bg-[#2D3199] hover:bg-[#252880] rounded-xl font-black text-xs h-9 gap-2">
              <Link href="/agent/support">
                <MessageSquare className="w-3.5 h-3.5" /> Contact Support
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F5F9]">
          <h2 className="font-black text-[#1C1F66] text-sm">Transaction History</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            {transactions.length > 0 ? `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}` : "No transactions yet"}
          </p>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-3">
              <TrendingUp className="w-6 h-6 text-[#CBD5E1]" />
            </div>
            <p className="font-black text-[#94A3B8] text-sm">No transactions yet</p>
            <p className="text-xs text-[#CBD5E1] mt-1 max-w-xs">
              Transactions appear here when your wallet is topped up or when commissions are paid.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {transactions.map(t => {
              const typeCfg = TYPE_CFG[t.type] || { label: t.type, color: "text-[#64748B]", icon: ArrowDownLeft, dir: "in" as const };
              const statusCfg = STATUS_CFG[t.status] || STATUS_CFG.completed;
              const TypeIcon = typeCfg.icon;
              const StatusIcon = statusCfg.icon;
              const isCredit = typeCfg.dir === "in";
              return (
                <div key={t.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#FAFBFF] transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isCredit ? "bg-emerald-100" : "bg-red-50"
                    }`}>
                      <TypeIcon className={`w-4.5 h-4.5 ${typeCfg.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-[#1C1F66] text-sm capitalize">{typeCfg.label}</p>
                      {t.description && <p className="text-xs text-[#94A3B8] truncate">{t.description}</p>}
                      <p className="text-[10px] text-[#CBD5E1]">
                        {new Date(t.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      <StatusIcon className={`w-3.5 h-3.5 ${t.status === "completed" ? "text-emerald-500" : t.status === "failed" ? "text-red-500" : "text-amber-500"}`} />
                      <p className={`text-[10px] font-black capitalize hidden sm:block ${t.status === "completed" ? "text-emerald-600" : t.status === "failed" ? "text-red-500" : "text-amber-600"}`}>
                        {statusCfg.label}
                      </p>
                    </div>
                    <p className={`font-black text-base tabular-nums ${isCredit ? "text-emerald-600" : "text-red-500"}`}>
                      {isCredit ? "+" : "−"}₦{t.amount.toLocaleString()}
                    </p>
                    <button
                      onClick={() => printReceipt(t, balance)}
                      title="Print receipt"
                      className="w-8 h-8 rounded-lg bg-[#F1F5F9] hover:bg-[#EEF0FF] flex items-center justify-center transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#64748B]" />
                    </button>
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
