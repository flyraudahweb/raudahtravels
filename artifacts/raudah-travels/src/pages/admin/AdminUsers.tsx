import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Search, ShieldCheck, ShieldBan, Ban, UserCog,
  ChevronLeft, ChevronRight, AlertTriangle, User, Crown, Briefcase, Trash2, Shield
} from "lucide-react";

interface UserProfile {
  id: string;
  clerkUserId: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
  accountStatus: string;
  createdAt: string;
}

const ROLE_CFG: Record<string, { label: string; pill: string; icon: typeof User }> = {
  super_admin: { label: "Super Admin", pill: "bg-purple-100 text-purple-700 border-purple-200", icon: Crown },
  admin:       { label: "Admin",       pill: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: Crown },
  staff:       { label: "Staff",       pill: "bg-blue-100 text-blue-700 border-blue-200",       icon: UserCog },
  agent:       { label: "Agent",       pill: "bg-orange-100 text-orange-700 border-orange-200", icon: Briefcase },
  user:        { label: "User",        pill: "bg-slate-100 text-slate-600 border-slate-200",    icon: User },
};

const STATUS_CFG: Record<string, { label: string; dot: string; pill: string }> = {
  active:    { label: "Active",    dot: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-700" },
  suspended: { label: "Suspended", dot: "bg-amber-400",   pill: "bg-amber-100 text-amber-700" },
  blocked:   { label: "Blocked",   dot: "bg-red-500",     pill: "bg-red-100 text-red-700" },
};

const ROLES = ["all", "user", "agent", "staff", "admin", "super_admin"];
const STATUSES = ["all", "active", "suspended", "blocked"];

type ConfirmDialog = { user: UserProfile; newStatus: string } | null;
type DeleteDialog = UserProfile | null;
type RoleDialog = UserProfile | null;

export default function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialog>(null);
  const [roleDialog, setRoleDialog] = useState<RoleDialog>(null);
  
  const [selectedRole, setSelectedRole] = useState("user");
  const [agentBusinessName, setAgentBusinessName] = useState("");
  const [agentContactPerson, setAgentContactPerson] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");

  const limit = 30;

  const openRoleDialog = (u: UserProfile) => {
    setRoleDialog(u);
    setSelectedRole(u.role);
    setAgentBusinessName("");
    setAgentContactPerson("");
    setAgentEmail("");
    setAgentPhone("");
  };

  const queryKey = ["admin-users", roleFilter, statusFilter, search, page];
  const { data, isLoading } = useQuery<{ users: UserProfile[]; total: number; totalPages: number }>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      return fetch(`/api/admin/users?${params}`, { credentials: "include" }).then(r => r.json());
    },
    staleTime: 15000,
  });

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const serverCounts = (data as any)?.counts;

  const handleStatusChange = (userId: string, newStatus: string) => {
    fetch(`/api/admin/users/${userId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountStatus: newStatus }),
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: d.message || `Status updated to ${newStatus}` });
      setConfirmDialog(null);
    }).catch((e: any) => toast({ title: e.message, variant: "destructive" }));
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const r = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to delete user");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User deleted successfully" });
      setDeleteDialog(null);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const handleRoleChange = async () => {
    if (!roleDialog) return;
    try {
      const payload: any = { role: selectedRole };
      if (selectedRole === "agent") {
        if (!agentBusinessName) throw new Error("Business Name is required for agents.");
        payload.businessName = agentBusinessName;
        payload.contactPerson = agentContactPerson;
        payload.agentEmail = agentEmail;
        payload.agentPhone = agentPhone;
      }
      
      const r = await fetch(`/api/admin/users/${roleDialog.id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to change role");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: d.message || "Role updated successfully" });
      setRoleDialog(null);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="page-admin-users">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D3199]/60 mb-1">ADMIN</p>
        <h1 className="text-3xl font-black text-[#1C1F66] tracking-tight">User Management</h1>
        <p className="text-[#64748B] text-sm mt-1">View and manage all accounts — users, agents, staff, and admins</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: total, gradient: "from-[#2D3199] to-[#4C56B8]", icon: Users },
          { label: "Active", value: serverCounts?.active ?? users.filter(u => u.accountStatus === "active").length, gradient: "from-emerald-500 to-teal-600", icon: ShieldCheck },
          { label: "Suspended", value: serverCounts?.suspended ?? users.filter(u => u.accountStatus === "suspended").length, gradient: "from-amber-500 to-orange-500", icon: ShieldBan },
          { label: "Blocked", value: serverCounts?.blocked ?? users.filter(u => u.accountStatus === "blocked").length, gradient: "from-red-500 to-rose-600", icon: Ban },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-md bg-gradient-to-br ${s.gradient}`}>
              <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-white/10" />
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/70">{s.label}</p>
                  <Icon className="w-3.5 h-3.5 text-white/60" />
                </div>
                <p className="text-2xl font-black tabular-nums">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, or phone…"
            className="pl-10 rounded-xl border-[#E2E8F0] h-11"
          />
        </div>
      </div>

      {/* Role + Status Filters */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-bold text-[#94A3B8] self-center mr-1">Role:</span>
        {ROLES.map(r => (
          <button key={r} onClick={() => { setRoleFilter(r); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold capitalize transition-all ${
              roleFilter === r ? "bg-[#2D3199] text-white shadow" : "bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#2D3199]/40"
            }`}>
            {r === "all" ? "All" : r.replace(/_/g, " ")}
          </button>
        ))}
        <span className="text-[#E2E8F0] mx-1 self-center">|</span>
        <span className="text-xs font-bold text-[#94A3B8] self-center mr-1">Status:</span>
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold capitalize transition-all ${
              statusFilter === s ? "bg-[#2D3199] text-white shadow" : "bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#2D3199]/40"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center py-16 bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
          <Users className="w-10 h-10 text-[#CBD5E1] mb-3" />
          <p className="font-bold text-[#0F172A]">No users found</p>
          <p className="text-[#94A3B8] text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between">
            <p className="text-xs font-black text-[#64748B] uppercase tracking-wider">
              {total} user{total !== 1 ? "s" : ""} {roleFilter !== "all" && `· ${roleFilter.replace(/_/g, " ")}`} {statusFilter !== "all" && `· ${statusFilter}`}
            </p>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  {["User", "Email", "Phone", "Role", "Status", "Joined", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[9px] font-black text-[#94A3B8] uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const rcfg = ROLE_CFG[u.role] || ROLE_CFG.user;
                  const scfg = STATUS_CFG[u.accountStatus] || STATUS_CFG.active;
                  const RIcon = rcfg.icon;
                  return (
                    <tr key={u.id} className="border-b border-[#F1F5F9] hover:bg-[#FAFBFF] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-black text-white">{u.fullName.charAt(0)}</span>
                          </div>
                          <p className="font-bold text-[#1C1F66] text-sm truncate max-w-[160px]">{u.fullName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748B] max-w-[180px] truncate">{u.email}</td>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{u.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-black border ${rcfg.pill}`}>
                          <RIcon className="w-2.5 h-2.5" /> {rcfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-black ${scfg.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot}`} /> {scfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        {u.role !== "super_admin" && (
                          <div className="flex items-center gap-1.5">
                            {u.accountStatus === "active" ? (
                              <>
                                <button onClick={() => setConfirmDialog({ user: u, newStatus: "suspended" })}
                                  className="px-2 py-1 text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                                  Suspend
                                </button>
                                <button onClick={() => setConfirmDialog({ user: u, newStatus: "blocked" })}
                                  className="px-2 py-1 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                                  Block
                                </button>
                              </>
                            ) : (
                              <button onClick={() => handleStatusChange(u.id, "active")}
                                className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                                Activate
                              </button>
                            )}
                            <div className="w-px h-4 bg-[#E2E8F0] mx-1" />
                            <button onClick={() => openRoleDialog(u)} title="Change Role"
                              className="p-1.5 text-[#64748B] hover:text-[#2D3199] hover:bg-[#F8FAFF] rounded-lg transition-colors">
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteDialog(u)} title="Delete User"
                              className="p-1.5 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-[#F1F5F9]">
            {users.map(u => {
              const rcfg = ROLE_CFG[u.role] || ROLE_CFG.user;
              const scfg = STATUS_CFG[u.accountStatus] || STATUS_CFG.active;
              return (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D3199] to-[#4C56B8] flex items-center justify-center shrink-0">
                        <span className="text-sm font-black text-white">{u.fullName.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-[#1C1F66] text-sm truncate">{u.fullName}</p>
                        <p className="text-[10px] text-[#94A3B8] truncate">{u.email}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black shrink-0 ${scfg.pill}`}>{scfg.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${rcfg.pill}`}>{rcfg.label}</span>
                    {u.role !== "super_admin" && u.accountStatus === "active" ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => setConfirmDialog({ user: u, newStatus: "suspended" })}
                          className="px-2 py-1 text-[10px] font-bold bg-amber-50 text-amber-600 rounded-lg">Suspend</button>
                        <button onClick={() => setConfirmDialog({ user: u, newStatus: "blocked" })}
                          className="px-2 py-1 text-[10px] font-bold bg-red-50 text-red-600 rounded-lg">Block</button>
                      </div>
                    ) : u.role !== "super_admin" ? (
                      <button onClick={() => handleStatusChange(u.id, "active")}
                        className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-600 rounded-lg">Activate</button>
                    ) : null}
                    {u.role !== "super_admin" && (
                      <div className="flex gap-1 ml-2 pl-2 border-l border-[#E2E8F0]">
                        <button onClick={() => openRoleDialog(u)} className="p-1 text-[#64748B] hover:text-[#2D3199]">
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteDialog(u)} className="p-1 text-[#64748B] hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#F1F5F9] flex items-center justify-between bg-[#FAFBFF]">
              <p className="text-xs text-[#64748B] font-semibold">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="rounded-lg border-[#E2E8F0] text-[#64748B] h-8">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="rounded-lg border-[#E2E8F0] text-[#64748B] h-8">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm Status Dialog */}
      {confirmDialog && (
        <Dialog open onOpenChange={() => setConfirmDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-black flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${confirmDialog.newStatus === "blocked" ? "text-red-500" : "text-amber-500"}`} />
                {confirmDialog.newStatus === "blocked" ? "Block" : "Suspend"} Account?
              </DialogTitle>
              <DialogDescription>
                {confirmDialog.newStatus === "blocked"
                  ? `This will block "${confirmDialog.user.fullName}" from logging in entirely.`
                  : `This will suspend "${confirmDialog.user.fullName}". They won't be able to use the platform until reactivated.`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setConfirmDialog(null)}>Cancel</Button>
              <Button className={`flex-1 rounded-xl font-bold text-white ${confirmDialog.newStatus === "blocked" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
                onClick={() => handleStatusChange(confirmDialog.user.id, confirmDialog.newStatus)}>
                {confirmDialog.newStatus === "blocked" ? "Block Account" : "Suspend Account"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete User Dialog */}
      {deleteDialog && (
        <Dialog open onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-black flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Delete User?
              </DialogTitle>
              <DialogDescription>
                This will permanently delete <strong>{deleteDialog.fullName}</strong>. Their financial records (bookings, payments) will be preserved, but their profile and authentication account will be removed. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteDialog(null)}>Cancel</Button>
              <Button className="flex-1 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700"
                onClick={() => handleDeleteUser(deleteDialog.id)}>
                Delete Permanently
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Role Change Dialog */}
      {roleDialog && (
        <Dialog open onOpenChange={() => setRoleDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-black flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#2D3199]" />
                Change Role
              </DialogTitle>
              <DialogDescription>
                Update permissions for {roleDialog.fullName}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Role</label>
                <select 
                  value={selectedRole} 
                  onChange={e => setSelectedRole(e.target.value)}
                  className="w-full flex h-11 rounded-xl border border-[#E2E8F0] bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2D3199]"
                >
                  <option value="user">User</option>
                  <option value="agent">Agent</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {selectedRole === "agent" && roleDialog.role !== "agent" && (
                <div className="bg-[#F8FAFF] p-4 rounded-xl border border-[#C7CBF5] space-y-3">
                  <p className="text-xs font-bold text-[#2D3199] uppercase tracking-wider mb-2">Agent Details Required</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#64748B]">Business Name *</label>
                    <Input value={agentBusinessName} onChange={e => setAgentBusinessName(e.target.value)} placeholder="e.g. Acme Travels" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#64748B]">Contact Person</label>
                    <Input value={agentContactPerson} onChange={e => setAgentContactPerson(e.target.value)} placeholder={roleDialog.fullName} className="h-9" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#64748B]">Business Email</label>
                      <Input value={agentEmail} onChange={e => setAgentEmail(e.target.value)} placeholder={roleDialog.email} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#64748B]">Business Phone</label>
                      <Input value={agentPhone} onChange={e => setAgentPhone(e.target.value)} placeholder={roleDialog.phone || ""} className="h-9" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setRoleDialog(null)}>Cancel</Button>
                <Button className="flex-1 rounded-xl font-bold text-white bg-gradient-to-br from-[#2D3199] to-[#4C56B8]"
                  onClick={handleRoleChange}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
