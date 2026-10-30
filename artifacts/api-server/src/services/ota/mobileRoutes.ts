import { Router } from "express";
import type { Router as ExpressRouter } from "express";

// Freeze a customer-only v1 surface. Admin and supplier callback routes stay on
// their existing operator/provider URLs and are never exposed through this alias.
export function mobileOtaRouter(ota: ExpressRouter) {
  const router = Router();
  router.use((req, res, next) => {
    const publicPath =
      /^\/(?:config|capabilities|exchange-rates|places|me(?:\/bootstrap)?|flights\/search|flights\/offers\/off_[A-Za-z0-9]+|hotels\/search|hotels\/rates\/srr_[A-Za-z0-9]+|hotels\/quotes(?:\/quo_[A-Za-z0-9]+)?|bookings(?:\/[A-Za-z0-9-]+(?:\/(?:pay|complete|refresh|timeline|service-request))?)?|updates(?:\/read-all|\/[^/]+\/read)?)\/?$/;
    if (!publicPath.test(req.path)) {
      res.status(404).json({ error: "OTA v1 endpoint not found" });
      return;
    }
    const original = req.url;
    req.url = `/ota${req.url}`;
    ota(req, res, (error) => {
      req.url = original;
      if (error) next(error);
      else res.status(404).json({ error: "OTA v1 endpoint not found" });
    });
  });
  return router;
}
