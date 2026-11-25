import { useState } from "react";
import { Download } from "lucide-react";
import type { createFlightItineraryPdf } from "@/lib/flightItineraryPdf";

export function FlightItineraryDownload({ itinerary, className }: {
  itinerary: Parameters<typeof createFlightItineraryPdf>[0];
  className: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!itinerary.slices?.some((slice) => slice.segments?.length)) return null;
  async function download() {
    setBusy(true);
    setError("");
    try {
      const { createFlightItineraryPdf } = await import("@/lib/flightItineraryPdf");
      const reference = itinerary.reference.replace(/[^A-Za-z0-9-]/g, "").slice(0, 70);
      createFlightItineraryPdf(itinerary).save(`FlyRaudah-itinerary-${reference}.pdf`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to download. Try printing the itinerary.");
    } finally {
      setBusy(false);
    }
  }
  return <div>
    <button type="button" className={className} disabled={busy} onClick={() => void download()}>
      <Download size={16} aria-hidden="true" /> {busy ? "Preparing PDF…" : "Download itinerary PDF"}
    </button>
    {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
  </div>;
}
