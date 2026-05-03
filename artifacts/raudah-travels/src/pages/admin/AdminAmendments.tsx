import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Clock, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Amendment {
  id: string;
  bookingId: string;
  status: string;
  requestedChanges?: Record<string, { old: any; new: any }>;
  adminNotes?: string;
  reviewedAt?: string;
  createdAt: string;
  booking?: { id: string; reference?: string; fullName?: string };
  user?: { id: string; fullName: string; email: string };
}

const FIELD_LABELS: Record<string, string> = {
  phone: "Phone Number",
  address: "Home Address",
  emergency_contact_name: "Emergency Contact Name",
  emergency_contact_phone: "Emergency Contact Phone",
  emergency_contact_relationship: "Emergency Contact Relationship",
  special_requests: "Special Requests",
  departure_city: "Departure City",
  room_preference: "Room Preference",
  package_id: "Package",
  package_date_id: "Travel Date",
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {
  pending:  { label: "Pending",  icon: Clock,         cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approved", icon: CheckCircle2,  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", icon: XCircle,       cls: "bg-red-50 text-red-700 border-red-200" },
};

async function fetchAmendments(status?: string): Promise<{ amendments: Amendment[]; total: number }> {
  const params = new URLSearchParams({ limit: "30" });
  if (status && status !== "all") params.set("status", status);
  const r = await fetch(`/api/admin/amendments?${params}`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function updateAmendment(id: string, data: any): Promise<Amendment> {
  const r = await fetch(`/api/admin/amendments/${id}`, {
    method: "PUT", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export default function AdminAmendments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Amendment | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-amendments", statusFilter],
    queryFn: () => fetchAmendments(statusFilter),
  });
  const amendments = data?.amendments || [];

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateAmendment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-amendments"] });
      toast({ title: "Amendment updated" });
      setReviewing(null); setNotes("");
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const handleAction = (action: "approved" | "rejected") => {
    if (!reviewing) return;
    update.mutate({ id: reviewing.id, data: { status: action, adminNotes: notes } });
  };

  return (
    <div className="space-y-6" data-testid="page-admin-amendments">
      <div>
        <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Management</p>
        <h1 className="text-2xl font-black text-[#0F172A]">Amendment Requests</h1>
        <p className="text-[#64748B] text-sm mt-0.5">Review pilgrim requests to modify their booking details</p>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 rounded-xl border-[#DCE3F0]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <span className="text-sm text-[#64748B] self-center">{data?.total || 0} total</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-[#DCE3F0]" />)}</div>
      ) : amendments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DCE3F0] p-12 text-center">
          <Pencil className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
          <p className="font-bold text-[#64748B]">No amendment requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {amendments.map(a => {
            const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isOpen = expanded === a.id;
            const changes = a.requestedChanges || {};
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#F8FAFF]" onClick={() => setExpanded(isOpen ? null : a.id)}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.cls.split(" ").slice(0,1).join(" ")}`}>
                    <Icon className={`w-4 h-4 ${cfg.cls.split(" ").slice(1,2).join(" ")}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-black text-[#0F172A] text-sm">{a.user?.fullName || "Unknown"}</span>
                      <span className={`text-[10px] border px-2 py-0.5 rounded-full font-bold capitalize ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-[#64748B]">
                      Ref: {a.booking?.reference || a.bookingId} · {Object.keys(changes).length} field{Object.keys(changes).length !== 1 ? "s" : ""} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.status === "pending" && (
                      <Button size="sm" onClick={e => { e.stopPropagation(); setReviewing(a); setNotes(""); }} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl text-xs h-8 px-3">
                        Review
                      </Button>
                    )}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[#94A3B8]" /> : <ChevronDown className="w-4 h-4 text-[#94A3B8]" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[#F1F5F9] px-5 py-4 bg-[#F8FAFF]">
                    {Object.keys(changes).length === 0 ? (
                      <p className="text-sm text-[#64748B]">No field changes recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Requested Changes</p>
                        {Object.entries(changes).map(([field, vals]: [string, any]) => (
                          <div key={field} className="grid grid-cols-3 gap-3 text-sm">
                            <span className="text-[#64748B] font-semibold">{FIELD_LABELS[field] || field}</span>
                            <span className="text-red-500 line-through truncate">{String(vals?.old || "—")}</span>
                            <span className="text-emerald-600 font-semibold truncate">{String(vals?.new || "—")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {a.adminNotes && (
                      <div className="mt-3 pt-3 border-t border-[#DCE3F0]">
                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Admin Notes</p>
                        <p className="text-sm text-[#475569]">{a.adminNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!reviewing} onOpenChange={() => setReviewing(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-[#0F172A]">Review Amendment</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4 mt-2">
              <div className="bg-[#F8FAFF] rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Requested Changes</p>
                {Object.entries(reviewing.requestedChanges || {}).map(([field, vals]: [string, any]) => (
                  <div key={field} className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-[#64748B] font-semibold text-xs">{FIELD_LABELS[field] || field}</span>
                    <span className="text-red-500 line-through truncate text-xs">{String(vals?.old || "—")}</span>
                    <span className="text-emerald-600 font-semibold truncate text-xs">{String(vals?.new || "—")}</span>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Notes (optional)</label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add review notes…" className="mt-1 rounded-xl resize-none" rows={3} />
              </div>
              <div className="flex gap-3 pt-1">
                <Button onClick={() => handleAction("rejected")} disabled={update.isPending} variant="outline" className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50">
                  <XCircle className="w-4 h-4 mr-1.5" /> Reject
                </Button>
                <Button onClick={() => handleAction("approved")} disabled={update.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve & Apply
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
