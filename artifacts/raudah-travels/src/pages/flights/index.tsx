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
        <Route path="/" component={FlightSearch} />
        <Route path="/search" component={FlightSearch} />
        <Route path="/checkout/:offerId" component={FlightCheckout} />
        <Route path="/confirmation/:bookingId" component={FlightConfirmation} />
        <Route path="/admin" component={FlightAdmin} />
      </Switch>
    </FlightsLayout>
  );
}
