import { Router, IRouter } from "express";
import {
  createOrder,
  getUserOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  getAllOrders,
  getOrderStats,
} from "../controllers/orderController";
import { authenticate, authorize } from "../middlewares/auth";

const router: IRouter = Router();

// User routes (require authentication)
router.use(authenticate);

router.post("/", createOrder);
router.get("/my-orders", getUserOrders);
router.get("/:id", getOrder);
router.patch("/:id/cancel", cancelOrder);

// Admin routes
router.use(authorize("admin"));

router.get("/", getAllOrders);
router.get("/statistics/overview", getOrderStats);
router.patch("/:id/status", updateOrderStatus);

export default router;
