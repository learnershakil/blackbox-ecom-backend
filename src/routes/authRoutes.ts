import { Router, IRouter } from "express";
import {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
} from "../controllers/authController";
import { authenticate } from "../middlewares/auth";

const router: IRouter = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Protected routes
router.use(authenticate);
router.post("/logout", logout);
router.get("/profile", getProfile);
router.get("/me", getProfile); // Add alias for /me endpoint
router.patch("/profile", updateProfile);
router.patch("/change-password", changePassword);

export default router;
