import { Request, Response, NextFunction } from "express";
import { Cart, Product } from "../models";
import { Types } from "mongoose";

// Get user's cart
export const getCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    let cart = await Cart.findOne({ user: userId }).populate({
      path: "items.product",
      select: "name slug images basePrice discountPrice totalStock isActive",
      populate: {
        path: "category",
        select: "name slug",
      },
    });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
      await cart.save();
    }

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// Add item to cart
export const addToCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { productId, quantity = 1, variant = {} } = req.body;

    // Validate product
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product not found or inactive",
      });
    }

    // Check stock availability
    if (product.totalStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.totalStock} items available in stock`,
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Add item using the cart methods
    try {
      await (cart as any).addItem(
        productId,
        quantity,
        variant,
        product.basePrice
      );
    } catch (error) {
      // Fallback to manual addition if method doesn't work
      cart.items.push({
        product: productId,
        quantity,
        variant,
        price: product.basePrice,
      });
      await cart.save();
    }

    // Populate the cart before sending response
    await cart.populate({
      path: "items.product",
      select: "name slug images basePrice discountPrice totalStock isActive",
      populate: {
        path: "category",
        select: "name slug",
      },
    });

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// Update cart item quantity
export const updateCartItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;
    const { quantity, variant = {} } = req.body;

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Get product and check stock
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product not found or inactive",
      });
    }

    if (quantity > product.totalStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.totalStock} items available in stock`,
      });
    }

    // Update item using the cart methods
    try {
      await (cart as any).updateItemQuantity(productId, quantity, variant);
    } catch (error) {
      // Fallback to manual update if method doesn't work
      const itemIndex = cart.items.findIndex(
        (item: any) =>
          item.product.toString() === productId &&
          JSON.stringify(item.variant) === JSON.stringify(variant)
      );

      if (itemIndex > -1) {
        if (quantity <= 0) {
          cart.items.splice(itemIndex, 1);
        } else {
          cart.items[itemIndex].quantity = Math.min(quantity, 10);
        }
        await cart.save();
      } else {
        throw new Error("Item not found in cart");
      }
    }

    // Populate the cart before sending response
    await cart.populate({
      path: "items.product",
      select: "name slug images basePrice discountPrice totalStock isActive",
      populate: {
        path: "category",
        select: "name slug",
      },
    });

    res.status(200).json({
      success: true,
      message: "Cart item updated successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// Remove item from cart
export const removeFromCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;
    const { variant } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find the item index
    let itemIndex = -1;

    if (variant) {
      // If variant is provided, find exact match
      itemIndex = cart.items.findIndex(
        (item: any) =>
          item.product.toString() === productId &&
          JSON.stringify(item.variant) === JSON.stringify(variant)
      );
    } else {
      // If no variant provided, find first item with this product ID
      itemIndex = cart.items.findIndex(
        (item: any) => item.product.toString() === productId
      );
    }

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    // Remove the item
    cart.items.splice(itemIndex, 1);
    await cart.save();

    // Populate the cart before sending response
    await cart.populate({
      path: "items.product",
      select: "name slug images basePrice discountPrice totalStock isActive",
      populate: {
        path: "category",
        select: "name slug",
      },
    });

    res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// Clear entire cart
export const clearCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Clear cart using the cart methods
    try {
      await (cart as any).clearCart();
    } catch (error) {
      // Fallback to manual clearing if method doesn't work
      cart.items = [];
      await cart.save();
    }

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// Get cart item count
export const getCartItemCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    const cart = await Cart.findOne({ user: userId });
    const itemCount = cart ? cart.totalItems : 0;

    res.status(200).json({
      success: true,
      data: { itemCount },
    });
  } catch (error) {
    next(error);
  }
};

// Get cart summary
export const getCartSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    const cart = await Cart.findOne({ user: userId });
    const summary = cart
      ? (cart as any).getSummary()
      : {
          totalItems: 0,
          totalAmount: 0,
          itemsCount: 0,
          isEmpty: true,
        };

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};
