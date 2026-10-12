import { Switch, Route } from "wouter";
import HotelSearch from "./HotelSearch";
import HotelDetail from "./HotelDetail";
import HotelCheckout from "./HotelCheckout";
import HotelConfirmation from "./HotelConfirmation";

export default function HotelsModule() {
  return (
    <Switch>
      <Route path="/hotels" component={HotelSearch} />
      <Route path="/hotels/search" component={HotelSearch} />
      <Route path="/hotels/confirmation/:id" component={HotelConfirmation} />
      <Route path="/hotels/checkout/:hotelId" component={HotelCheckout} />
      <Route path="/hotels/:id" component={HotelDetail} />
    </Switch>
  );
}
