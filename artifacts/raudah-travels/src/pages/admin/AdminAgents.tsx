import { useState } from "react";
import {
  useListAgentApplications, getListAgentApplicationsQueryKey,
  useApproveAgentApplication, useRejectAgentApplication,
  useCreateAgentDirect,
  useListAgents, getListAgentsQueryKey,
  useGetAgentPackageDiscountsAdmin, getGetAgentPackageDiscountsAdminQueryKey,
  useSetAgentPackageDiscount, useDeleteAgentPackageDiscount,
  useUpdateAgentCommission,
  useListPackages, getListPackagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  UserCheck, CheckCircle2, XCircle, Building2, BadgeCheck, Plus, UserPlus,
  Wallet, TrendingUp, Percent, DollarSign, Tag, Trash2, Edit3,
  Eye, EyeOff, Loader2, ChevronDown, Clock, RefreshCw, Users, CreditCard, Phone, Mail, MapPin, X, ChevronRight, Download,
  ShieldBan, ShieldCheck, Ban, AlertTriangle, ChevronLeft,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtN(n: number) { return `₦${n.toLocaleString()}`; }

/* ─── Create Agent Dialog ─────────────────────────────────────────────── */

function CreateAgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const createAgent = useCreateAgentDirect();
  const [form, setForm] = useState({
    fullName: "", businessName: "", email: "", phone: "",
    tempPassword: "", commissionType: "percentage", commissionRate: "0",
  });
  const [showPw, setShowPw] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "" }));
  };

  const handleCreate = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = "Required";
    if (!form.businessName.trim()) e.businessName = "Required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required";
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.tempPassword.trim() || form.tempPassword.length < 8) e.tempPassword = "Min 8 characters";
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    createAgent.mutate({
      data: {
        fullName: form.fullName,
        businessName: form.businessName,
        email: form.email,
        phone: form.phone,
        tempPassword: form.tempPassword,
        commissionRate: parseFloat(form.commissionRate) || 0,
        commissionType: form.commissionType as "percentage" | "fixed",
      },
    }, {
      onSuccess: (data) => {
        setResult({ tempPassword: data.tempPassword || form.tempPassword, message: data.message });
        qc.invalidateQueries({ queryKey: getListAgentsQueryKey({}) });
        toast({ title: data.alreadyExisted ? "Agent account already exists — showing credentials." : "Agent account created!" });
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "";
        // "Failed to fetch" = network timeout — the account likely WAS created server-side
        if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("timeout")) {
          toast({
            title: "Network timeout — but account may have been created",
            description: "Please click 'Create Agent Account' again with the same email. If the account was created, it will show the credentials.",
            variant: "destructive",
          });
        } else {
          toast({ title: msg || "Failed to create agent", variant: "destructive" });
        }
      },
    });
  };

  const handleClose = () => {
    setForm({ fullName: "", businessName: "", email: "", phone: "", tempPassword: "", commissionType: "percentage", commissionRate: "0" });
    setResult(null);
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-black text-[#0F172A]">Create Agent Account</DialogTitle>
          <DialogDescription>Create a new agent account directly — no application required.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-5 py-2">
            <div className="flex items-center gap-3 bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-800">Agent Account Created!</p>
                <p className="text-emerald-700 text-sm">{result.message}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] border border-[#DCE3F0] p-4 space-y-2">
              <p className="text-xs font-black text-[#2D3199] uppercase tracking-wider">Login Credentials</p>
              <div className="flex justify-between text-sm"><span className="text-[#94A3B8]">Email</span><span className="font-mono font-semibold text-[#0F172A]">{form.email}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[#94A3B8]">Temp Password</span><span className="font-mono font-semibold text-[#FF3B00] bg-[#FFF4F1] px-2 py-0.5 rounded">{result.tempPassword}</span></div>
            </div>
            <p className="text-xs text-[#94A3B8] text-center">⚠️ Share these credentials with the agent. Ask them to change their password immediately.</p>
            <Button onClick={handleClose} className="w-full bg-[#2D3199] rounded-xl">Done</Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Name & Business */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#334155]">Full Name <span className="text-red-500">*</span></Label>
                <Input value={form.fullName} onChange={e => set("fullName", e.target.value)} placeholder="John Doe" className={errors.fullName ? "border-red-400" : ""} />
                {errors.fullName && <p className="text-red-500 text-xs">{errors.fullName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#334155]">Business Name <span className="text-red-500">*</span></Label>
                <Input value={form.businessName} onChange={e => set("businessName", e.target.value)} placeholder="Doe Travel Agency" className={errors.businessName ? "border-red-400" : ""} />
                {errors.businessName && <p className="text-red-500 text-xs">{errors.businessName}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#334155]">Email <span className="text-red-500">*</span></Label>
                <Input value={form.email} onChange={e => set("email", e.target.value)} type="email" placeholder="agent@example.com" className={errors.email ? "border-red-400" : ""} />
                {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#334155]">Phone <span className="text-red-500">*</span></Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+234..." className={errors.phone ? "border-red-400" : ""} />
                {errors.phone && <p className="text-red-500 text-xs">{errors.phone}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#334155]">Temporary Password <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input value={form.tempPassword} onChange={e => set("tempPassword", e.target.value)} type={showPw ? "text" : "password"} placeholder="Min 8 characters" className={`pr-10 ${errors.tempPassword ? "border-red-400" : ""}`} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#334155]">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.tempPassword && <p className="text-red-500 text-xs">{errors.tempPassword}</p>}
            </div>

            {/* Commission */}
            <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE3F0] p-4 space-y-3">
              <p className="text-xs font-black text-[#2D3199] uppercase tracking-wider">Commission Settings</p>
              <div className="flex gap-2">
                {["percentage", "fixed"].map(t => (
                  <button key={t} type="button" onClick={() => set("commissionType", t)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                      form.commissionType === t ? "bg-[#2D3199] border-[#2D3199] text-white" : "bg-white border-[#DCE3F0] text-[#64748B] hover:border-[#2D3199]/40"
                    }`}>
                    {t === "percentage" ? <Percent className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                    {t === "percentage" ? "% Rate" : "₦ Fixed"}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#334155]">
                  {form.commissionType === "percentage" ? "Commission Rate (%)" : "Fixed Commission (₦)"}
                </Label>
                <Input value={form.commissionRate} onChange={e => set("commissionRate", e.target.value)} type="number" min="0" step={form.commissionType === "percentage" ? "0.5" : "100"} />
              </div>
              <p className="text-xs text-[#94A3B8]">
                The agent will log in with these credentials. Remind them to update their password immediately.
              </p>
            </div>

            <Button onClick={handleCreate} disabled={createAgent.isPending} className="w-full bg-[#FF3B00] hover:bg-[#D63200] text-white font-bold rounded-xl">
              {createAgent.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create Agent Account"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Approve Application Dialog ─────────────────────────────────────── */

function ApproveApplicationDialog({ app, onClose }: { app: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const approve = useApproveAgentApplication();
  const [commissionRate, setCommissionRate] = useState("0");
  const [commissionType, setCommissionType] = useState("percentage");
  const [result, setResult] = useState<{ tempPassword: string; message: string } | null>(null);

  const handleApprove = () => {
    approve.mutate({ id: app.id, data: { commissionRate: parseFloat(commissionRate), commissionType: commissionType as any } }, {
      onSuccess: (data) => {
        setResult({ tempPassword: data.tempPassword, message: data.message || "Agent account created." });
        qc.invalidateQueries({ queryKey: getListAgentApplicationsQueryKey() });
        qc.invalidateQueries({ queryKey: getListAgentsQueryKey({}) });
        toast({ title: data.alreadyExisted ? "Agent account already exists!" : "Agent approved and account created!" });
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "";
        if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("timeout")) {
          toast({
            title: "Network timeout — but account may have been created",
            description: "Please try approving again. If the account was already created, it will show the credentials.",
            variant: "destructive",
          });
        } else {
          toast({ title: msg || "Failed to approve", variant: "destructive" });
        }
      },
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black">Approve Application</DialogTitle>
          <DialogDescription>Create an agent account for <strong>{app.contactPerson}</strong> at <strong>{app.businessName}</strong></DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-4 py-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-bold text-emerald-800">Account Created!</p>
              <p className="text-emerald-700 text-sm mt-1">{result.message}</p>
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] border border-[#DCE3F0] p-4 space-y-2">
              <p className="text-xs font-black text-[#2D3199] uppercase tracking-wider">Login Credentials</p>
              <div className="flex justify-between text-sm"><span className="text-[#94A3B8]">Email</span><span className="font-mono font-semibold">{app.email}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[#94A3B8]">Temp Password</span><span className="font-mono font-semibold text-[#FF3B00] bg-[#FFF4F1] px-2 py-0.5 rounded">{result.tempPassword}</span></div>
            </div>
            <p className="text-xs text-[#94A3B8] text-center">Share with the agent. Ask them to change their password.</p>
            <Button onClick={onClose} className="w-full bg-[#2D3199] rounded-xl">Done</Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE3F0] p-4 space-y-3">
              <p className="text-xs font-black text-[#2D3199] uppercase tracking-wider">Commission Settings</p>
              <div className="flex gap-2">
                {["percentage", "fixed"].map(t => (
                  <button key={t} type="button" onClick={() => setCommissionType(t)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                      commissionType === t ? "bg-[#2D3199] border-[#2D3199] text-white" : "bg-white border-[#DCE3F0] text-[#64748B]"
                    }`}>
                    {t === "percentage" ? <Percent className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                    {t === "percentage" ? "% Rate" : "₦ Fixed"}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#334155]">{commissionType === "percentage" ? "Commission %" : "Fixed Commission ₦"}</Label>
                <Input value={commissionRate} onChange={e => setCommissionRate(e.target.value)} type="number" min="0" />
              </div>
            </div>
            <Button onClick={handleApprove} disabled={approve.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
              {approve.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Approving...</> : "Approve & Create Account"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Wallet Top-Up Dialog ────────────────────────────────────────────── */

function WalletTopupDialog({ agent, onClose }: { agent: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState<"amount" | "confirm" | "done">("amount");
  const [amount, setAmount] = useState("");
  const [newBalance, setNewBalance] = useState(0);

  // Generate a stable idempotency key for this top-up attempt when the dialog opens
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const topupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/agents/${agent.id}/wallet/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(amount), idempotencyKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process top-up");
      return data;
    },
    onSuccess: (data) => {
      setNewBalance(data.newBalance);
      setStep("done");
      qc.invalidateQueries({ queryKey: getListAgentsQueryKey({}) });
      toast({ title: `Wallet credited with ₦${parseFloat(amount).toLocaleString()}!` });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black">Fund Agent Wallet</DialogTitle>
          <DialogDescription>Top up wallet for <strong>{agent.businessName}</strong></DialogDescription>
        </DialogHeader>

        {step === "amount" && (
          <div className="space-y-4 py-2">
            <div className="bg-[#F8FAFC] rounded-2xl border border-[#DCE3F0] p-4">
              <p className="text-xs text-[#94A3B8] font-medium mb-1">Current Balance</p>
              <p className="text-2xl font-black text-[#2D3199]">₦{(agent.walletBalance || 0).toLocaleString()}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#334155]">Amount to Add (₦)</Label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="100" placeholder="e.g. 50000" className="text-lg font-bold" />
            </div>
            <Button onClick={() => setStep("confirm")} disabled={!amount || parseFloat(amount) <= 0} className="w-full bg-[#2D3199] text-white font-bold rounded-xl">
              Proceed to Confirmation
            </Button>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-amber-800 text-sm font-medium">Please confirm this transaction.</p>
              <div className="mt-3 bg-white rounded-xl p-3 border border-amber-200">
                <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-1">Top-up Amount</p>
                <p className="text-2xl font-black text-[#2D3199]">₦{parseFloat(amount).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-center text-xs text-[#94A3B8]">
              This action is permanent and cannot be undone. Only Super Admins can perform this.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setStep("amount")} variant="outline" className="flex-1 rounded-xl">Back</Button>
              <Button onClick={() => topupMutation.mutate()} disabled={topupMutation.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
                {topupMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</> : "Confirm Top-Up"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 py-2 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-black text-[#0F172A]">Wallet Credited!</p>
              <p className="text-[#64748B] text-sm mt-1">₦{parseFloat(amount).toLocaleString()} added successfully</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-2xl border border-[#DCE3F0] p-4">
              <p className="text-xs text-[#94A3B8] font-medium mb-1">New Balance</p>
              <p className="text-2xl font-black text-[#2D3199]">₦{newBalance.toLocaleString()}</p>
            </div>
            <Button onClick={onClose} className="w-full bg-[#2D3199] rounded-xl">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Package Discounts Dialog ────────────────────────────────────────── */

function PackageDiscountsDialog({ agent, onClose }: { agent: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: discountData, isLoading } = useGetAgentPackageDiscountsAdmin(
    agent.id,
    { query: { queryKey: getGetAgentPackageDiscountsAdminQueryKey(agent.id) } }
  );
  const { data: pkgData } = useListPackages({}, { query: { queryKey: getListPackagesQueryKey({}) } });
  const setDiscount = useSetAgentPackageDiscount();
  const deleteDiscount = useDeleteAgentPackageDiscount();

  const [form, setForm] = useState({ packageId: "", discountType: "percentage", discountValue: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ discountType: "percentage", discountValue: "" });
  const discounts = discountData?.discounts || [];
  const packages = pkgData?.packages || [];

  const existingPkgIds = new Set(discounts.map(d => d.packageId));
  const availablePkgs = packages.filter(p => !existingPkgIds.has(p.id));

  const handleAdd = () => {
    if (!form.packageId || !form.discountValue) return;
    setDiscount.mutate({
      id: agent.id,
      packageId: form.packageId,
      data: { discountType: form.discountType as any, discountValue: parseFloat(form.discountValue) },
    }, {
      onSuccess: () => {
        setForm({ packageId: "", discountType: "percentage", discountValue: "" });
        qc.invalidateQueries({ queryKey: getGetAgentPackageDiscountsAdminQueryKey(agent.id) });
        toast({ title: "Discount set!" });
      },
      onError: () => toast({ title: "Failed to set discount", variant: "destructive" }),
    });
  };

  const handleEdit = (d: any) => {
    setEditingId(d.packageId);
    setEditForm({ discountType: d.discountType, discountValue: String(d.discountValue) });
  };

  const handleSaveEdit = (packageId: string) => {
    if (!editForm.discountValue) return;
    setDiscount.mutate({
      id: agent.id,
      packageId,
      data: { discountType: editForm.discountType as any, discountValue: parseFloat(editForm.discountValue) },
    }, {
      onSuccess: () => {
        setEditingId(null);
        qc.invalidateQueries({ queryKey: getGetAgentPackageDiscountsAdminQueryKey(agent.id) });
        toast({ title: "Discount updated!" });
      },
      onError: () => toast({ title: "Failed to update discount", variant: "destructive" }),
    });
  };

  const handleDelete = (packageId: string) => {
    deleteDiscount.mutate({ id: agent.id, packageId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetAgentPackageDiscountsAdminQueryKey(agent.id) });
        toast({ title: "Discount removed" });
      },
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-black">Package Discounts</DialogTitle>
          <DialogDescription>
            Set individual package discounts for <strong>{agent.businessName}</strong>. These discounts reduce the package price for this agent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Default Package Discount info */}
          <div className="bg-[#EEF0FF] rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs font-bold text-[#2D3199]">Default Package Discount</p>
            <span className="font-black text-[#2D3199]">0%</span>
          </div>
          <p className="text-xs text-[#94A3B8] -mt-3">All packages have no discount by default. Add individual package discounts below.</p>

          {/* Existing discounts */}
          {isLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : discounts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-black text-[#94A3B8] uppercase tracking-wider">Applied Discounts</p>
              {discounts.map(d => (
                <div key={d.id} className="bg-[#F8FAFC] rounded-xl border border-[#DCE3F0] px-4 py-3">
                  {editingId === d.packageId ? (
                    /* ── Inline edit mode ── */
                    <div className="space-y-3">
                      <p className="font-bold text-[#0F172A] text-sm">{d.package?.name || "Package"}</p>
                      <div className="flex gap-2">
                        {["percentage", "fixed"].map(t => (
                          <button key={t} type="button" onClick={() => setEditForm(f => ({ ...f, discountType: t }))}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                              editForm.discountType === t ? "bg-[#2D3199] border-[#2D3199] text-white" : "bg-white border-[#DCE3F0] text-[#64748B]"
                            }`}>
                            {t === "percentage" ? "% Off" : "₦ Off"}
                          </button>
                        ))}
                      </div>
                      <Input value={editForm.discountValue} onChange={e => setEditForm(f => ({ ...f, discountValue: e.target.value }))}
                        type="number" min="0" placeholder={editForm.discountType === "percentage" ? "e.g. 5 (%)" : "e.g. 10000 (₦)"} />
                      <div className="flex gap-2">
                        <Button onClick={() => setEditingId(null)} variant="outline" size="sm" className="flex-1 rounded-lg text-xs">Cancel</Button>
                        <Button onClick={() => handleSaveEdit(d.packageId)} disabled={setDiscount.isPending || !editForm.discountValue}
                          size="sm" className="flex-1 bg-[#2D3199] text-white font-bold rounded-lg text-xs">
                          {setDiscount.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display mode ── */
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-[#0F172A] text-sm">{d.package?.name || "Package"}</p>
                        <p className="text-xs text-[#94A3B8]">₦{(d.package?.price || 0).toLocaleString()} base price</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-emerald-700 text-sm">
                          {d.discountType === "percentage" ? `-${d.discountValue}%` : `-₦${d.discountValue.toLocaleString()}`}
                        </span>
                        <button onClick={() => handleEdit(d)} className="text-[#2D3199] hover:text-[#1C1F66] transition-colors" title="Edit discount">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(d.packageId)} className="text-red-400 hover:text-red-600 transition-colors" title="Remove discount">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[#94A3B8] text-sm py-4">No individual package discounts set yet.</p>
          )}

          {/* Add new discount */}
          {availablePkgs.length > 0 && (
            <div className="rounded-xl border border-[#DCE3F0] p-4 space-y-3">
              <p className="text-xs font-black text-[#2D3199] uppercase tracking-wider">Add Package Discount</p>
              <select value={form.packageId} onChange={e => setForm(f => ({ ...f, packageId: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-[#DCE3F0] bg-white text-sm font-medium focus:outline-none focus:border-[#2D3199]">
                <option value="">Select package...</option>
                {availablePkgs.map(p => <option key={p.id} value={p.id}>{p.name} — ₦{p.price.toLocaleString()}</option>)}
              </select>
              <div className="flex gap-2">
                {["percentage", "fixed"].map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, discountType: t }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      form.discountType === t ? "bg-[#2D3199] border-[#2D3199] text-white" : "bg-white border-[#DCE3F0] text-[#64748B]"
                    }`}>
                    {t === "percentage" ? "% Off" : "₦ Off"}
                  </button>
                ))}
              </div>
              <Input value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                type="number" min="0" placeholder={form.discountType === "percentage" ? "e.g. 5 (%)" : "e.g. 10000 (₦)"} />
              <Button onClick={handleAdd} disabled={setDiscount.isPending || !form.packageId || !form.discountValue}
                className="w-full bg-[#2D3199] text-white font-bold rounded-xl">
                {setDiscount.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply Discount"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Commission Edit Dialog ──────────────────────────────────────────── */

function CommissionEditDialog({ agent, onClose }: { agent: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const update = useUpdateAgentCommission();
  const [rate, setRate] = useState(String(agent.commissionRate || "0"));
  const [type, setType] = useState(agent.commissionType || "percentage");

  const handleSave = () => {
    update.mutate({ id: agent.id, data: { commissionRate: parseFloat(rate), commissionType: type as any } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAgentsQueryKey({}) });
        toast({ title: "Commission updated!" });
        onClose();
      },
      onError: () => toast({ title: "Failed to update commission", variant: "destructive" }),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-black">Edit Commission</DialogTitle>
          <DialogDescription>{agent.businessName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            {["percentage", "fixed"].map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  type === t ? "bg-[#2D3199] border-[#2D3199] text-white" : "bg-white border-[#DCE3F0] text-[#64748B]"
                }`}>
                {t === "percentage" ? <Percent className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                {t === "percentage" ? "% Rate" : "₦ Fixed"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[#334155]">{type === "percentage" ? "Commission Rate (%)" : "Fixed Amount (₦)"}</Label>
            <Input value={rate} onChange={e => setRate(e.target.value)} type="number" min="0" />
          </div>
          <Button onClick={handleSave} disabled={update.isPending} className="w-full bg-[#2D3199] text-white font-bold rounded-xl">
            {update.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Agent Detail Dialog ─────────────────────────────────────────────── */

function AgentDetailDialog({ agent, onClose, onAction }: {
  agent: any;
  onClose: () => void;
  onAction: (type: "wallet" | "commission" | "discounts", agent: any) => void;
}) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const { data: clientsData, isLoading: clientsLoading } = useQuery<{ pilgrims: any[]; total: number }>({
    queryKey: ["agent-detail-clients", agent.id],
    queryFn: () => fetch(`/api/admin/pilgrims?agentId=${agent.id}&limit=500&exportAll=true`, { credentials: "include" }).then(r => r.json()),
    staleTime: 15000,
  });

  const clients = clientsData?.pilgrims || [];
  const totalClients = clientsData?.total || 0;
  const totalRevenue = clients.reduce((s: number, c: any) => s + Number(c.totalPrice || 0), 0);
  const totalPaid = clients.reduce((s: number, c: any) => s + Number(c.amountPaid || 0), 0);
  const confirmedCount = clients.filter((c: any) => c.status === "confirmed").length;

  const totalPages = Math.max(1, Math.ceil(clients.length / PAGE_SIZE));
  const paginatedClients = clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportExcel = () => {
    if (!clients.length) return;
    const ws = XLSX.utils.json_to_sheet(clients.map((c: any, i: number) => ({
      "S/N": i + 1,
      "Reference": c.reference || "N/A",
      "Full Name": c.fullName || "N/A",
      "Phone": c.phone || "N/A",
      "Status": c.status || "N/A",
      "Package": c.package?.name || "N/A",
      "Package Type": c.package?.type || "N/A",
      "Total Price (NGN)": c.totalPrice || 0,
      "Amount Paid (NGN)": c.amountPaid || 0,
      "Visa Status": c.visaStatus || "N/A",
      "Registered On": new Date(c.createdAt).toLocaleDateString("en-GB")
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clients");
    XLSX.writeFile(wb, `${agent.businessName.replace(/[^a-z0-9]/gi, '_')}_Clients.xlsx`);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden rounded-3xl p-0 flex flex-col">
        <DialogTitle className="sr-only">Agent Detail — {agent.businessName}</DialogTitle>

        {/* Hero Banner */}
        <div className="relative shrink-0 overflow-hidden rounded-t-3xl"
             style={{ background: "linear-gradient(135deg, #0D0F4E 0%, #1C1F66 40%, #2D3199 75%, #3D47B5 100%)" }}>
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-[.06]" style={{ background: "#FF3B00" }} />
          <div className="absolute -bottom-16 left-[30%] w-60 h-60 rounded-full opacity-[.04]" style={{ background: "#fff" }} />

          <div className="relative z-10 p-6 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center ring-4 ring-white/20 shadow-lg">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-black text-white leading-tight">{agent.businessName}</h3>
                    <BadgeCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  {agent.agentCode && (
                    <p className="text-white/60 text-xs mt-0.5 font-mono">#{agent.agentCode}</p>
                  )}
                  {agent.email && (
                    <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                      <Mail className="w-3 h-3" />{agent.email}
                    </p>
                  )}
                  {agent.phone && (
                    <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3" />{agent.phone}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#F8F9FF]">
          <div className="p-5 space-y-4">

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total Clients", value: totalClients, color: "#2D3199", bg: "#EEF0FF" },
                { label: "Confirmed", value: confirmedCount, color: "#10B981", bg: "#ECFDF5" },
                { label: "Revenue", value: `₦${totalRevenue.toLocaleString()}`, color: "#FF3B00", bg: "#FFF4F1" },
                { label: "Collected", value: `₦${totalPaid.toLocaleString()}`, color: "#2D3199", bg: "#EEF0FF" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: s.color }}>{s.label}</p>
                  <p className="text-base font-black text-[#0F172A] leading-tight">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Commission & Wallet */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 flex items-center gap-3 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-[#EEF0FF] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#2D3199]" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Commission</p>
                  <p className="text-sm font-black text-[#2D3199] mt-0.5">
                    {agent.commissionType === "percentage" ? `${agent.commissionRate}%` : `₦${Number(agent.commissionRate).toLocaleString()}`}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-emerald-200 p-4 flex items-center gap-3 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest">Wallet Balance</p>
                  <p className="text-sm font-black text-emerald-600 mt-0.5">
                    ₦{Number(agent.wallet?.balance || 0).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => onAction("wallet", agent)}
                  className="w-8 h-8 rounded-full bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-emerald-700 transition-colors shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onAction("wallet", agent)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors">
                <Wallet className="w-3.5 h-3.5" /> Fund Wallet
              </button>
              <button onClick={() => onAction("commission", agent)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#2D3199] hover:bg-[#25297F] text-white text-xs font-bold rounded-xl transition-colors">
                <Edit3 className="w-3.5 h-3.5" /> Edit Commission
              </button>
              <button onClick={() => onAction("discounts", agent)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#DCE3F0] hover:bg-[#F8FAFC] text-[#334155] text-xs font-bold rounded-xl transition-colors">
                <Tag className="w-3.5 h-3.5" /> Package Discounts
              </button>
            </div>

            {/* Registered Clients */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#FAFBFF] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#EEF0FF] flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-[#2D3199]" />
                  </div>
                  <p className="text-xs font-black text-[#0F172A] uppercase tracking-wide">Registered Clients</p>
                  <span className="text-[10px] font-black bg-[#EEF0FF] text-[#2D3199] px-2 py-0.5 rounded-full">{totalClients}</span>
                </div>
                <button
                  onClick={handleExportExcel}
                  disabled={clients.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DCE3F0] hover:bg-[#F8F9FF] text-[#0F172A] text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>

              {clientsLoading ? (
                <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
              ) : clients.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-8 h-8 text-[#94A3B8]/30 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-[#94A3B8]">No clients registered yet</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="divide-y divide-[#F1F5F9] max-h-[300px] overflow-y-auto">
                    {paginatedClients.map((c: any) => {
                      const paidPct = Number(c.totalPrice) > 0 ? Math.min(100, Math.round(Number(c.amountPaid) / Number(c.totalPrice) * 100)) : 0;
                      return (
                        <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#FAFBFF] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-black text-white">
                                {(c.fullName || "?").charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#0F172A] truncate">{c.fullName || "—"}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold capitalize border ${
                                  c.status === "confirmed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  c.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  "bg-red-50 text-red-700 border-red-200"
                                }`}>{c.status}</span>
                                {c.package?.type && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] capitalize">{c.package.type}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-[#0F172A]">₦{Number(c.amountPaid).toLocaleString()}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className="w-12 h-1 bg-[#F1F5F9] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${paidPct >= 100 ? "bg-emerald-500" : "bg-[#2D3199]"}`}
                                     style={{ width: `${paidPct}%` }} />
                              </div>
                              <span className="text-[9px] text-[#94A3B8]">{paidPct}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#FAFBFF] flex items-center justify-between">
                      <span className="text-xs font-bold text-[#64748B]">
                        Page {page} of {totalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-2.5 py-1 text-xs font-bold rounded-md bg-white border border-[#DCE3F0] text-[#0F172A] disabled:opacity-40 hover:bg-[#F1F5F9]"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="px-2.5 py-1 text-xs font-bold rounded-md bg-white border border-[#DCE3F0] text-[#0F172A] disabled:opacity-40 hover:bg-[#F1F5F9]"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────── */

function AgentActivityList({ agents }: { agents: any[] }) {
  const [page, setPage] = useState(1);
  const [filterAgent, setFilterAgent] = useState("all");
  const PAGE_SIZE = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-agents-activity", filterAgent, page],
    queryFn: () => fetch(`/api/admin/agents-activity?agentId=${filterAgent}&limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`, { credentials: "include" }).then(r => r.json()),
  });

  const activities = data?.activities || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden flex flex-col min-h-[400px]">
      <div className="p-4 border-b border-[#F1F5F9] bg-[#FAFBFF] flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#2D3199]" />
          <p className="font-bold text-[#0F172A] text-sm">Unified Activity Logs</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-[#64748B]">Filter Agent:</label>
          <select value={filterAgent} onChange={e => { setFilterAgent(e.target.value); setPage(1); }}
            className="h-8 px-2 rounded-lg border border-[#DCE3F0] bg-white text-xs font-medium focus:outline-none focus:border-[#2D3199]">
            <option value="all">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.businessName}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 p-0">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="w-10 h-10 text-[#CBD5E1] mb-3" />
            <p className="font-bold text-[#64748B]">No activity recorded</p>
            <p className="text-xs text-[#94A3B8] mt-1">Try changing the agent filter</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {activities.map((a: any) => (
              <div key={a._id} className="p-4 hover:bg-[#FAFBFF] transition-colors flex gap-4 items-start">
                {a._type === "wallet" ? (
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] flex items-center justify-center shrink-0">
                    <ActivityIcon type={a.eventType} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-bold text-[#0F172A]">
                      {a._type === "wallet" ? "Wallet Transaction" : formatEventName(a.eventType)}
                    </p>
                    <span className="text-[10px] font-bold text-[#94A3B8] whitespace-nowrap ml-2">
                      {new Date(a.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                  {filterAgent === "all" && a.businessName && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#2D3199] mb-1">{a.businessName}</p>
                  )}
                  {a._type === "wallet" ? (
                    <p className="text-xs text-[#64748B]">
                      {a.txType === "credit" ? "Credited " : "Debited "}
                      <span className="font-bold text-[#0F172A]">₦{Number(a.amount).toLocaleString()}</span>
                      {a.description ? ` - ${a.description}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-[#64748B]">
                      {a.metadata?.message || "System event triggered"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-[#F1F5F9] bg-[#FAFBFF] flex items-center justify-between">
          <span className="text-xs font-bold text-[#64748B]">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="h-8 text-xs">Prev</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="h-8 text-xs">Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  if (type.includes("client_registered")) return <UserPlus className="w-5 h-5 text-[#2D3199]" />;
  if (type.includes("application")) return <UserCheck className="w-5 h-5 text-[#2D3199]" />;
  if (type.includes("payment")) return <DollarSign className="w-5 h-5 text-[#2D3199]" />;
  if (type.includes("booking") || type.includes("pilgrim")) return <Users className="w-5 h-5 text-[#2D3199]" />;
  return <RefreshCw className="w-5 h-5 text-[#2D3199]" />;
}

function formatEventName(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}


type ActiveDialog =
  | { type: "create" }
  | { type: "approve-app"; app: any }
  | { type: "wallet"; agent: any }
  | { type: "discounts"; agent: any }
  | { type: "commission"; agent: any }
  | { type: "detail"; agent: any }
  | { type: "confirm-status"; agent: any; newStatus: string }
  | { type: "confirm-delete-agent"; agent: any }
  | { type: "confirm-delete-app"; app: any }
  | null;

const TABS = ["applications", "active", "suspended", "rejected", "logs"] as const;
type Tab = typeof TABS[number];

export default function AdminAgents() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("applications");
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const [agentPage, setAgentPage] = useState(1);
  const AGENTS_PER_PAGE = 15;

  const { data: appsData, isLoading: appsLoading } = useListAgentApplications({
    query: { queryKey: getListAgentApplicationsQueryKey() },
  });
  const { data: agentsData, isLoading: agentsLoading } = useListAgents({}, {
    query: { queryKey: getListAgentsQueryKey({}) },
  });

  const rejectApp = useRejectAgentApplication();

  const applications = appsData?.applications || [];
  const agents = agentsData?.agents || [];

  const pending = applications.filter(a => a.status === "pending");
  const rejectedApps = applications.filter(a => a.status === "rejected");
  const activeAgents = agents.filter(a => a.status === "active");
  const inactiveAgents = agents.filter(a => a.status === "suspended" || a.status === "blocked");

  const handleRejectApp = (app: any) => {
    rejectApp.mutate({ id: app.id, data: {} }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAgentApplicationsQueryKey() });
        toast({ title: "Application rejected" });
      },
      onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
    });
  };

  const handleChangeAgentStatus = (agentId: string, newStatus: string) => {
    fetch(`/api/admin/agents/${agentId}/status`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      qc.invalidateQueries({ queryKey: getListAgentsQueryKey({}) });
      toast({ title: d.message || `Agent ${newStatus}` });
      setDialog(null);
    }).catch((e: any) => toast({ title: e.message, variant: "destructive" }));
  };

  const handleDeleteAgent = (agentId: string) => {
    fetch(`/api/admin/agents/${agentId}`, { method: "DELETE" }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      qc.invalidateQueries({ queryKey: getListAgentsQueryKey({}) });
      toast({ title: d.message || "Agent deleted" });
      setDialog(null);
    }).catch((e: any) => toast({ title: e.message, variant: "destructive" }));
  };

  const handleDeleteApp = (appId: string) => {
    fetch(`/api/admin/agent-applications/${appId}`, { method: "DELETE" }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      qc.invalidateQueries({ queryKey: getListAgentApplicationsQueryKey() });
      toast({ title: d.message || "Application deleted" });
      setDialog(null);
    }).catch((e: any) => toast({ title: e.message, variant: "destructive" }));
  };

  const tabCounts = {
    applications: pending.length,
    active: activeAgents.length,
    suspended: inactiveAgents.length,
    rejected: rejectedApps.length,
    logs: 0,
  };

  return (
    <div className="space-y-6" data-testid="page-admin-agents">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Management</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Agent Applications</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Review partnership requests or create agent accounts directly.</p>
        </div>
        <button onClick={() => setDialog({ type: "create" })}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#2D3199] hover:bg-[#25297F] text-white text-sm font-bold rounded-xl transition-colors shadow-[0_4px_12px_rgba(45,49,153,0.3)]">
          <Plus className="w-4 h-4" /> Create Agent
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending", value: pending.length, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
          { label: "Approved", value: applications.filter(a => a.status === "approved").length, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
          { label: "Rejected", value: rejectedApps.length, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
          { label: "Total", value: applications.length, color: "text-[#2D3199]", bg: "bg-[#EEF0FF]", border: "border-[#C7CBF5]" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg} ${s.border}`}>
            <p className={`text-xs font-bold ${s.color} mb-1`}>{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-colors capitalize ${
              activeTab === tab ? "bg-white text-[#2D3199] shadow-sm" : "text-[#64748B] hover:text-[#334155]"
            }`}>
            {tab === "applications" ? "Pending" : tab === "active" ? "Active Agents" : tab === "suspended" ? "Suspended" : tab === "rejected" ? "Rejected" : "Logs"}
            {tabCounts[tab] > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === tab ? "bg-[#2D3199] text-white" : "bg-[#94A3B8] text-white"}`}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Pending Applications ── */}
      {activeTab === "applications" && (
        <div>
          {appsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center py-16 bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
              <UserCheck className="w-10 h-10 text-[#2D3199]/30 mb-3" />
              <p className="font-bold text-[#0F172A]">No pending applications</p>
              <p className="text-[#94A3B8] text-sm mt-1">Applications from the "Become Agent" form will appear here</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#F1F5F9]">
                      {["Business", "Contact", "Email", "Phone", "Date", "Status", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F8FAFC]">
                    {pending.map(app => (
                      <tr key={app.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#0F172A] text-sm">{app.businessName}</p>
                          {app.city && <p className="text-xs text-[#94A3B8]">{[app.city, app.state].filter(Boolean).join(", ")}</p>}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[#334155]">{app.contactPerson}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{app.email}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{app.phone}</td>
                        <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">{fmt(app.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">pending</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setDialog({ type: "approve-app", app })}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors">
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                            <button onClick={() => handleRejectApp(app)} disabled={rejectApp.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors disabled:opacity-50">
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                            <button onClick={() => setDialog({ type: "confirm-delete-app", app })}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 text-xs font-bold rounded-lg border border-[#E2E8F0] transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Active Agents ── */}
      {activeTab === "active" && (
        <div>
          {agentsLoading ? (
            <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
          ) : activeAgents.length === 0 ? (
            <div className="flex flex-col items-center py-16 bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
              <Building2 className="w-10 h-10 text-[#2D3199]/30 mb-3" />
              <p className="font-bold text-[#0F172A]">No active agents yet</p>
              <p className="text-[#94A3B8] text-sm mt-1">Create agents directly or approve applications</p>
            </div>
          ) : (
            (() => {
              const totalAgentPages = Math.ceil(activeAgents.length / AGENTS_PER_PAGE);
              const paginatedAgents = activeAgents.slice((agentPage - 1) * AGENTS_PER_PAGE, agentPage * AGENTS_PER_PAGE);
              return (
                <>
            <div className="space-y-4">
              {paginatedAgents.map(agent => (
                <div key={agent.id} className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_12px_rgba(45,49,153,0.04)] p-5 hover:shadow-[0_4px_20px_rgba(45,49,153,0.08)] transition-shadow">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(45,49,153,0.3)]">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-black text-[#0F172A] text-base">{agent.businessName}</h3>
                          <BadgeCheck className="w-4 h-4 text-emerald-600" />
                          {agent.agentCode && (
                            <span className="text-[10px] font-mono bg-[#F8F9FF] border border-[#DCE3F0] px-2 py-0.5 rounded-full text-[#64748B]">
                              #{agent.agentCode}
                            </span>
                          )}
                        </div>
                        {agent.email && <p className="text-xs text-[#94A3B8]">{agent.email}</p>}
                        {agent.phone && <p className="text-xs text-[#94A3B8] mt-0.5">{agent.phone}</p>}
                      </div>
                    </div>

                    {/* Stats + Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                      {/* Commission */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#EEF0FF] rounded-xl">
                        <TrendingUp className="w-4 h-4 text-[#2D3199]" />
                        <div>
                          <p className="text-[10px] text-[#2D3199]/60 font-bold uppercase tracking-wider leading-none">Commission</p>
                          <p className="text-sm font-black text-[#2D3199]">
                            {agent.commissionType === "percentage" ? `${agent.commissionRate}%` : `₦${Number(agent.commissionRate).toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                      {/* Wallet */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                        <div>
                          <p className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-wider leading-none">Wallet</p>
                          <p className="text-sm font-black text-emerald-700">{fmtN(agent.walletBalance || 0)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#F1F5F9]">
                    <button onClick={() => setDialog({ type: "detail", agent })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl transition-colors">
                      <Users className="w-3.5 h-3.5" /> View Details & Clients
                    </button>
                    <button onClick={() => setDialog({ type: "wallet", agent })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors">
                      <Wallet className="w-3.5 h-3.5" /> Fund Wallet
                    </button>
                    <button onClick={() => setDialog({ type: "commission", agent })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#2D3199] hover:bg-[#25297F] text-white text-xs font-bold rounded-xl transition-colors">
                      <Edit3 className="w-3.5 h-3.5" /> Edit Commission
                    </button>
                    <button onClick={() => setDialog({ type: "discounts", agent })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#DCE3F0] hover:bg-[#F8FAFC] text-[#334155] text-xs font-bold rounded-xl transition-colors">
                      <Tag className="w-3.5 h-3.5" /> Package Discounts
                    </button>
                    <button onClick={() => setDialog({ type: "confirm-status", agent, newStatus: "suspended" })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl transition-colors">
                      <ShieldBan className="w-3.5 h-3.5" /> Suspend
                    </button>
                    <button onClick={() => setDialog({ type: "confirm-status", agent, newStatus: "blocked" })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition-colors">
                      <Ban className="w-3.5 h-3.5" /> Block
                    </button>
                    <button onClick={() => setDialog({ type: "confirm-delete-agent", agent })}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalAgentPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-[#94A3B8] font-medium">
                  Showing {((agentPage - 1) * AGENTS_PER_PAGE) + 1}&ndash;{Math.min(agentPage * AGENTS_PER_PAGE, activeAgents.length)} of {activeAgents.length} agents
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setAgentPage(p => Math.max(1, p - 1))}
                    disabled={agentPage === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#EEF0FF] hover:text-[#2D3199] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalAgentPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setAgentPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${p === agentPage ? "bg-[#2D3199] text-white" : "text-[#64748B] hover:bg-[#EEF0FF] hover:text-[#2D3199]"}`}
                    >{p}</button>
                  ))}
                  <button
                    onClick={() => setAgentPage(p => Math.min(totalAgentPages, p + 1))}
                    disabled={agentPage === totalAgentPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#EEF0FF] hover:text-[#2D3199] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            </>
            );
            })()
          )}
        </div>
      )}

      {/* ── Tab: Suspended / Blocked ── */}
      {activeTab === "suspended" && (
        <div>
          {inactiveAgents.length === 0 ? (
            <div className="flex flex-col items-center py-16 bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
              <ShieldCheck className="w-10 h-10 text-emerald-300 mb-3" />
              <p className="font-bold text-[#0F172A]">No suspended or blocked agents</p>
              <p className="text-[#94A3B8] text-sm mt-1">All agents are currently active</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inactiveAgents.map(agent => (
                <div key={agent.id} className={`bg-white rounded-2xl border p-5 ${agent.status === "blocked" ? "border-red-200" : "border-amber-200"}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${agent.status === "blocked" ? "bg-red-100" : "bg-amber-100"}`}>
                        {agent.status === "blocked" ? <Ban className="w-5 h-5 text-red-600" /> : <ShieldBan className="w-5 h-5 text-amber-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-black text-[#0F172A] text-base">{agent.businessName}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${agent.status === "blocked" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {agent.status}
                          </span>
                        </div>
                        {agent.email && <p className="text-xs text-[#94A3B8]">{agent.email}</p>}
                        {agent.phone && <p className="text-xs text-[#94A3B8] mt-0.5">{agent.phone}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#F1F5F9]">
                    <button onClick={() => handleChangeAgentStatus(agent.id, "active")}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors">
                      <ShieldCheck className="w-3.5 h-3.5" /> {agent.status === "blocked" ? "Unblock" : "Unsuspend"} (Set Active)
                    </button>
                    <button onClick={() => setDialog({ type: "confirm-delete-agent", agent })}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Agent
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Rejected ── */}
      {activeTab === "rejected" && (
        <div>
          {rejectedApps.length === 0 ? (
            <div className="flex flex-col items-center py-16 bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
              <XCircle className="w-10 h-10 text-red-300 mb-3" />
              <p className="font-bold text-[#0F172A]">No rejected applications</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#F1F5F9]">
                      {["Business", "Contact", "Email", "Phone", "Date", "Reason", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F8FAFC]">
                    {rejectedApps.map(app => (
                      <tr key={app.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-bold text-[#0F172A] text-sm">{app.businessName}</td>
                        <td className="px-4 py-3 text-sm text-[#334155]">{app.contactPerson}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{app.email}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]">{app.phone}</td>
                        <td className="px-4 py-3 text-xs text-[#94A3B8]">{fmt(app.createdAt)}</td>
                        <td className="px-4 py-3 text-xs text-[#94A3B8]">{app.rejectionReason || "—"}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setDialog({ type: "confirm-delete-app", app })}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 text-xs font-bold rounded-lg border border-[#E2E8F0] transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Logs ── */}
      {activeTab === "logs" && (
        <AgentActivityList agents={agents} />
      )}

      {/* ── Dialogs ── */}
      {dialog?.type === "create" && (
        <CreateAgentDialog open onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "approve-app" && (
        <ApproveApplicationDialog app={dialog.app} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "wallet" && (
        <WalletTopupDialog agent={dialog.agent} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "discounts" && (
        <PackageDiscountsDialog agent={dialog.agent} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "commission" && (
        <CommissionEditDialog agent={dialog.agent} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "detail" && (
        <AgentDetailDialog agent={dialog.agent} onClose={() => setDialog(null)}
          onAction={(type, agent) => { setDialog({ type, agent }); }} />
      )}

      {/* Confirm Status Change */}
      {dialog?.type === "confirm-status" && (
        <Dialog open onOpenChange={() => setDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-black flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${dialog.newStatus === "blocked" ? "text-red-500" : "text-amber-500"}`} />
                {dialog.newStatus === "blocked" ? "Block" : "Suspend"} Agent?
              </DialogTitle>
              <DialogDescription>
                {dialog.newStatus === "blocked"
                  ? `This will block "${dialog.agent.businessName}" from accessing the platform entirely.`
                  : `This will temporarily suspend "${dialog.agent.businessName}". They won't be able to register clients.`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDialog(null)}>Cancel</Button>
              <Button className={`flex-1 rounded-xl font-bold text-white ${dialog.newStatus === "blocked" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
                onClick={() => handleChangeAgentStatus(dialog.agent.id, dialog.newStatus)}>
                {dialog.newStatus === "blocked" ? "Block Agent" : "Suspend Agent"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Delete Agent */}
      {dialog?.type === "confirm-delete-agent" && (
        <Dialog open onOpenChange={() => setDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-black flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" /> Delete Agent?
              </DialogTitle>
              <DialogDescription>
                This will permanently delete <strong>{dialog.agent.businessName}</strong>, their wallet, discounts, and downgrade their login to a regular user. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDialog(null)}>Cancel</Button>
              <Button className="flex-1 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleDeleteAgent(dialog.agent.id)}>
                Delete Permanently
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Delete Application */}
      {dialog?.type === "confirm-delete-app" && (
        <Dialog open onOpenChange={() => setDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-black flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" /> Delete Application?
              </DialogTitle>
              <DialogDescription>
                Delete the application from <strong>{dialog.app.businessName}</strong> ({dialog.app.email})? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDialog(null)}>Cancel</Button>
              <Button className="flex-1 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleDeleteApp(dialog.app.id)}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
