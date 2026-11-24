import { useId, type ReactNode } from "react";
import { FileText, Info } from "lucide-react";

const beforeVisaProcessing = "You may be eligible for a partial refund.";
const afterVisaAndTicketIssuance = "The package is non-refundable.";

const packageRefundRules = [
  ["Before visa processing starts", beforeVisaProcessing],
  [
    "While visa or ticket arrangements are in progress",
    "Contact Raudah to check whether a refund is available.",
  ],
  ["Once the visa and flight tickets have been issued", afterVisaAndTicketIssuance],
  ["Flights booked separately", "Refunds and fees follow the airline’s rules for that ticket."],
];

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

export function PackageCancellationPolicy({ detailed = false }: { detailed?: boolean }) {
  return (
    <CancellationPolicy>
      <PackageCancellationDetails detailed={detailed} />
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

export function PackageCancellationDetails({ detailed = false }: { detailed?: boolean }) {
  return (
    <>
      {detailed ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg bg-white px-3 py-2.5 text-indigo-950 ring-1 ring-inset ring-indigo-100 print:ring-0">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
            <p>Refund eligibility depends on how far visa processing and flight ticketing have progressed.</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-indigo-100 bg-white">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">Package cancellation and refund rules</caption>
              <thead className="bg-indigo-50 text-indigo-950">
                <tr>
                  <th scope="col" className="w-5/12 px-3 py-2.5 font-semibold sm:px-4">Booking stage or service</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold sm:px-4">Refund eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-100 border-t border-indigo-100">
                {packageRefundRules.map(([stage, rule]) => (
                  <tr key={stage}>
                    <th scope="row" className="px-3 py-2.5 align-top font-medium text-slate-900 sm:px-4">{stage}</th>
                    <td className="px-3 py-2.5 align-top text-slate-700 sm:px-4">{rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p>
          Cancellations requested before visa processing starts may qualify for
          a partial refund. Once the visa and flight tickets have been issued,
          the package is non-refundable.
        </p>
      )}
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
