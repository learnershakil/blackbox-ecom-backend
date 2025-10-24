import { Router, IRouter } from "express";
import {
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryTree,
  reorderCategories,
  getCategoriesWithProductCount,
} from "../controllers/categoryController";
import { authenticate, authorize } from "../middlewares/auth";

const router: IRouter = Router();

// Public routes
router.get("/", getAllCategories);
router.get("/tree", getCategoryTree);
router.get("/with-product-count", getCategoriesWithProductCount);
router.get("/:id", getCategory);

// Protected admin routes
router.use(authenticate);
router.use(authorize("admin"));

router.patch("/reorder", reorderCategories);

router.post("/", createCategory);
router.patch("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
