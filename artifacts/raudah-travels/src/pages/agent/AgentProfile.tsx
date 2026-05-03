import { useState, useEffect } from "react";
import { useGetAgentProfile, getGetAgentProfileQueryKey, useUpdateAgentProfile, useApplyAsAgent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Building2, BadgeCheck, Clock, XCircle, Sparkles, TrendingUp, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof BadgeCheck }> = {
  active:    { label: "Active",    color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", icon: BadgeCheck },
  pending:   { label: "Pending Review", color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",   icon: Clock },
  suspended: { label: "Suspended", color: "text-red-700",    bg: "bg-red-50",     border: "border-red-200",     icon: XCircle },
};

export default function AgentProfile() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: agent, isLoading } = useGetAgentProfile({ query: { queryKey: getGetAgentProfileQueryKey() } });
  const updateAgent = useUpdateAgentProfile();
  const applyAsAgent = useApplyAsAgent();

  const [form, setForm] = useState({ businessName: "", bio: "" });
  const [applyForm, setApplyForm] = useState({ businessName: "", bio: "" });

  useEffect(() => {
    if (agent) setForm({ businessName: agent.businessName || "", bio: agent.bio || "" });
  }, [agent]);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateAgent.mutate(
      { data: form },
      {
        onSuccess: () => {
          toast({ title: "Profile updated successfully" });
          qc.invalidateQueries({ queryKey: getGetAgentProfileQueryKey() });
        },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      }
    );
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    applyAsAgent.mutate(
      { data: applyForm },
      {
        onSuccess: () => toast({ title: "Application submitted!", description: "Our team will review your application within 2-3 business days." }),
        onError: () => toast({ title: "Application failed", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-1/3 rounded-xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );

  if (!agent) {
    return (
      <div className="space-y-6 max-w-lg" data-testid="page-agent-apply">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D3199]/60 mb-1">AGENT PORTAL</p>
          <h1 className="text-3xl font-black text-[#1C1F66] tracking-tight">Become a Raudah Agent</h1>
          <p className="text-[#64748B] text-sm mt-1">Join our agency network and earn commissions on every booking</p>
        </div>

        {/* Perks */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: TrendingUp, label: "Earn Commissions", gradient: "from-[#FF3B00] to-[#FF6B35]" },
            { icon: Users, label: "Manage Clients", gradient: "from-[#2D3199] to-[#4C56B8]" },
            { icon: Sparkles, label: "Priority Support", gradient: "from-emerald-500 to-teal-600" },
          ].map(p => {
            const Icon = p.icon;
            return (
              <div key={p.label} className={`rounded-2xl bg-gradient-to-br ${p.gradient} p-4 text-white text-center`}>
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-2">
                  <Icon className="w-4.5 h-4.5 text-white" />
                </div>
                <p className="text-[10px] font-black text-white/90 leading-tight">{p.label}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F1F5F9] bg-gradient-to-r from-[#2D3199] to-[#4C56B8]">
            <h2 className="font-black text-white text-sm">Agency Application</h2>
            <p className="text-white/70 text-xs mt-0.5">Fill in your details to get started</p>
          </div>
          <form onSubmit={handleApply} className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="businessName" className="text-xs font-black text-[#1C1F66] uppercase tracking-wide">Agency / Company Name</Label>
              <Input
                id="businessName"
                value={applyForm.businessName}
                onChange={(e) => setApplyForm(f => ({ ...f, businessName: e.target.value }))}
                required
                data-testid="input-company-name"
                className="rounded-xl border-[#E2E8F0] focus:border-[#2D3199] focus:ring-[#2D3199]/20 h-11"
                placeholder="e.g. Al-Baraka Travel Agency"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-xs font-black text-[#1C1F66] uppercase tracking-wide">Tell us about your agency</Label>
              <Textarea
                id="bio"
                value={applyForm.bio}
                onChange={(e) => setApplyForm(f => ({ ...f, bio: e.target.value }))}
                rows={4}
                placeholder="Years of experience, areas you serve, specializations..."
                data-testid="input-agent-bio"
                className="rounded-xl border-[#E2E8F0] focus:border-[#2D3199] focus:ring-[#2D3199]/20 resize-none"
              />
            </div>
            <Button type="submit" className="w-full bg-[#2D3199] hover:bg-[#252880] rounded-xl h-11 font-black" disabled={applyAsAgent.isPending} data-testid="button-apply-agent">
              {applyAsAgent.isPending ? "Submitting…" : "Submit Application"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CFG[agent.status] || STATUS_CFG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-6 max-w-2xl" data-testid="page-agent-profile">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D3199]/60 mb-1">AGENT PORTAL</p>
        <h1 className="text-3xl font-black text-[#1C1F66] tracking-tight">Agency Profile</h1>
        <p className="text-[#64748B] text-sm mt-1">Manage your agency information</p>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-4 p-5 rounded-2xl border ${statusCfg.bg} ${statusCfg.border}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          agent.status === "active" ? "bg-emerald-100" : agent.status === "suspended" ? "bg-red-100" : "bg-amber-100"
        }`}>
          <StatusIcon className={`w-6 h-6 ${statusCfg.color}`} />
        </div>
        <div className="flex-1">
          <p className="font-black text-[#1C1F66] text-base">{agent.businessName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${
              agent.status === "active" ? "bg-emerald-500 animate-pulse" :
              agent.status === "suspended" ? "bg-red-500" : "bg-amber-500"
            }`} />
            <p className={`text-xs font-black capitalize ${statusCfg.color}`}>{statusCfg.label}</p>
          </div>
        </div>
        {agent.commissionRate && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-[#94A3B8] font-semibold">Commission Rate</p>
            <p className="text-2xl font-black text-[#2D3199]">
              {agent.commissionType === "percentage" ? `${agent.commissionRate}%` : `₦${Number(agent.commissionRate).toLocaleString()}`}
            </p>
          </div>
        )}
      </div>

      {/* Edit form */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-black text-[#1C1F66] text-sm">Agency Details</h2>
            <p className="text-xs text-[#94A3B8]">Update your public agency information</p>
          </div>
        </div>
        <form onSubmit={handleUpdate} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="editBusinessName" className="text-xs font-black text-[#1C1F66] uppercase tracking-wide">Agency Name</Label>
            <Input
              id="editBusinessName"
              value={form.businessName}
              onChange={(e) => setForm(f => ({ ...f, businessName: e.target.value }))}
              data-testid="input-profile-company"
              className="rounded-xl border-[#E2E8F0] focus:border-[#2D3199] focus:ring-[#2D3199]/20 h-11"
              placeholder="Your agency name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="editBio" className="text-xs font-black text-[#1C1F66] uppercase tracking-wide">Agency Bio</Label>
            <Textarea
              id="editBio"
              value={form.bio}
              onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
              rows={5}
              data-testid="input-profile-bio"
              className="rounded-xl border-[#E2E8F0] focus:border-[#2D3199] focus:ring-[#2D3199]/20 resize-none"
              placeholder="Tell pilgrims about your agency…"
            />
          </div>
          <Button
            type="submit"
            className="bg-[#2D3199] hover:bg-[#252880] rounded-xl h-11 font-black px-8"
            disabled={updateAgent.isPending}
            data-testid="button-save-agent-profile"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateAgent.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </div>
    </div>
  );
}
