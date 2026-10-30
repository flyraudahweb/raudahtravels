// Customer methods only: never add admin or supplier callback routes here.
export const MOBILE_OTA_OPERATIONS = [
  ["GET", "/config"],
  ["GET", "/capabilities"],
  ["GET", "/exchange-rates"],
  ["GET", "/me"],
  ["POST", "/me/bootstrap"],
  ["GET", "/places"],
  ["POST", "/flights/search"],
  ["GET", "/flights/offers/{id}"],
  ["POST", "/hotels/search"],
  ["POST", "/hotels/rates/{id}"],
  ["POST", "/hotels/quotes"],
  ["GET", "/hotels/quotes/{id}"],
  ["GET", "/bookings"],
  ["POST", "/bookings"],
  ["GET", "/bookings/{id}"],
  ["POST", "/bookings/{id}/pay"],
  ["POST", "/bookings/{id}/complete"],
  ["POST", "/bookings/{id}/refresh"],
  ["GET", "/bookings/{id}/timeline"],
  ["POST", "/bookings/{id}/service-request"],
  ["GET", "/updates"],
  ["POST", "/updates/{id}/read"],
  ["POST", "/updates/read-all"],
] as const;

const paths = MOBILE_OTA_OPERATIONS.map(([method, path]) => ({
  method,
  pattern: new RegExp(`^${path.replace(/\{id\}/g, "[^/]+")}$`),
}));
export function mobileMethods(path: string) {
  const methods: string[] = paths
    .filter((item) => item.pattern.test(path))
    .map((item) => item.method);
  if (methods.includes("GET")) methods.push("HEAD");
  return methods;
}
