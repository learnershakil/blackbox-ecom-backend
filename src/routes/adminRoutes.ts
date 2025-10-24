import { Router, IRouter } from "express";
import {
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getSalesReport,
  getProductReport,
  getUserReport,
} from "../controllers/adminController";
import { authenticate, authorize } from "../middlewares/auth";

const router: IRouter = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize("admin"));

// Dashboard
router.get("/dashboard/stats", getDashboardStats);

// User management
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/status", updateUserStatus);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

// Reports
router.get("/reports/sales", getSalesReport);
router.get("/reports/products", getProductReport);
router.get("/reports/users", getUserReport);

export default router;
