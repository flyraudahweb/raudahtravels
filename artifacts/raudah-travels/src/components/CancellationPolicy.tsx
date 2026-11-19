import { useId, type ReactNode } from "react";
import { FileText } from "lucide-react";

export const packageCancellationTerms =
  "Cancellations made before visa processing may be eligible for a partial refund. No refunds are available once visas and flights are issued.";

export function CancellationPolicy({ children }: { children: ReactNode }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 print:border-slate-200 print:bg-white"
    >
      <h3
        id={headingId}
        className="flex items-center gap-2 font-bold text-indigo-950"
      >
        <FileText aria-hidden="true" size={17} className="shrink-0" />
        Cancellation policy
      </h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
        {children}
      </div>
    </section>
  );
}

export function PackageCancellationPolicy() {
  return (
    <CancellationPolicy>
      <PackageCancellationDetails />
      <a
        href="/terms#package-cancellations"
        target="_blank"
        rel="noreferrer"
        className="inline-block font-semibold text-indigo-800 hover:underline"
      >
        Read package terms (opens in a new tab)
      </a>
    </CancellationPolicy>
  );
}

export function PackageCancellationDetails() {
  return (
    <>
      <p>{packageCancellationTerms}</p>
      <p>
        To request a cancellation,{" "}
        <a href="/contact" className="font-semibold text-indigo-800 underline">
          contact Raudah
        </a>{" "}
        with your booking reference. Our team will confirm whether a refund is
        available.
      </p>
    </>
  );
}
