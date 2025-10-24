import { Router, IRouter } from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary,
  getCartItemCount,
} from "../controllers/cartController";
import { authenticate } from "../middlewares/auth";

const router: IRouter = Router();

// All cart routes require authentication
router.use(authenticate);

router.get("/", getCart);
router.get("/summary", getCartSummary);
router.get("/count", getCartItemCount);
router.post("/add", addToCart);
router.patch("/update/:productId", updateCartItem);
router.delete("/remove/:productId", removeFromCart);
router.delete("/clear", clearCart);

export default router;
