import { useRoute } from "wouter";
import TravelCheckout from "@/components/ota/TravelCheckout";
export default function FlightCheckout() {
  const [, params] = useRoute("/flights/checkout/:offerId");
  return <TravelCheckout kind="flight" offerId={params?.offerId || ""} />;
}
