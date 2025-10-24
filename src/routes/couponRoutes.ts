import { Router, IRouter } from "express";
import {
  getAllCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  toggleCouponStatus,
  getCouponStats,
  getActiveCoupons,
} from "../controllers/couponController";
import { authenticate, authorize } from "../middlewares/auth";

const router: IRouter = Router();

// Public routes
router.get("/active", getActiveCoupons);

// User routes (require authentication)
router.use(authenticate);

router.post("/validate", validateCoupon);

// Admin routes
router.use(authorize("admin"));

router.get("/", getAllCoupons);
router.get("/:id", getCoupon);
router.post("/", createCoupon);
router.patch("/:id", updateCoupon);
router.delete("/:id", deleteCoupon);
router.patch("/:id/toggle-status", toggleCouponStatus);
router.get("/:id/stats", getCouponStats);

export default router;
