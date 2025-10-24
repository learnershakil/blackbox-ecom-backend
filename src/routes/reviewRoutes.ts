import { Router, IRouter } from "express";
import {
  createReview,
  updateReview,
  deleteReview,
  getProductReviews,
  getUserReviews,
  getReview,
  markReviewHelpful,
  getAllReviews,
  moderateReview,
  deleteReviewImage,
} from "../controllers/reviewController";
import { authenticate, authorize } from "../middlewares/auth";

const router: IRouter = Router();

// Public routes
router.get("/product/:productId", getProductReviews);

// User routes (require authentication)
router.use(authenticate);

router.post("/", createReview);
router.get("/my-reviews", getUserReviews);
router.get("/:id", getReview);
router.patch("/:id", updateReview);
router.delete("/:id", deleteReview);
router.post("/:id/helpful", markReviewHelpful);
router.delete("/:id/images/:imageId", deleteReviewImage);

// Admin routes
router.use(authorize("admin"));

router.get("/", getAllReviews);
router.patch("/:id/moderate", moderateReview);

export default router;
