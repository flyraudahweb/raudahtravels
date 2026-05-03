import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListBookings, getListBookingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Clock, Pencil, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const AMENDABLE_FIELDS: { key: string; label: string; type?: string }[] = [
  { key: "phone",                          label: "Phone Number" },
  { key: "address",                        label: "Home Address" },
  { key: "emergencyContactName",           label: "Emergency Contact Name" },
  { key: "emergencyContactPhone",          label: "Emergency Contact Phone" },
  { key: "emergencyContactRelationship",   label: "Emergency Contact Relationship" },
  { key: "specialRequests",               label: "Special Requests",    type: "textarea" },
  { key: "departureCity",                  label: "Departure City" },
  { key: "roomPreference",                 label: "Room Preference" },
];

const STATUS_CONFIG: Record<string, { label: string; Icon: typeof Clock; cls: string }> = {
  pending:  { label: "Pending Review", Icon: Clock,         cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approved",       Icon: CheckCircle2,  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected",       Icon: XCircle,       cls: "bg-red-50 text-red-700 border-red-200" },
};

interface Amendment {
  id: string;
  bookingId: string;
  status: string;
  requestedChanges?: Record<string, { old: any; new: any }>;
  adminNotes?: string;
  createdAt: string;
  booking?: { id: string; reference?: string; fullName?: string };
}

async function fetchMyAmendments(): Promise<{ amendments: Amendment[] }> {
  const r = await fetch("/api/dashboard/amendments", { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load amendments");
  return r.json();
}

async function createAmendment(data: { bookingId: string; requestedChanges: Record<string, { old: any; new: any }> }) {
  const r = await fetch("/api/dashboard/amendments", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || "Failed to submit");
  }
  return r.json();
}

export default function DashboardAmendments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const { data: amendmentsData, isLoading } = useQuery({
    queryKey: ["my-amendments"],
    queryFn: fetchMyAmendments,
  });
  const amendments = amendmentsData?.amendments || [];

  const { data: bookingsData } = useListBookings({}, { query: { queryKey: getListBookingsQueryKey({}) } });
  const bookings = (bookingsData?.bookings || []).filter((b: any) =>
    b.status === "pending" || b.status === "confirmed"
  );

  const selectedBooking = bookings.find((b: any) => b.id === selectedBookingId);

  const submit = useMutation({
    mutationFn: () => {
      if (!selectedBooking) throw new Error("No booking selected");
      const requestedChanges: Record<string, { old: any; new: any }> = {};
      AMENDABLE_FIELDS.forEach(f => {
        const newVal = fieldValues[f.key]?.trim();
        if (!newVal) return;
        const oldVal = (selectedBooking as any)[f.key] || "";
        if (newVal !== oldVal) requestedChanges[f.key] = { old: oldVal, new: newVal };
      });
      if (Object.keys(requestedChanges).length === 0) throw new Error("No changes to submit");
      return createAmendment({ bookingId: selectedBookingId, requestedChanges });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-amendments"] });
      toast({ title: "Amendment request submitted", description: "Our team will review and respond shortly." });
      setOpen(false); setSelectedBookingId(""); setFieldValues({});
    },
    onError: (e: any) => toast({ title: e.message || "Failed to submit", variant: "destructive" }),
  });

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) { setSelectedBookingId(""); setFieldValues({}); }
  };

  return (
    <div className="space-y-6" data-testid="page-dashboard-amendments">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[#0F172A]">Amendments</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Request changes to your booking details</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={bookings.length === 0}
          className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl font-bold gap-2">
          <Plus className="w-4 h-4" /> Request Change
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-[#EEF0FF] border border-[#C7CFF8] rounded-2xl p-4 flex gap-3">
        <Pencil className="w-4 h-4 text-[#2D3199] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-[#2D3199] mb-0.5">How amendments work</p>
          <p className="text-xs text-[#4C56B8] leading-relaxed">Submit your requested changes and our admin team will review and approve or reject each request. Approved changes take effect immediately.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-[#DCE3F0]" />)}</div>
      ) : amendments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#DCE3F0] p-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mb-4">
            <Pencil className="w-6 h-6 text-[#2D3199]" />
          </div>
          <p className="font-bold text-[#0F172A] mb-1">No amendment requests</p>
          <p className="text-sm text-[#94A3B8]">You haven't requested any changes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {amendments.map(a => {
            const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
            const { Icon } = cfg;
            const changes = a.requestedChanges || {};
            const isExpanded = expanded === a.id;
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#F8FAFF]" onClick={() => setExpanded(isExpanded ? null : a.id)}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.cls.split(" ")[0]}`}>
                    <Icon className={`w-4 h-4 ${cfg.cls.split(" ")[1]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-[#0F172A] text-sm">
                        Booking {a.booking?.reference || a.bookingId.slice(0, 8)}
                      </span>
                      <span className={`text-[10px] border px-2 py-0.5 rounded-full font-bold ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-[#64748B]">
                      {Object.keys(changes).length} field{Object.keys(changes).length !== 1 ? "s" : ""} requested
                      {" · "}{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#94A3B8]" /> : <ChevronDown className="w-4 h-4 text-[#94A3B8]" />}
                </div>
                {isExpanded && (
                  <div className="border-t border-[#F1F5F9] px-5 py-4 bg-[#F8FAFF] space-y-3">
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Requested Changes</p>
                    {Object.entries(changes).map(([field, vals]: [string, any]) => {
                      const fieldInfo = AMENDABLE_FIELDS.find(f => f.key === field);
                      return (
                        <div key={field} className="bg-white rounded-xl border border-[#EEF0FF] p-3">
                          <p className="text-xs font-bold text-[#64748B] mb-2">{fieldInfo?.label || field}</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-[10px] text-[#94A3B8] font-semibold mb-0.5">Previous</p>
                              <p className="text-red-500 line-through text-xs">{String(vals?.old || "—")}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-[#94A3B8] font-semibold mb-0.5">Requested</p>
                              <p className="text-emerald-600 font-semibold text-xs">{String(vals?.new || "—")}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {a.adminNotes && (
                      <div className="bg-white rounded-xl border border-[#EEF0FF] p-3">
                        <p className="text-xs font-bold text-[#64748B] mb-1">Admin Notes</p>
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

      {/* Request Amendment Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black text-[#0F172A] flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#2D3199]" /> Request Booking Change
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <div>
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">Select Booking</label>
              <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                <SelectTrigger className="rounded-xl border-[#DCE3F0]">
                  <SelectValue placeholder="Choose a booking to amend…" />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.reference || b.id.slice(0, 8)} — {b.packageName || "Package"} ({b.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBooking && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Fields to Change <span className="text-[#CBD5E1] font-normal normal-case">(leave blank to keep current)</span>
                </p>
                {AMENDABLE_FIELDS.map(f => {
                  const current = (selectedBooking as any)[f.key];
                  return (
                    <div key={f.key} className="bg-[#F8FAFF] rounded-xl p-3 border border-[#EEF0FF]">
                      <label className="text-xs font-bold text-[#0F172A] block mb-1">{f.label}</label>
                      {current && <p className="text-[10px] text-[#94A3B8] mb-2">Current: <span className="text-[#64748B]">{current}</span></p>}
                      {f.type === "textarea" ? (
                        <Textarea
                          value={fieldValues[f.key] || ""}
                          onChange={e => setFieldValues(v => ({ ...v, [f.key]: e.target.value }))}
                          placeholder={`New ${f.label.toLowerCase()}…`}
                          className="bg-white border-[#DCE3F0] rounded-lg resize-none text-sm"
                          rows={2}
                        />
                      ) : (
                        <input
                          value={fieldValues[f.key] || ""}
                          onChange={e => setFieldValues(v => ({ ...v, [f.key]: e.target.value }))}
                          placeholder={`New ${f.label.toLowerCase()}…`}
                          className="w-full bg-white border border-[#DCE3F0] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2D3199] transition-all"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              onClick={() => submit.mutate()}
              disabled={!selectedBookingId || submit.isPending || Object.values(fieldValues).every(v => !v?.trim())}
              className="w-full bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl h-11 font-bold">
              {submit.isPending ? "Submitting…" : "Submit Amendment Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
