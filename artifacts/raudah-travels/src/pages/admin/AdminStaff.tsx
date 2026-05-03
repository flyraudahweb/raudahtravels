import { useState } from "react";
import {
  useListStaff, getListStaffQueryKey,
  useInviteStaff, useDeleteStaff, useUpdateStaffSpecialties,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  UserCog, Shield, Crown, User, Plus, Pencil, Trash2,
  Eye, Key, RefreshCw, ChevronRight, Tag, TicketCheck,
} from "lucide-react";

/* ── Constants ───────────────────────────────────────────────────────────────── */

export const PAGE_PERMISSIONS = [
  { key: "overview",          label: "Overview",           desc: "View admin dashboard overview" },
  { key: "packages",          label: "Packages",           desc: "Manage hajj/umrah packages" },
  { key: "bookings",          label: "Bookings",           desc: "View and manage bookings" },
  { key: "payments",          label: "Payments",           desc: "View and manage payments" },
  { key: "pilgrims",          label: "Pilgrims",           desc: "View and manage pilgrim records" },
  { key: "passports",         label: "Passports",          desc: "View and download passport documents" },
  { key: "register_pilgrim",  label: "Register Pilgrim",   desc: "Walk-in pilgrim booking" },
  { key: "analytics",         label: "Analytics",          desc: "Access analytics and reports" },
  { key: "id_tags",           label: "ID Tags",            desc: "Generate and manage ID tags" },
  { key: "visa_management",   label: "Visa Management",    desc: "Track and manage visa applications" },
  { key: "amendments",        label: "Amendments",         desc: "Handle booking amendment requests" },
  { key: "agents",            label: "Agent Applications", desc: "Review agent applications" },
  { key: "bank_accounts",     label: "Bank Accounts",      desc: "Manage bank account details" },
  { key: "support_tickets",   label: "Support Tickets",    desc: "Manage customer support tickets" },
  { key: "team_chat",         label: "Team Chat",          desc: "Internal team messaging" },
  { key: "activity_log",      label: "Activity Log",       desc: "View system activity log" },
  { key: "booking_form",      label: "Booking Form",       desc: "Customise booking form fields" },
  { key: "settings",          label: "Settings",           desc: "Modify site settings" },
  { key: "staff_management",  label: "Staff Management",   desc: "Manage staff accounts and permissions" },
] as const;

export const SUPPORT_SPECIALTIES = [
  { key: "general_inquiry",            label: "General Inquiry",           desc: "General questions and inquiries" },
  { key: "booking_issues",             label: "Booking Issues",            desc: "Booking-related problems" },
  { key: "payment_issues",             label: "Payment Issues",            desc: "Payment and billing queries" },
  { key: "document_problems",          label: "Document Problems",         desc: "Document upload or verification" },
  { key: "technical_support",          label: "Technical Support",         desc: "Technical or system issues" },
  { key: "pilgrim_booking_assistance", label: "Pilgrim Booking Assistance",desc: "Help guiding pilgrim booking" },
  { key: "visa_processing",            label: "Visa Processing",           desc: "Visa issuance and tracking" },
  { key: "flights_transport",          label: "Flights & Transport",       desc: "Flight ticketing and logistics" },
  { key: "agent_commissions",          label: "Agent Commissions",         desc: "Agent limits and top-ups" },
] as const;

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; gradient: string; badge: string; text: string }> = {
  super_admin: { label: "Super Admin", icon: Crown,  gradient: "from-[#FF3B00] to-[#FF6B3D]", badge: "bg-[#FFF0ED] border-[#FECDBA] text-[#C2410C]",   text: "text-[#C2410C]" },
  admin:       { label: "Admin",       icon: Shield, gradient: "from-[#2D3199] to-[#4C56B8]", badge: "bg-[#EEF0FF] border-[#C7CCF5] text-[#2D3199]",   text: "text-[#2D3199]" },
  staff:       { label: "Staff",       icon: User,   gradient: "from-[#0284C7] to-[#38BDF8]", badge: "bg-blue-50 border-blue-200 text-blue-700",         text: "text-blue-700" },
};

const AVATAR_COLORS = ["#2D3199","#FF3B00","#10B981","#F59E0B","#8B5CF6","#0EA5E9","#EC4899"];

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/* ── Staff Dialog ─────────────────────────────────────────────────────────────── */

interface StaffDialogProps {
  open: boolean;
  onClose: () => void;
  member?: {
    id: string; fullName: string; email: string; role: string;
    permissions: string[]; specialties: string[];
  } | null;
  onSaved: () => void;
}

function StaffDialog({ open, onClose, member, onSaved }: StaffDialogProps) {
  const { toast } = useToast();
  const isEdit = !!member;

  const [form, setForm] = useState(() => ({
    fullName: member?.fullName || "",
    email: member?.email || "",
    role: member?.role === "super_admin" ? "admin" : (member?.role || "staff"),
    password: "",
    permissions: new Set<string>(member?.permissions || []),
    specialties: new Set<string>(member?.specialties || []),
  }));
  const [isSaving, setIsSaving] = useState(false);

  const invite = useInviteStaff();

  const togglePerm = (key: string) => {
    setForm(f => {
      const s = new Set(f.permissions);
      s.has(key) ? s.delete(key) : s.add(key);
      return { ...f, permissions: s };
    });
  };

  const toggleSpec = (key: string) => {
    setForm(f => {
      const specs = new Set(f.specialties);
      specs.has(key) ? specs.delete(key) : specs.add(key);
      // Automatically grant support_tickets page access whenever any specialty is assigned
      const perms = new Set(f.permissions);
      if (specs.size > 0) perms.add("support_tickets");
      return { ...f, specialties: specs, permissions: perms };
    });
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      toast({ title: "Full name and email are required", variant: "destructive" }); return;
    }
    if (!isEdit && !form.password.trim()) {
      toast({ title: "A temporary password is required", variant: "destructive" }); return;
    }

    if (isEdit && member) {
      if (isSaving) return;
      setIsSaving(true);
      try {
        await fetch(`/api/admin/staff/${member.id}/permissions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissions: Array.from(form.permissions) }),
        });
        await fetch(`/api/admin/staff/${member.id}/specialties`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ specialties: Array.from(form.specialties) }),
        });
        if (form.role !== member.role) {
          await fetch(`/api/admin/staff/${member.id}/role`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: form.role }),
          });
        }
        toast({ title: "Staff member updated" });
        onSaved();
        onClose();
      } catch {
        toast({ title: "Failed to update staff member", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    invite.mutate({
      data: {
        fullName: form.fullName,
        email: form.email,
        role: form.role as "staff" | "admin",
        password: form.password,
        permissions: Array.from(form.permissions),
        specialties: Array.from(form.specialties),
      },
    }, {
      onSuccess: () => {
        toast({ title: "Staff member created", description: `${form.fullName} can now log in with the temporary password.` });
        onSaved();
        onClose();
      },
      onError: (e: any) => {
        const msg = e?.response?.data?.error || "Failed to create staff account";
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F1F5F9]">
          <DialogTitle className="text-lg font-black text-[#0F172A]">
            {isEdit ? `Edit — ${member?.fullName}` : "Invite Staff Member"}
          </DialogTitle>
          <p className="text-[#94A3B8] text-sm mt-0.5">
            {isEdit
              ? "Update permissions and support specialties."
              : "Create a login for a team member. Share the temporary password with them directly."}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[72vh]">
          <div className="px-6 py-5 space-y-6">

            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Full Name</Label>
                <Input
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Amina Sani"
                  disabled={isEdit}
                  className="rounded-xl border-[#DCE3F0] focus-visible:ring-[#2D3199]/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="amina@raudah.ng"
                  disabled={isEdit}
                  className="rounded-xl border-[#DCE3F0] focus-visible:ring-[#2D3199]/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={v => setForm(f => ({ ...f, role: v }))}
                >
                  <SelectTrigger className="rounded-xl border-[#DCE3F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff (limited access)</SelectItem>
                    <SelectItem value="admin">Admin (elevated access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!isEdit && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Temporary Password</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Set a temporary password"
                      className="rounded-xl border-[#DCE3F0] flex-1 font-mono text-sm"
                    />
                    <Button
                      type="button" variant="outline" size="icon"
                      className="rounded-xl border-[#DCE3F0] shrink-0"
                      onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}
                      title="Generate password"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-[#94A3B8]">Share this with the staff member. They'll be prompted to change it after first login.</p>
                </div>
              )}
            </div>

            {/* Page permissions */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[#EEF0FF] flex items-center justify-center shrink-0">
                  <Eye className="w-3.5 h-3.5 text-[#2D3199]" />
                </div>
                <div>
                  <p className="font-black text-sm text-[#0F172A]">Page Access</p>
                  <p className="text-[11px] text-[#94A3B8]">Which sidebar sections this person can see and use</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PAGE_PERMISSIONS.map(p => (
                  <label
                    key={p.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                      ${form.permissions.has(p.key)
                        ? "border-[#2D3199] bg-[#EEF0FF]"
                        : "border-[#E8EDF5] bg-white hover:border-[#C7CCF5]"}`}
                  >
                    <Checkbox
                      checked={form.permissions.has(p.key)}
                      onCheckedChange={() => togglePerm(p.key)}
                      className="mt-0.5 rounded-md data-[state=checked]:bg-[#2D3199] data-[state=checked]:border-[#2D3199]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-tight ${form.permissions.has(p.key) ? "text-[#2D3199]" : "text-[#334155]"}`}>
                        {p.label}
                      </p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">{p.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Support specialties */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[#FFF0ED] flex items-center justify-center shrink-0">
                  <TicketCheck className="w-3.5 h-3.5 text-[#FF3B00]" />
                </div>
                <div>
                  <p className="font-black text-sm text-[#0F172A]">Support Ticket Specialties</p>
                  <p className="text-[11px] text-[#94A3B8]">Which ticket categories will be auto-routed to this person · selecting any automatically grants Support page access</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUPPORT_SPECIALTIES.map(s => (
                  <label
                    key={s.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                      ${form.specialties.has(s.key)
                        ? "border-[#FF3B00] bg-[#FFF5F2]"
                        : "border-[#E8EDF5] bg-white hover:border-[#FECDBA]"}`}
                  >
                    <Checkbox
                      checked={form.specialties.has(s.key)}
                      onCheckedChange={() => toggleSpec(s.key)}
                      className="mt-0.5 rounded-md data-[state=checked]:bg-[#FF3B00] data-[state=checked]:border-[#FF3B00]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-tight ${form.specialties.has(s.key) ? "text-[#C2410C]" : "text-[#334155]"}`}>
                        {s.label}
                      </p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">{s.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-[#F1F5F9] flex items-center justify-between gap-3 bg-[#FAFBFF]">
          <Button variant="ghost" onClick={onClose} className="rounded-xl text-[#64748B]">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={invite.isPending || isSaving}
            className="rounded-xl bg-[#2D3199] hover:bg-[#242880] text-white font-bold px-6"
          >
            {(invite.isPending || isSaving) ? "Saving..." : isEdit ? "Save Changes" : "Create Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Delete confirm ────────────────────────────────────────────────────────────── */

function DeleteDialog({ member, onClose, onDeleted }: {
  member: { id: string; fullName: string } | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const deleteStaff = useDeleteStaff();

  const handleDelete = () => {
    if (!member) return;
    deleteStaff.mutate({ id: member.id }, {
      onSuccess: () => {
        toast({ title: `${member.fullName} removed` });
        onDeleted();
        onClose();
      },
      onError: () => toast({ title: "Failed to remove staff member", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={!!member} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-black text-[#0F172A]">Remove staff member?</DialogTitle>
        </DialogHeader>
        <p className="text-[#64748B] text-sm">
          This will permanently remove <span className="font-bold text-[#0F172A]">{member?.fullName}</span>'s
          account and revoke all access. This cannot be undone.
        </p>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
          <Button
            onClick={handleDelete}
            disabled={deleteStaff.isPending}
            className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
          >
            {deleteStaff.isPending ? "Removing..." : "Remove"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────────────── */

export default function AdminStaff() {
  const qc = useQueryClient();
  const { data, isLoading } = useListStaff({ query: { queryKey: getListStaffQueryKey() } });
  const staff = data?.staff || [];

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<typeof staff[0] | null>(null);
  const [deleteMember, setDeleteMember] = useState<{ id: string; fullName: string } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: getListStaffQueryKey() });

  const groupedByRole = staff.reduce((acc, m) => {
    const r = m.role || "staff";
    if (!acc[r]) acc[r] = [];
    acc[r].push(m);
    return acc;
  }, {} as Record<string, typeof staff>);

  const totalPages = (m: typeof staff[0]) => m.permissions?.length || 0;
  const totalSpecs = (m: typeof staff[0]) => m.specialties?.length || 0;

  return (
    <div className="space-y-6" data-testid="page-admin-staff">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">System</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Staff Management</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Invite team members and control what each person can access.</p>
        </div>
        <Button
          onClick={() => setInviteOpen(true)}
          className="bg-[#2D3199] hover:bg-[#242880] text-white font-bold rounded-xl shrink-0"
          data-testid="button-invite-staff"
        >
          <Plus className="w-4 h-4 mr-2" /> Invite Staff
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Team",  value: staff.length,                                                                             color: "#2D3199" },
          { label: "Admins",      value: (groupedByRole["admin"]?.length || 0) + (groupedByRole["super_admin"]?.length || 0), color: "#FF3B00" },
          { label: "Staff",       value: groupedByRole["staff"]?.length || 0,                                                     color: "#10B981" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-[#DCE3F0] p-4 shadow-[0_2px_12px_rgba(45,49,153,0.04)]">
            <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mb-4">
            <UserCog className="w-6 h-6 text-[#2D3199]/40" />
          </div>
          <p className="text-[#0F172A] font-bold mb-1">No staff members yet</p>
          <p className="text-[#94A3B8] text-sm mb-4">Invite a team member to get started</p>
          <Button onClick={() => setInviteOpen(true)} className="bg-[#2D3199] text-white rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Invite Staff
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {["super_admin", "admin", "staff"].map(role => {
            const members = groupedByRole[role];
            if (!members?.length) return null;
            const rc = ROLE_CONFIG[role] || ROLE_CONFIG.staff;
            const RoleIcon = rc.icon;

            return (
              <div key={role}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${rc.gradient} flex items-center justify-center shadow-sm`}>
                    <RoleIcon className="w-4 h-4 text-white" />
                  </div>
                  <h2 className={`font-black text-base ${rc.text}`}>
                    {rc.label}{members.length !== 1 ? "s" : ""}
                  </h2>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${rc.badge}`}>
                    {members.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {members.map((member, idx) => {
                    const pages = totalPages(member);
                    const specs = totalSpecs(member);
                    const isSuperAdmin = member.role === "super_admin";

                    return (
                      <div
                        key={member.id}
                        className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_12px_rgba(45,49,153,0.04)] p-4 hover:shadow-[0_4px_20px_rgba(45,49,153,0.08)] transition-shadow"
                        data-testid={`row-staff-${member.id}`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <Avatar className="h-11 w-11 shrink-0">
                            <AvatarFallback className="font-black text-white text-sm" style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                              {member.fullName?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black text-[#0F172A]">{member.fullName}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize border ${rc.badge}`}>
                                {rc.label}
                              </span>
                              {isSuperAdmin && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 border border-amber-200 text-amber-700">
                                  Full access
                                </span>
                              )}
                            </div>
                            <p className="text-[#94A3B8] text-sm mt-0.5 truncate">{member.email}</p>

                            {/* Tags */}
                            {!isSuperAdmin && (
                              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                {/* Page access */}
                                <div className="flex items-center gap-1.5">
                                  <Eye className="w-3.5 h-3.5 text-[#2D3199]" />
                                  {pages === 0 ? (
                                    <span className="text-[11px] text-[#94A3B8] italic">No pages assigned</span>
                                  ) : pages <= 4 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {member.permissions.map(p => {
                                        const def = PAGE_PERMISSIONS.find(x => x.key === p);
                                        return def ? (
                                          <Badge key={p} variant="outline" className="text-[10px] font-semibold border-[#C7CCF5] text-[#2D3199] bg-[#F5F6FF] rounded-lg py-0 h-5">
                                            {def.label}
                                          </Badge>
                                        ) : null;
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-[11px] font-bold text-[#2D3199]">{pages} pages assigned</span>
                                  )}
                                </div>

                                {/* Support specialties */}
                                {specs > 0 && (
                                  <>
                                    <span className="w-px h-3 bg-[#DCE3F0]" />
                                    <div className="flex items-center gap-1.5">
                                      <TicketCheck className="w-3.5 h-3.5 text-[#FF3B00]" />
                                      {specs <= 3 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {member.specialties.map(s => {
                                            const def = SUPPORT_SPECIALTIES.find(x => x.key === s);
                                            return def ? (
                                              <Badge key={s} variant="outline" className="text-[10px] font-semibold border-[#FECDBA] text-[#C2410C] bg-[#FFF5F2] rounded-lg py-0 h-5">
                                                {def.label}
                                              </Badge>
                                            ) : null;
                                          })}
                                        </div>
                                      ) : (
                                        <span className="text-[11px] font-bold text-[#C2410C]">{specs} specialties</span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          {!isSuperAdmin && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm" variant="outline"
                                className="rounded-xl border-[#DCE3F0] text-[#2D3199] hover:bg-[#EEF0FF] hover:border-[#2D3199] text-xs font-bold"
                                onClick={() => setEditMember(member)}
                                data-testid={`button-edit-staff-${member.id}`}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                className="rounded-xl text-[#94A3B8] hover:text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteMember({ id: member.id, fullName: member.fullName })}
                                data-testid={`button-delete-staff-${member.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StaffDialog
        open={inviteOpen || !!editMember}
        onClose={() => { setInviteOpen(false); setEditMember(null); }}
        member={editMember}
        onSaved={refresh}
      />

      <DeleteDialog
        member={deleteMember}
        onClose={() => setDeleteMember(null)}
        onDeleted={refresh}
      />
    </div>
  );
}
