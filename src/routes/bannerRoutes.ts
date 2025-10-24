import { Router, IRouter } from "express";
import {
  getAllBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
  getActiveBanners,
  getBannerAnalytics,
  reorderBanners,
  toggleBannerStatus,
  getBannersByPosition,
  bulkUpdateBannerStatus,
} from "../controllers/bannerController";
import { authenticate, authorize } from "../middlewares/auth";

const router: IRouter = Router();

// Public routes
router.get("/active", getActiveBanners);
router.get("/position/:position", getBannersByPosition);

// Admin routes
router.use(authenticate);
router.use(authorize("admin"));

router.get("/", getAllBanners);
router.get("/:id", getBanner);
router.post("/", createBanner);
router.patch("/:id", updateBanner);
router.delete("/:id", deleteBanner);
router.get("/:id/analytics", getBannerAnalytics);
router.patch("/reorder", reorderBanners);
router.patch("/:id/toggle-status", toggleBannerStatus);
router.patch("/bulk-status", bulkUpdateBannerStatus);

export default router;
