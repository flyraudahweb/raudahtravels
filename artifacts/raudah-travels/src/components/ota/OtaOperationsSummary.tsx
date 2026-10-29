import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetProfile } from "@workspace/api-client-react";
import { ota } from "@/lib/ota";

export default function OtaOperationsSummary() {
  const { data: profile } = useGetProfile();
  const allowed = profile?.role === "super_admin";
  const query = useQuery({
    queryKey: ["ota", "operations-summary"],
    queryFn: () => ota("/admin/overview"),
    enabled: allowed,
    refetchInterval: 30000,
  });
  if (!allowed) return null;
  if (query.error)
    return (
      <p
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        Travel operations summary is unavailable. Check receiver deployment and
        migrations.{" "}
        <button onClick={() => query.refetch()} className="font-bold underline">
          Retry
        </button>
      </p>
    );
  const totals = query.data?.totals,
    queues = query.data?.queues;
  return (
    <section aria-label="Travel operations overview" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900">
          Flights & hotels · all reservations
        </h2>
        <Link href="/admin/ota" className="text-xs font-bold text-indigo-700">
          Open travel operations →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Reservations", totals?.total],
          ["Confirmed", totals?.confirmed],
          ["Need review", totals?.attention],
          ["Confirming", totals?.processing],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {query.isLoading ? "…" : (value ?? "—")}
            </p>
          </div>
        ))}
      </div>
      {queues && (queues.supplier_issues > 0 || queues.payment_issues > 0) && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {queues.supplier_issues} supplier events and {queues.payment_issues}{" "}
          payment jobs need operator review.{" "}
          <Link href="/admin/ota?tab=settings" className="font-bold underline">
            Review event inbox
          </Link>
          . Verify customer payments from booking operations.
        </p>
      )}
      <p className="text-xs text-slate-500">
        Includes test and live reservations. Last supplier delivery:{" "}
        {queues?.last_supplier_event
          ? new Date(queues.last_supplier_event).toLocaleString()
          : "none received"}
        .
      </p>
    </section>
  );
}
