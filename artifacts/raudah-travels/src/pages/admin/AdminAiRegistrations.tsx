import { useState } from "react";

import { listAiRegistrations, getAiRegistration, updateAiRegistration, approveAiRegistration, rejectAiRegistration,

  retryAiRegistrationExtraction, getAiRegistrationStats, listFailedAiRegistrationJobs, retryAiRegistrationJob, skipAiRegistrationJob, purgeAiRegistrationMedia,

  type AiRegistrationApproval, type AiRegistrationReviewFields } from "@workspace/api-client-react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";

import { Input } from "@/components/ui/input";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {

  CheckCircle2, XCircle, Clock, Bot, ChevronDown, ChevronUp,

  MessageCircle, Send, RefreshCw, ShieldAlert,

} from "lucide-react";

import { formatDistanceToNow } from "date-fns";

import { useToast } from "@/hooks/use-toast";



/* ── Types ─────────────────────────────────────────────────────────────── */



interface AiSubmission {

  id: string;

  sessionId: string;

  snapshot: Record<string, any>;

  reviewData?: Record<string, any> | null;

  passportImageR2Key?: string | null;

  extractionProvider?: "gemini" | "mistral" | "manual" | null;

  duplicateStatus?: "no_duplicate_detected" | "possible_duplicate" | "duplicate_confirmed" | null;

  duplicateMatches?: Array<{ source: string; id: string; reason: string; fullName?: string | null }>;

  status: "pending_review" | "approved" | "rejected";

  rejectionReason?: string | null;

  bookingId?: string | null;

  createdAt: string;

  channel?: "whatsapp" | "telegram";

  displayName?: string | null;

  phone?: string | null;

}



interface AiSubmissionDetail {

  submission: AiSubmission;

  session: { id: string; channel: string; displayName?: string | null; phone?: string | null; telegramUsername?: string | null };

  passportImageUrl: string | null;

  audit: Array<{ id: string; event: string; actor: string; metadata?: any; createdAt: string }>;

}



interface PackageOption { id: string; name: string; type: string }



/* ── Config ────────────────────────────────────────────────────────────── */



const STATUS_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {

  pending_review: { label: "Pending Review", icon: Clock,        cls: "bg-amber-50 text-amber-700 border-amber-200" },

  approved:        { label: "Approved",       icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },

  rejected:        { label: "Rejected",       icon: XCircle,      cls: "bg-red-50 text-red-700 border-red-200" },

};



const DUPLICATE_CONFIG: Record<string, { label: string; cls: string }> = {

  no_duplicate_detected: { label: "No Duplicate",      cls: "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]" },

  possible_duplicate:    { label: "Possible Duplicate", cls: "bg-orange-50 text-orange-700 border-orange-200" },

  duplicate_confirmed:   { label: "Duplicate Confirmed", cls: "bg-red-50 text-red-700 border-red-200" },

};



const FIELD_LABELS: Record<string, string> = {

  fullName: "Full Name", phone: "Phone", email: "Email", passportNumber: "Passport No.",

  nationality: "Nationality", dateOfBirth: "Date of Birth", gender: "Gender",

  passportExpiry: "Passport Expiry", packageId: "Package",

};



/* ── API ───────────────────────────────────────────────────────────────── */



async function fetchSubmissions(status: string, page: number, channel: string, duplicateStatus: string, q: string): Promise<{ submissions: AiSubmission[]; total: number }> {

  const result = await listAiRegistrations({ limit: 30, page, status: status === "all" ? undefined : status,

    channel: channel === "all" ? undefined : channel, duplicateStatus: duplicateStatus === "all" ? undefined : duplicateStatus, q: q || undefined });

  return { submissions: (result.submissions ?? []) as AiSubmission[], total: result.total ?? 0 };

}

async function fetchDetail(id: string): Promise<AiSubmissionDetail> { return await getAiRegistration(id) as AiSubmissionDetail; }



async function fetchPackages(): Promise<{ packages: PackageOption[] }> {

  const r = await fetch("/api/packages?status=active&limit=50", { credentials: "include" });

  if (!r.ok) throw new Error("Failed to load packages");

  return r.json();

}



const updateSubmission = (id: string, data: Record<string, unknown>) => updateAiRegistration(id, data as AiRegistrationReviewFields);

const approveSubmission = (id: string, data: Record<string, unknown>) => approveAiRegistration(id, data as AiRegistrationApproval);

const rejectSubmission = (id: string, reason: string) => rejectAiRegistration(id, { reason });

const retryExtraction = (id: string) => retryAiRegistrationExtraction(id);



/* ── Component ─────────────────────────────────────────────────────────── */



export default function AdminAiRegistrations() {

  const { toast } = useToast();

  const qc = useQueryClient();

  const [page, setPage] = useState(1);

  const [channelFilter, setChannelFilter] = useState("all");

  const [duplicateFilter, setDuplicateFilter] = useState("all");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("pending_review");

  const [expanded, setExpanded] = useState<string | null>(null);

  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [rejectReason, setRejectReason] = useState("");

  const [editedFields, setEditedFields] = useState<Record<string, string>>({});

  const [selectedPackageId, setSelectedPackageId] = useState("");

  const [duplicateOverrideReason, setDuplicateOverrideReason] = useState("");

  const [mode, setMode] = useState<"review" | "reject">("review");



  const { data, isLoading, error: listError } = useQuery({

    queryKey: ["admin-ai-registrations", statusFilter, page, channelFilter, duplicateFilter, search],

    queryFn: () => fetchSubmissions(statusFilter, page, channelFilter, duplicateFilter, search),

    refetchInterval: 30000,

  });

  const submissions = data?.submissions || [];



  const { data: detail, error: detailError } = useQuery({

    queryKey: ["admin-ai-registration-detail", reviewingId],

    queryFn: () => fetchDetail(reviewingId!),

    enabled: !!reviewingId,

  });



  const { data: pkgData } = useQuery({

    queryKey: ["packages-for-ai-registration"],

    queryFn: fetchPackages,

    enabled: !!reviewingId,

  });



  const { data: stats } = useQuery({ queryKey: ["ai-registration-stats"], queryFn: () => getAiRegistrationStats(), refetchInterval: 30000 });

  const { data: failedJobs } = useQuery({ queryKey: ["ai-registration-failed-jobs"], queryFn: () => listFailedAiRegistrationJobs(), refetchInterval: 30000 });

  const retryJob = useMutation({ mutationFn: (id: string) => retryAiRegistrationJob(id), onSuccess: () => {

    qc.invalidateQueries({ queryKey: ["ai-registration-failed-jobs"] }); qc.invalidateQueries({ queryKey: ["ai-registration-stats"] });

    toast({ title: "Delivery queued for retry" });

  }, onError: () => toast({ title: "Job cannot be retried", variant: "destructive" }) });

  const skipJob = useMutation({ mutationFn: (id: string) => skipAiRegistrationJob(id, { reason: "Staff skipped failed message from the review queue" }),

    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-registration-failed-jobs"] }); toast({ title: "Failed message skipped; conversation can continue" }); },

    onError: () => toast({ title: "Message could not be skipped", variant: "destructive" }) });

  const purge = useMutation({ mutationFn: () => purgeAiRegistrationMedia(), onSuccess: (result) => toast({ title: `Purged media for ${result.purged ?? 0} sessions` }),

    onError: () => toast({ title: "Media cleanup failed", variant: "destructive" }) });



  const save = useMutation({

    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateSubmission(id, data),

    onSuccess: () => {

      qc.invalidateQueries({ queryKey: ["admin-ai-registration-detail", reviewingId] });

      toast({ title: "Changes saved" });

      setEditedFields({});

    },

    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),

  });



  const approve = useMutation({

    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => approveSubmission(id, data),

    onSuccess: (result) => {

      qc.invalidateQueries({ queryKey: ["admin-ai-registrations"] });

      toast({ title: "Registration approved", description: `Booking ${result.booking?.reference} created` });

      closeDialog();

    },

    onError: (e: any) => {

      qc.invalidateQueries({ queryKey: ["admin-ai-registration-detail", reviewingId] });

      toast({ title: "Approval failed", description: e.message, variant: "destructive" });

    },

  });



  const reject = useMutation({

    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectSubmission(id, reason),

    onSuccess: () => {

      qc.invalidateQueries({ queryKey: ["admin-ai-registrations"] });

      toast({ title: "Registration rejected" });

      closeDialog();

    },

    onError: (e: any) => toast({ title: "Rejection failed", description: e.message, variant: "destructive" }),

  });



  const retry = useMutation({

    mutationFn: (id: string) => retryExtraction(id),

    onSuccess: () => {

      qc.invalidateQueries({ queryKey: ["admin-ai-registration-detail", reviewingId] });

      toast({ title: "Extraction retried" });

    },

    onError: (e: any) => toast({ title: "Retry failed", description: e.message, variant: "destructive" }),

  });



  function closeDialog() {

    setReviewingId(null);

    setRejectReason("");

    setEditedFields({});

    setSelectedPackageId("");

    setDuplicateOverrideReason("");

    setMode("review");

  }



  function openReview(id: string) {

    setReviewingId(id);

    setEditedFields({});

    setSelectedPackageId("");

    setDuplicateOverrideReason("");

    setMode("review");

  }



  const mergedData = detail

    ? { ...(detail.submission.snapshot || {}), ...(detail.submission.reviewData || {}), ...editedFields }

    : {};



  function handleSaveEdits() {

    if (!reviewingId || Object.keys(editedFields).length === 0) return;

    save.mutate({ id: reviewingId, data: editedFields });

  }



  function handleApprove() {

    if (!reviewingId) return;

    const packageId = selectedPackageId || mergedData.packageId;

    if (!packageId) {

      toast({ title: "Select a package first", variant: "destructive" });

      return;

    }

    approve.mutate({

      id: reviewingId,

      data: {

        ...editedFields,

        packageId,

        duplicateOverrideReason: duplicateOverrideReason || undefined,

      },

    });

  }



  function handleReject() {

    if (!reviewingId || !rejectReason.trim()) return;

    reject.mutate({ id: reviewingId, reason: rejectReason.trim() });

  }



  const packages = pkgData?.packages || [];

  const duplicateConfirmed = detail?.submission.duplicateStatus === "duplicate_confirmed";



  return (

    <div className="space-y-6" data-testid="page-admin-ai-registrations">

      <div>

        <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Management</p>

        <h1 className="text-2xl font-black text-[#0F172A]">AI Registrations</h1>

        <p className="text-[#64748B] text-sm mt-0.5">Review pilgrim registrations submitted via WhatsApp and Telegram</p>

      </div>



      {stats && <p className="text-sm text-[#64748B]">Pending review: {String((stats.byStatus as Record<string, number>)?.pending_review ?? 0)} · Provider fallbacks: {String(stats.geminiFallbackCount ?? 0)}</p>}

      {Array.isArray(failedJobs?.jobs) && failedJobs.jobs.length > 0 && <div className="border border-red-200 rounded-xl p-4 space-y-2">

        <p className="font-semibold">Some channel messages need attention</p>

        {(failedJobs.jobs as Array<{ id: string; direction: string; channel: string }>).map((job) => <div key={job.id} className="flex items-center justify-between">

          <span>{job.channel} · {job.direction}</span><Button variant="outline" size="sm" disabled={retryJob.isPending} onClick={() => retryJob.mutate(job.id)}>Retry</Button><Button variant="outline" size="sm" disabled={skipJob.isPending} onClick={() => skipJob.mutate(job.id)}>Skip failed message</Button>

        </div>)}

      </div>}

      <div className="flex flex-wrap gap-3">

        <Input aria-label="Search registrations" placeholder="Search name or contact" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-64" />

        <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setPage(1); }}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All channels</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="telegram">Telegram</SelectItem></SelectContent></Select>

        <Select value={duplicateFilter} onValueChange={(v) => { setDuplicateFilter(v); setPage(1); }}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All duplicate results</SelectItem><SelectItem value="duplicate_confirmed">Confirmed duplicate</SelectItem><SelectItem value="possible_duplicate">Possible duplicate</SelectItem><SelectItem value="no_duplicate_detected">No duplicate</SelectItem></SelectContent></Select>

        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>

          <SelectTrigger className="w-48 rounded-xl border-[#DCE3F0]">

            <SelectValue placeholder="Filter by status" />

          </SelectTrigger>

          <SelectContent>

            <SelectItem value="all">All Submissions</SelectItem>

            <SelectItem value="pending_review">Pending Review</SelectItem>

            <SelectItem value="approved">Approved</SelectItem>

            <SelectItem value="rejected">Rejected</SelectItem>

          </SelectContent>

        </Select>

        <div className="flex-1" />

        <span className="text-sm text-[#64748B] self-center">{data?.total || 0} total</span>

      </div>



      {listError ? <p role="alert" className="text-red-700">Unable to load registrations. Check your access and retry.</p> : isLoading ? (

        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-[#DCE3F0]" />)}</div>

      ) : submissions.length === 0 ? (

        <div className="bg-white rounded-2xl border border-[#DCE3F0] p-12 text-center">

          <Bot className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />

          <p className="font-bold text-[#64748B]">No AI registrations</p>

        </div>

      ) : (

        <div className="space-y-3">

          {submissions.map((s) => {

            const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending_review;

            const Icon = cfg.icon;

            const dupCfg = s.duplicateStatus ? DUPLICATE_CONFIG[s.duplicateStatus] : null;

            const isOpen = expanded === s.id;

            const name = s.reviewData?.fullName || s.snapshot?.fullName || s.displayName || "Unknown";

            return (

              <div key={s.id} className="bg-white rounded-2xl border border-[#DCE3F0] overflow-hidden">

                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#F8FAFF]" onClick={() => setExpanded(isOpen ? null : s.id)}>

                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.cls.split(" ").slice(0, 1).join(" ")}`}>

                    <Icon className={`w-4 h-4 ${cfg.cls.split(" ").slice(1, 2).join(" ")}`} />

                  </div>

                  <div className="flex-1 min-w-0">

                    <div className="flex items-center gap-2 mb-0.5">

                      <span className="font-black text-[#0F172A] text-sm">{name}</span>
                      {s.snapshot?.bulkId && <span className="text-[10px] border px-2 py-0.5 rounded-full text-indigo-700" title={`Group ${s.snapshot.bulkId}`}>Group {String(s.snapshot.bulkId).slice(0, 8)} · {s.snapshot.bulkIndex}/{s.snapshot.bulkSize}</span>}

                      <span className={`text-[10px] border px-2 py-0.5 rounded-full font-bold capitalize ${cfg.cls}`}>{cfg.label}</span>

                      {dupCfg && (

                        <span className={`text-[10px] border px-2 py-0.5 rounded-full font-bold ${dupCfg.cls}`}>{dupCfg.label}</span>

                      )}

                    </div>

                    <p className="text-xs text-[#64748B] flex items-center gap-1.5">

                      <MessageCircle className="w-3 h-3" />

                      {s.channel === "whatsapp" ? "WhatsApp" : "Telegram"} · {s.phone || "—"} · {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}

                    </p>

                  </div>

                  <div className="flex items-center gap-3">

                    {s.status === "pending_review" && (

                      <Button size="sm" onClick={(e) => { e.stopPropagation(); openReview(s.id); }} className="bg-[#2D3199] hover:bg-[#1C1F66] text-white rounded-xl text-xs h-8 px-3">

                        Review

                      </Button>

                    )}

                    {isOpen ? <ChevronUp className="w-4 h-4 text-[#94A3B8]" /> : <ChevronDown className="w-4 h-4 text-[#94A3B8]" />}

                  </div>

                </div>



                {isOpen && (

                  <div className="border-t border-[#F1F5F9] px-5 py-4 bg-[#F8FAFF] space-y-2">

                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Collected Data</p>

                    {Object.entries({ ...(s.snapshot || {}), ...(s.reviewData || {}) }).filter(([k]) => FIELD_LABELS[k]).map(([field, value]) => (

                      <div key={field} className="grid grid-cols-3 gap-3 text-sm">

                        <span className="text-[#64748B] font-semibold">{FIELD_LABELS[field]}</span>

                        <span className="col-span-2 text-[#0F172A] truncate">{String(value || "—")}</span>

                      </div>

                    ))}

                    {s.status === "rejected" && s.rejectionReason && (

                      <div className="mt-3 pt-3 border-t border-[#DCE3F0]">

                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Rejection Reason</p>

                        <p className="text-sm text-[#475569]">{s.rejectionReason}</p>

                      </div>

                    )}

                  </div>

                )}

              </div>

            );

          })}

        </div>

      )}



      <div className="flex items-center gap-3">

        <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>

        <span>Page {page}</span><Button variant="outline" disabled={page * 30 >= (data?.total ?? 0)} onClick={() => setPage(page + 1)}>Next</Button>

        <Button variant="outline" className="ml-auto" disabled={purge.isPending} onClick={() => purge.mutate()}>Purge media older than 30 days</Button>

      </div>

      {/* Review dialog */}

      <Dialog open={!!reviewingId} onOpenChange={(o) => { if (!o) closeDialog(); }}>

        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto">

          <DialogHeader>

            <DialogTitle className="font-black text-[#0F172A]">Review AI Registration</DialogTitle>

          </DialogHeader>



          {detailError ? <p role="alert">Unable to load this registration.</p> : !detail ? (

            <div className="py-8 text-center text-sm text-[#64748B]">Loading…</div>

          ) : (

            <div className="space-y-4 mt-2">

              {detail.submission.duplicateStatus && detail.submission.duplicateStatus !== "no_duplicate_detected" && (

                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">

                  <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />

                  <div className="text-xs text-red-700">

                    <p className="font-bold">{duplicateConfirmed ? "Duplicate confirmed" : "Possible duplicate"}</p>

                    {detail.submission.duplicateMatches?.map((m, i) => (

                      <p key={i}>{m.fullName || m.id} — {m.reason}</p>

                    ))}

                  </div>

                </div>

              )}



              {detail.passportImageUrl && (

                <div className="flex justify-center bg-[#F8FAFC] rounded-xl p-3">

                  <img src={detail.passportImageUrl} alt="Passport" className="max-h-64 rounded-lg shadow-sm" />

                </div>

              )}



              <div className="flex items-center justify-between">

                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">

                  Extraction: {detail.submission.extractionProvider || "none"}

                </p>

                <Button size="sm" variant="outline" onClick={() => retry.mutate(reviewingId!)} disabled={retry.isPending || save.isPending || approve.isPending} className="rounded-xl text-xs h-7">

                  <RefreshCw className={`w-3 h-3 mr-1 ${retry.isPending ? "animate-spin" : ""}`} /> Retry Extraction

                </Button>

              </div>



              <div className="bg-[#F8FAFF] rounded-xl p-4 space-y-3">

                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Pilgrim Details (editable)</p>

                {Object.keys(FIELD_LABELS).filter((f) => f !== "packageId").map((field) => (

                  <div key={field} className="grid grid-cols-3 gap-3 items-center text-sm">

                    <label className="text-[#64748B] font-semibold text-xs">{FIELD_LABELS[field]}</label>

                    <Input

                      className="col-span-2 h-8 text-sm rounded-lg"

                      value={editedFields[field] ?? mergedData[field] ?? ""}

                      onChange={(e) => setEditedFields((f) => ({ ...f, [field]: e.target.value }))}

                    />

                  </div>

                ))}

                <div className="grid grid-cols-3 gap-3 items-center text-sm">

                  <label className="text-[#64748B] font-semibold text-xs">Package</label>

                  <Select value={selectedPackageId || mergedData.packageId || ""} onValueChange={setSelectedPackageId}>

                    <SelectTrigger className="col-span-2 h-8 text-sm rounded-lg"><SelectValue placeholder="Select package" /></SelectTrigger>

                    <SelectContent>

                      {packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}

                    </SelectContent>

                  </Select>

                </div>

                {Object.keys(editedFields).length > 0 && (

                  <Button size="sm" variant="outline" onClick={handleSaveEdits} disabled={save.isPending} className="rounded-xl text-xs h-7">

                    Save Edits

                  </Button>

                )}

              </div>



              {duplicateConfirmed && (

                <div>

                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Override reason (required to approve)</label>

                  <Textarea value={duplicateOverrideReason} onChange={(e) => setDuplicateOverrideReason(e.target.value)} placeholder="Explain why this is not a duplicate…" className="mt-1 rounded-xl resize-none" rows={2} />

                </div>

              )}



              {mode === "reject" ? (

                <div>

                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Rejection reason (required)</label>

                  <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this registration being rejected?" className="mt-1 rounded-xl resize-none" rows={3} />

                  <div className="flex gap-3 pt-3">

                    <Button variant="outline" onClick={() => setMode("review")} className="flex-1 rounded-xl">Back</Button>

                    <Button onClick={handleReject} disabled={reject.isPending || rejectReason.trim().length < 3} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl">

                      <XCircle className="w-4 h-4 mr-1.5" /> Confirm Reject

                    </Button>

                  </div>

                </div>

              ) : (

                <div className="flex gap-3 pt-1">

                  <Button onClick={() => setMode("reject")} disabled={approve.isPending} variant="outline" className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50">

                    <XCircle className="w-4 h-4 mr-1.5" /> Reject

                  </Button>

                  <Button

                    onClick={handleApprove}

                    disabled={approve.isPending || save.isPending || retry.isPending || reject.isPending || (duplicateConfirmed && duplicateOverrideReason.trim().length < 5)}

                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"

                  >

                    <Send className="w-4 h-4 mr-1.5" /> Approve & Create Booking

                  </Button>

                </div>

              )}



              {detail.audit.length > 0 && (

                <details className="pt-2">

                  <summary className="text-xs font-bold text-[#64748B] uppercase tracking-wider cursor-pointer">Audit Timeline ({detail.audit.length})</summary>

                  <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">

                    {detail.audit.map((a) => (

                      <div key={a.id} className="text-xs text-[#64748B] flex justify-between">

                        <span>{a.event} <span className="text-[#94A3B8]">({a.actor})</span></span>

                        <span className="text-[#94A3B8]">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>

                      </div>

                    ))}

                  </div>

                </details>

              )}

            </div>

          )}

        </DialogContent>

      </Dialog>

    </div>

  );

}
