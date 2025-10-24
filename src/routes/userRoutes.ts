import { Router, IRouter } from "express";
import {
  // Profile management
  getProfile,
  updateProfile,
  changePassword,

  // Address management
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress,

  // Admin functions
  getAllUsers,
  getUserById,
} from "../controllers/userController";
import { authenticate, adminOnly } from "../middlewares/auth";

const router: IRouter = Router();

// Profile routes (require authentication)
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);
router.put("/change-password", authenticate, changePassword);

// Address management routes (require authentication)
router.get("/addresses", authenticate, getAddresses);
router.get("/addresses/default", authenticate, getDefaultAddress);
router.post("/addresses", authenticate, addAddress);
router.patch("/addresses/:addressId", authenticate, updateAddress);
router.delete("/addresses/:addressId", authenticate, deleteAddress);
router.patch("/addresses/:addressId/default", authenticate, setDefaultAddress);

// Admin routes (require admin authentication)
router.get("/", authenticate, adminOnly, getAllUsers);
router.get("/:id", authenticate, adminOnly, getUserById);

export default router;
