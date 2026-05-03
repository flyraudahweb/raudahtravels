import { useQuery } from "@tanstack/react-query";
import { FileText, Plane, Clock, CheckCircle, XCircle, Loader2, ShieldCheck } from "lucide-react";

interface VisaRecord {
  id: string;
  status: string;
  visaNumber?: string;
  visaExpiry?: string;
  rejectionReason?: string;
  notes?: string;
  visaDocumentUrl?: string;
  ticketDocumentUrl?: string;
  createdAt: string;
  bookingRef?: string;
  packageName?: string;
  packageType?: string;
}

const STATUS_META: Record<string, { icon: typeof Clock; color: string; bg: string; label: string; desc: string }> = {
  pending: {
    icon: Clock,
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    label: "Pending",
    desc: "Your visa application is being prepared. We will notify you once it has been submitted to the embassy.",
  },
  submitted: {
    icon: Loader2,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    label: "Submitted to Embassy",
    desc: "Your visa application has been submitted to the Saudi embassy and is currently being processed.",
  },
  approved: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    label: "Approved",
    desc: "Your visa has been approved. You can download your visa document below.",
  },
  rejected: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    label: "Rejected",
    desc: "Unfortunately, your visa application was rejected. Please contact our support team for assistance.",
  },
};

export default function DashboardVisa() {
  const { data, isLoading } = useQuery<{ visas: VisaRecord[] }>({
    queryKey: ["my-visa"],
    queryFn: () => fetch("/api/my-visa", { credentials: "include" }).then(r => r.json()),
  });

  const visas = data?.visas ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#2D3199] flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">My Visa Status</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your visa and flight ticket documents</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D3199]" />
        </div>
      ) : visas.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center">
          <ShieldCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="font-bold text-gray-500">No visa applications yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Once your booking is confirmed, a visa application will be created for you automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visas.map(visa => {
            const meta = STATUS_META[visa.status] ?? STATUS_META.pending;
            const StatusIcon = meta.icon;
            return (
              <div key={visa.id} className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                {/* Top band */}
                <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-gray-900 text-base leading-tight">
                      {visa.packageName || "Hajj / Umrah Package"}
                    </p>
                    {visa.bookingRef && (
                      <p className="text-xs text-gray-400 font-mono mt-0.5">Booking: {visa.bookingRef}</p>
                    )}
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${meta.bg} ${meta.color}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${visa.status === "submitted" ? "animate-spin" : ""}`} />
                    {meta.label}
                  </span>
                </div>

                {/* Status explanation */}
                <div className={`px-5 py-3 ${meta.bg}`}>
                  <p className="text-sm text-gray-700">{meta.desc}</p>
                </div>

                {/* Details */}
                <div className="px-5 py-4 space-y-3">
                  {visa.visaNumber && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 font-medium w-28 shrink-0">Visa Number</span>
                      <span className="font-mono font-bold text-gray-900">{visa.visaNumber}</span>
                    </div>
                  )}
                  {visa.visaExpiry && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 font-medium w-28 shrink-0">Expires</span>
                      <span className="font-semibold text-gray-700">
                        {new Date(visa.visaExpiry).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  {visa.status === "rejected" && visa.rejectionReason && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-xs font-bold text-red-700 mb-1">Reason for Rejection</p>
                      <p className="text-sm text-red-600">{visa.rejectionReason}</p>
                    </div>
                  )}

                  {/* Download buttons */}
                  {(visa.visaDocumentUrl || visa.ticketDocumentUrl) && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      {visa.visaDocumentUrl && (
                        <a href={visa.visaDocumentUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2D3199] text-white text-sm font-bold hover:bg-[#2D3199]/90 transition-colors shadow-sm">
                          <FileText className="w-4 h-4" />
                          Download Visa Document
                        </a>
                      )}
                      {visa.ticketDocumentUrl && (
                        <a href={visa.ticketDocumentUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm">
                          <Plane className="w-4 h-4" />
                          Download Flight Ticket
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Applied date */}
                <div className="px-5 py-2.5 bg-gray-50 border-t">
                  <p className="text-[11px] text-gray-400">
                    Application created {new Date(visa.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="bg-[#2D3199]/4 border border-[#2D3199]/15 rounded-xl p-4">
        <p className="text-sm font-bold text-[#2D3199] mb-1">Need help with your visa?</p>
        <p className="text-sm text-gray-600">
          Contact our support team at <span className="font-semibold text-[#2D3199]">support@flyraudah.com.ng</span> or
          use the Support section in your dashboard. We're here to help every step of the way.
        </p>
      </div>
    </div>
  );
}
