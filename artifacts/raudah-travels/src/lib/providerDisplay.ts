// Admin-facing prose only. Keep real URLs, configuration fields and API
// identifiers intact so copied integration details continue to work.
export function providerDisplay(text: string | null | undefined): string {
  return (text || "").replace(/https?:\/\/[^\s]+|\bDuffel\b/g, (value) =>
    value === "Duffel" ? "Api Provider" : value,
  );
}
