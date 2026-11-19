// Admin-facing prose only. Keep real URLs, configuration fields and API
// identifiers intact so copied integration details continue to work.
export function providerDisplay(
  text: string | null | undefined,
  useInitials = false,
): string {
  return (text || "").replace(
    /https?:\/\/[^\s]+|\b(?:Duffel|Nuitee|Bilalsadasub|Bilalsada)\b/gi,
    (value) => {
      const name = value.toLowerCase();
      if (value === "Duffel") return "Api Provider";
      if (useInitials && name === "nuitee") return "N";
      if (useInitials && (name === "bilalsadasub" || name === "bilalsada"))
        return "B";
      return value;
    },
  );
}
