import { useRoute } from "wouter";
import TravelBooking from "@/components/ota/TravelBooking";
export default function HotelConfirmation() {
  const [, params] = useRoute("/hotels/confirmation/:id");
  return <TravelBooking bookingId={params?.id || ""} />;
}
