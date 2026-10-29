import { Switch, Route } from "wouter";
import TravelSearchPage from "@/components/ota/TravelSearchPage";
import TravelCheckout from "@/components/ota/TravelCheckout";
import TravelBooking from "@/components/ota/TravelBooking";

export default function HotelsModule() {
  return (
    <Switch>
      <Route path="/hotels/checkout/:quoteId">
        {(params) => <TravelCheckout kind="hotel" offerId={params.quoteId} />}
      </Route>
      <Route path="/hotels/confirmation/:id">
        {(params) => <TravelBooking bookingId={params.id} />}
      </Route>
      <Route>
        <TravelSearchPage kind="hotel" />
      </Route>
    </Switch>
  );
}
