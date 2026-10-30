export function searchKeyScope(
  method: string,
  path: string,
): string | undefined {
  path = path.replace(/\/+$/, "") || "/";
  if (method === "HEAD") method = "GET";
  if (
    method === "GET" &&
    ["/config", "/exchange-rates", "/capabilities"].includes(path)
  )
    return "config:read";
  if (
    (method === "GET" &&
      (path === "/places" ||
        /^\/flights\/offers\/off_[A-Za-z0-9]+$/.test(path))) ||
    (method === "POST" && path === "/flights/search")
  )
    return "flights:read";
  if (
    method === "POST" &&
    (path === "/hotels/search" ||
      /^\/hotels\/rates\/srr_[A-Za-z0-9]+$/.test(path))
  )
    return "hotels:read";
  return undefined;
}
