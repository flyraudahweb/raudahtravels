// Hosted payment callbacks require a complete HTTPS origin. Reject credentials,
// query strings and paths instead of accepting any value starting with https:.
export function otaAppOrigin(value = process.env.APP_URL || ""): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
