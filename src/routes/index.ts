import { Router, IRouter } from "express";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import productRoutes from "./productRoutes";
import categoryRoutes from "./categoryRoutes";
import cartRoutes from "./cartRoutes";
import orderRoutes from "./orderRoutes";
import reviewRoutes from "./reviewRoutes";
import couponRoutes from "./couponRoutes";
import bannerRoutes from "./bannerRoutes";
import adminRoutes from "./adminRoutes";
import wishlistRoutes from "./wishlistRoutes";

const router: IRouter = Router();

// Route prefixes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/reviews", reviewRoutes);
router.use("/coupons", couponRoutes);
router.use("/banners", bannerRoutes);
router.use("/admin", adminRoutes);
router.use("/wishlist", wishlistRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
