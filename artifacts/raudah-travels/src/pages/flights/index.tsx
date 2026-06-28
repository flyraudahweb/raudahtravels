import { Switch, Route } from "wouter";
import FlightsLayout from "@/components/flights/FlightsLayout";
import FlightSearch from "./FlightSearch";
import FlightCheckout from "./FlightCheckout";
import FlightConfirmation from "./FlightConfirmation";
import FlightAdmin from "./FlightAdmin";

export default function FlightsModule() {
  return (
    <FlightsLayout>
      <Switch>
        <Route path="/flights" component={FlightSearch} />
        <Route path="/flights/search" component={FlightSearch} />
        <Route path="/flights/checkout/:offerId" component={FlightCheckout} />
        <Route path="/flights/confirmation/:bookingId" component={FlightConfirmation} />
        <Route path="/flights/admin" component={FlightAdmin} />
      </Switch>
    </FlightsLayout>
  );
}
