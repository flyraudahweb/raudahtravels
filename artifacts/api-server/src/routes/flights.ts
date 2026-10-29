import { Router } from "express";
const router = Router();
router.use((_req, res) => {
  res
    .status(410)
    .json({
      error: "Travel API replaced by /api/ota. Refresh the application.",
    });
});
export default router;
