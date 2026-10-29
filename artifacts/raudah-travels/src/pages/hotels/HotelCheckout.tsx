import { useRoute } from "wouter";
import TravelCheckout from "@/components/ota/TravelCheckout";
export default function HotelCheckout() {
  const [, params] = useRoute("/hotels/checkout/:quoteId");
  return <TravelCheckout kind="hotel" offerId={params?.quoteId || ""} />;
}
