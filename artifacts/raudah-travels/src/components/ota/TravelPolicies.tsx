import { CancellationPolicy } from "@/components/CancellationPolicy";

type HotelCondition = { title: string; description: string };
type HotelRate = {
  id?: string;
  name?: string;
  conditions?: HotelCondition[];
  cancellation_summary?: string;
  cancellation_timeline?: {
    before: string;
    currency: string;
    refund_amount: string | number;
  }[];
};
type FareFee = {
  amount?: number;
  currency?: string;
  percent?: number;
  label?: string;
  applicability?: string;
};
type FareCondition = {
  allowed?: boolean;
  penalty_amount?: string;
  penalty_currency?: string;
};
type PolicyOffer = {
  accommodation?: { rooms?: { name?: string; rates?: HotelRate[] }[] };
  conditions?: {
    refund_before_departure?: FareCondition;
    change_before_departure?: FareCondition;
  };
  fare_terms?: {
    refundable?: boolean;
    changeable?: boolean;
    refund_fee?: FareFee;
    change_fee?: FareFee;
    has_refund_fee?: boolean;
    has_change_fee?: boolean;
    notes?: string[];
  };
};

const deadlineFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function isCancellationCondition({ title }: HotelCondition) {
  return title === "Cancellation fee" || title === "Cancellation terms";
}

function hotelDeadline(before: string) {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(before)) return before;
  const time = Date.parse(before);
  return Number.isFinite(time) ? `${deadlineFormat.format(time)} UTC` : before;
}

export function HotelRateCancellation({ rate }: { rate: HotelRate }) {
  const conditions = rate.conditions?.filter(isCancellationCondition) ?? [];
  const timeline = (rate.cancellation_timeline ?? [])
    .filter(
      (entry) => entry.before && entry.currency && entry.refund_amount != null,
    )
    .sort((a, b) => Date.parse(a.before) - Date.parse(b.before));

  if (
    rate.cancellation_timeline?.length === 0 &&
    !rate.cancellation_summary &&
    !conditions.length
  ) {
    return <p>The supplier lists this rate as non-refundable.</p>;
  }
  if (!rate.cancellation_summary && !timeline.length && !conditions.length) {
    return (
      <p>
        Cancellation terms are unavailable for this rate. Ask travel support to
        confirm them.
      </p>
    );
  }

  return (
    <>
      {rate.cancellation_summary && <p>{rate.cancellation_summary}</p>}
      {timeline.map((entry, i) => (
        <p key={i}>
          {i > 0
            ? `From ${hotelDeadline(timeline[i - 1].before)} until `
            : "Before "}
          {hotelDeadline(entry.before)}, the supplier refund is {entry.currency}{" "}
          {entry.refund_amount}.
        </p>
      ))}
      {conditions.map(({ title, description }, i) => (
        <p key={i}>
          <strong>{title}</strong> {description}
        </p>
      ))}
    </>
  );
}

export function TravelCancellationPolicy({
  kind,
  offer,
  requestMode = "checkout",
}: {
  kind: "flight" | "hotel";
  offer: PolicyOffer;
  requestMode?: "checkout" | "booking" | "none";
}) {
  const cancellationHelp = requestMode !== "none" && (
    <p className="border-t border-indigo-100 pt-2 print:hidden">
      {requestMode === "booking" ? (
        <>
          <a
            href="#booking-help"
            className="font-semibold text-indigo-800 underline"
          >
            Request a cancellation
          </a>
          .
        </>
      ) : (
        <>
          After booking, open <strong>My Trips</strong> to request a
          cancellation.
        </>
      )}{" "}
      Our travel team will confirm any fees and the amount you can get back.
    </p>
  );

  if (kind === "flight") {
    return (
      <CancellationPolicy>
        <p>
          Refund eligibility and fees depend on the airline’s rules for this
          ticket.
        </p>
        <FlightConditions offer={offer} />
        {cancellationHelp}
      </CancellationPolicy>
    );
  }

  const rooms = offer.accommodation?.rooms ?? [];
  const rates = rooms.flatMap((room, index) =>
    (room.rates ?? []).map((rate) => ({
      rate,
      room: index + 1,
      name: rate.name || room.name,
    })),
  );

  return (
    <CancellationPolicy>
      <p>Any refund or fee depends on the room rate and when you cancel.</p>
      {rates.length ? (
        rates.map(({ rate, room, name }, index) => (
          <div key={`${room}-${rate.id ?? index}`} className="space-y-2">
            {rates.length > 1 && (
              <p className="font-semibold">
                Room {room}
                {name ? ` · ${name}` : ""}
              </p>
            )}
            <HotelRateCancellation rate={rate} />
          </div>
        ))
      ) : (
        <HotelRateCancellation rate={{}} />
      )}
      {cancellationHelp}
    </CancellationPolicy>
  );
}

function FlightConditions({ offer }: { offer: PolicyOffer }) {
  const terms = offer.fare_terms;
  if (terms) {
    const rules = [
      {
        title: "Refund if you cancel",
        allowed: terms.refundable,
        fee: terms.refund_fee,
        hasFee: terms.has_refund_fee,
      },
      {
        title: "Changes",
        allowed: terms.changeable,
        fee: terms.change_fee,
        hasFee: terms.has_change_fee,
      },
    ];
    return (
      <div className="space-y-2 text-sm text-slate-600">
        {rules.map(({ title, allowed, fee, hasFee }) => {
          const amount =
            fee?.amount != null && fee.currency
              ? `${fee.currency} ${fee.amount}`
              : fee?.percent != null
                ? `${fee.percent}%`
                : undefined;
          const feeLabel =
            fee?.label ||
            (fee?.applicability === "noShow" ? "No-show fee" : "Supplier fee");
          return (
            <p key={title}>
              <strong>{title}:</strong>{" "}
              {allowed == null
                ? "Ask travel support to confirm."
                : allowed
                  ? "Allowed subject to supplier rules."
                  : "Not permitted by this fare."}
              {amount
                ? ` ${feeLabel}: ${amount}.`
                : hasFee
                  ? " A supplier fee applies. Ask for the amount."
                  : ""}
            </p>
          );
        })}
        {!!terms.notes?.length && (
          <ul className="list-disc space-y-1 pl-4">
            {terms.notes.map((note: string, index: number) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (
    offer.conditions?.refund_before_departure?.allowed == null &&
    offer.conditions?.change_before_departure?.allowed == null
  ) {
    return <p>Ask travel support to confirm the refund and change terms.</p>;
  }

  return (
    <div className="space-y-2 text-sm text-slate-600">
      {(["refund_before_departure", "change_before_departure"] as const).map(
        (key) => {
          const condition = offer.conditions?.[key];
          return (
            <p key={key}>
              <strong>
                {key === "refund_before_departure"
                  ? "Refund if you cancel before departure"
                  : "Changes before departure"}
                :
              </strong>{" "}
              {condition?.allowed == null
                ? "Ask travel support to confirm."
                : condition.allowed
                  ? `Allowed${condition.penalty_amount != null && condition.penalty_currency ? `, supplier penalty ${condition.penalty_currency} ${condition.penalty_amount}` : " subject to supplier rules"}. Fare differences and service fees may apply.`
                  : "Not permitted by this fare."}
            </p>
          );
        },
      )}
    </div>
  );
}
