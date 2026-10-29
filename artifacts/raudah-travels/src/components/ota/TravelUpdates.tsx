import { useState } from "react";
import { Link } from "wouter";
import { Bell, Check, ArrowUpRight, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetProfile,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { ota } from "@/lib/ota";

export default function TravelUpdates({
  operations = false,
  limit = 5,
}: {
  operations?: boolean;
  limit?: number;
}) {
  const { data: profile } = useGetProfile();
  const allowed = !!profile && (!operations || profile.role === "super_admin");
  const qc = useQueryClient();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["ota", "updates"],
    queryFn: () => ota("/updates"),
    enabled: allowed,
    refetchInterval: 30000,
  });
  if (!allowed) return null;
  const rows = query.data?.updates || [];
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white print:hidden"
      aria-label="Travel updates"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-700">
            <Bell size={19} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">
              {operations ? "Travel operations alerts" : "Travel updates"}
            </h2>
            <p className="text-xs text-slate-500">
              {operations
                ? "Booking issues and customer requests"
                : "Confirmations, itinerary changes and booking help"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Refresh travel updates"
        >
          <RefreshCw
            size={16}
            className={query.isFetching ? "animate-spin" : ""}
          />
        </button>
      </div>
      <div className="divide-y divide-slate-100" aria-live="polite">
        {query.isLoading ? (
          <p className="p-5 text-sm text-slate-500">Loading updates…</p>
        ) : query.error ? (
          <p role="alert" className="p-5 text-sm text-amber-800">
            Updates could not be loaded. Refresh to try again.
          </p>
        ) : !rows.length ? (
          <p className="p-5 text-sm text-slate-500">
            No travel updates yet. Booking updates will appear here
            automatically.
          </p>
        ) : (
          rows.slice(0, limit).map((item: any) => (
            <article
              key={item.id}
              className={`flex items-start gap-3 px-5 py-4 ${item.isRead ? "" : "bg-indigo-50/40"}`}
            >
              <span
                className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.isRead ? "bg-slate-200" : "bg-indigo-600"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                <p className="mt-1 break-words text-sm leading-relaxed text-slate-600">
                  {item.message}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <time
                    dateTime={item.createdAt}
                    className="text-xs text-slate-500"
                  >
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  {item.link && (
                    <Link
                      href={item.link}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700"
                    >
                      Open booking <ArrowUpRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
              {!item.isRead && (
                <button
                  type="button"
                  aria-label={`Mark ${item.title} as read`}
                  disabled={!!busy}
                  className="rounded-lg border bg-white p-2 text-indigo-700 disabled:opacity-40"
                  onClick={async () => {
                    setBusy(item.id);
                    setError("");
                    try {
                      const response = await fetch(
                        `/api/notifications/${encodeURIComponent(item.id)}/read`,
                        { method: "PUT", credentials: "include" },
                      );
                      if (!response.ok)
                        throw new Error("Could not mark this update as read.");
                      await Promise.all([
                        qc.invalidateQueries({ queryKey: ["ota", "updates"] }),
                        qc.invalidateQueries({
                          queryKey: getListNotificationsQueryKey({}),
                        }),
                      ]);
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Check size={15} />
                </button>
              )}
            </article>
          ))
        )}
      </div>
      {error && (
        <p role="alert" className="px-5 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        <span>Refreshes every 30 seconds while this page is open</span>
        <Link
          href={
            operations
              ? "/admin/ota"
              : profile?.role === "agent"
                ? "/agent/notifications"
                : "/dashboard/notifications"
          }
          className="font-semibold text-indigo-700"
        >
          View all updates →
        </Link>
      </div>
    </section>
  );
}
