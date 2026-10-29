import { Switch, Route } from "wouter";
import TravelSearchPage from "@/components/ota/TravelSearchPage";
import TravelCheckout from "@/components/ota/TravelCheckout";
import TravelBooking from "@/components/ota/TravelBooking";

export default function FlightsModule() {
  return (
    <Switch>
      <Route path="/flights/checkout/:offerId">
        {(params) => <TravelCheckout kind="flight" offerId={params.offerId} />}
      </Route>
      <Route path="/flights/confirmation/:id">
        {(params) => <TravelBooking bookingId={params.id} />}
      </Route>
      <Route>
        <TravelSearchPage kind="flight" />
      </Route>
    </Switch>
  );
}
