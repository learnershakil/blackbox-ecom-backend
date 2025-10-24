import { Router, IRouter } from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  checkWishlistItem,
  getWishlistCount,
  moveToCart,
  getWishlistPaginated,
} from "../controllers/wishlistController";
import { authenticate } from "../middlewares/auth";

const router: IRouter = Router();

// All wishlist routes require authentication
router.use(authenticate);

router.get("/", getWishlist);
router.get("/paginated", getWishlistPaginated);
router.get("/count", getWishlistCount);
router.get("/check/:productId", checkWishlistItem);
router.post("/add", addToWishlist);
router.delete("/remove/:productId", removeFromWishlist);
router.delete("/clear", clearWishlist);
router.post("/move-to-cart", moveToCart);

export default router;
