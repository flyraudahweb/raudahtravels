import { useRoute } from "wouter";
import TravelBooking from "@/components/ota/TravelBooking";
export default function FlightConfirmation() {
  const [, params] = useRoute("/flights/confirmation/:id");
  return <TravelBooking bookingId={params?.id || ""} />;
}
