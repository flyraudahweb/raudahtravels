import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

type Segment = {
  origin?: { iata_code?: string };
  destination?: { iata_code?: string };
  departing_at?: string;
  arriving_at?: string;
  marketing_carrier?: { name?: string; iata_code?: string };
  marketing_carrier_flight_number?: string;
};

const clean = (value?: string) => value?.trim().replace(/\s+/g, " ") || "";

export function createFlightItineraryPdf(booking: {
  reference: string;
  locator?: string;
  ticketed?: boolean;
  mode?: string;
  names?: string[];
  slices: { segments?: Segment[] }[];
}) {
  const flights = booking.slices.flatMap(({ segments }, leg) => (segments ?? []).map((segment) => [
    String(leg + 1),
    [segment.marketing_carrier?.iata_code, segment.marketing_carrier_flight_number].map(clean).filter(Boolean).join(" ") || clean(segment.marketing_carrier?.name) || "Unavailable",
    `${clean(segment.origin?.iata_code) || "Unavailable"} to ${clean(segment.destination?.iata_code) || "Unavailable"}`,
    clean(segment.departing_at).replace("T", " ") || "Unavailable",
    clean(segment.arriving_at).replace("T", " ") || "Unavailable",
  ]));
  if (!flights.length) throw new Error("Flight schedule information is unavailable for this itinerary.");
  const names = (booking.names ?? []).map(clean).filter(Boolean);
  if (names.some((name) => /[^\u0020-\u007E\u00A0-\u00FF]/.test(name)))
    throw new Error("Use Print itinerary to preserve the original spelling of traveller names.");

  const document = new jsPDF({ compress: true });
  document.setProperties({ title: "FlyRaudah flight itinerary", creator: "FlyRaudah" });
  document.setFillColor(28, 31, 102);
  document.rect(0, 0, 210, 47, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  document.text("RAUDAH TRAVEL & TOURS", 15, 15);
  document.setFontSize(25);
  document.text("Flight itinerary", 15, 30);
  document.setFontSize(10);
  document.text(booking.mode === "test" ? "Sandbox reservation" : "Confirmed reservation", 15, 39);
  const margin = { left: 15, right: 15, bottom: 17 };
  autoTable(document, {
    startY: 54, margin, theme: "plain", styles: { fontSize: 9, overflow: "linebreak" },
    body: [
      ["FlyRaudah reference", booking.reference],
      ["Airline or supplier reference", clean(booking.locator) || "Unavailable"],
      ["Ticket issuance", booking.ticketed ? "Reported by Nuitee" : "Issuance details unavailable"],
      ...(names.length ? [["Travellers", names.join(", ")]] : []),
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 54 } },
  });
  autoTable(document, {
    margin, theme: "striped", styles: { fontSize: 9, overflow: "linebreak", cellPadding: 3 },
    headStyles: { fillColor: [45, 49, 153] },
    head: [["Leg", "Flight", "Route", "Departure", "Arrival"]], body: flights,
    foot: [[{ content: "Times are local to each airport. This itinerary is issued by FlyRaudah for your records. Request the airline-issued ticket from your travel team if needed.", colSpan: 5 }]],
    showFoot: "lastPage", footStyles: { fillColor: [240, 242, 250], textColor: [15, 23, 42], fontStyle: "normal" },
    didDrawPage: ({ pageNumber }) => {
      document.setTextColor(70, 80, 100);
      document.setFontSize(8);
      document.text(`FlyRaudah · Itinerary · Page ${pageNumber}`, 15, 287);
    },
  });
  return document;
}
