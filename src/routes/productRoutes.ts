import { Router, IRouter } from "express";
import {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  getFeaturedProducts,
  getRelatedProducts,
  updateProductStock,
  deleteProductImage,
} from "../controllers/productController";
import { authenticate, authorize } from "../middlewares/auth";

const router: IRouter = Router();

// Public routes
router.get("/", getAllProducts);
router.get("/search", searchProducts);
router.get("/featured", getFeaturedProducts);
router.get("/slug/:slug", getProduct); // Move slug route before auth middleware
router.get("/:id", getProduct);
router.get("/:id/related", getRelatedProducts);

// Protected admin routes
router.use(authenticate);
router.use(authorize("admin"));

router.post("/", createProduct);
router.patch("/:id", updateProduct);
router.put("/:id", updateProduct); // Add PUT alias for PATCH
router.delete("/:id", deleteProduct);
router.patch("/:id/stock", updateProductStock);
router.delete("/:id/images/:imageId", deleteProductImage);

export default router;
