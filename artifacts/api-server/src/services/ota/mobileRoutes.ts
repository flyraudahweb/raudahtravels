import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import type { ErrorRequestHandler } from "express";
import { mobileMethods } from "./mobileApiPaths";

// Freeze a customer-only v1 surface. Admin and supplier callback routes stay on
// their existing operator/provider URLs and are never exposed through this alias.
export function mobileOtaRouter(ota: ExpressRouter) {
  const router = Router();
  router.use((req, res, next) => {
    const path = req.path.replace(/\/+$/, "") || "/";
    const methods = mobileMethods(path);
    res.setHeader("Cache-Control", "no-store");
    if (!methods.length) {
      res.status(404).json({ error: "OTA v1 endpoint not found" });
      return;
    }
    if (!methods.includes(req.method)) {
      res.setHeader("Allow", methods.join(", "));
      res
        .status(405)
        .json({ error: "Method not allowed for this OTA endpoint" });
      return;
    }
    const original = req.url;
    req.url = `/ota${path}${original.includes("?") ? original.slice(original.indexOf("?")) : ""}`;
    ota(req, res, (error) => {
      req.url = original;
      if (error) next(error);
      else res.status(404).json({ error: "OTA v1 endpoint not found" });
    });
  });
  return router;
}

// Also catches errors raised before the router (JSON parsing/oversized bodies).
export const mobileOtaError: ErrorRequestHandler = (error, req, res, next) => {
  if (!/^\/api\/ota\/v1(?:\/|\?|$)/.test(req.originalUrl)) return next(error);
  if (res.headersSent) return next(error);
  const status =
    error instanceof URIError
      ? 400
      : [400, 413, 415].includes(error?.status)
        ? error.status
        : 503;
  res.setHeader("Cache-Control", "no-store");
  res
    .status(status)
    .json({
      error:
        status === 413
          ? "Request body is too large"
          : status === 415
            ? "Unsupported request encoding"
            : status === 400
              ? "Malformed request. Check JSON and URL encoding."
              : "Travel services are temporarily unavailable. Please try again later.",
    });
};
