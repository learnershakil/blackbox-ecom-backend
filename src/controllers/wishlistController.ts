import { Response } from "express";
import { Wishlist, Product } from "../models";
import { AuthenticatedRequest } from "../types/express";

// Get user's wishlist
export const getWishlist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: "products",
      select: "name slug price discountPrice images stock isActive category",
      populate: {
        path: "category",
        select: "name slug",
      },
    });

    if (!wishlist) {
      return res.json({
        success: true,
        data: {
          products: [],
          totalItems: 0,
        },
      });
    }

    // Filter out inactive products or products that don't exist
    const activeProducts = wishlist.products.filter(
      (product) => product && (product as any).isActive
    );

    res.json({
      success: true,
      data: {
        products: activeProducts,
        totalItems: activeProducts.length,
      },
    });
  } catch (error) {
    console.error("Get wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get wishlist",
    });
  }
};

// Add item to wishlist
export const addToWishlist = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Check if product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      // Create new wishlist
      wishlist = new Wishlist({
        user: userId,
        products: [productId],
      });
    } else {
      // Check if product already in wishlist
      const existingProduct = wishlist.products.find(
        (productObjectId) => productObjectId.toString() === productId
      );

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "Product already in wishlist",
        });
      }

      // Add product to wishlist
      wishlist.products.push(productId);
    }

    await wishlist.save();

    // Populate the new wishlist
    await wishlist.populate({
      path: "products",
      select: "name slug price discountPrice images stock isActive category",
      populate: {
        path: "category",
        select: "name slug",
      },
    });

    res.status(201).json({
      success: true,
      message: "Product added to wishlist successfully",
      data: { wishlist },
    });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist",
    });
  }
};

// Remove item from wishlist
export const removeFromWishlist = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    // Find product index
    const productIndex = wishlist.products.findIndex(
      (productObjectId) => productObjectId.toString() === productId
    );

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    // Remove product
    wishlist.products.splice(productIndex, 1);
    await wishlist.save();

    // Populate the updated wishlist
    await wishlist.populate({
      path: "products",
      select: "name slug price discountPrice images stock isActive category",
      populate: {
        path: "category",
        select: "name slug",
      },
    });

    res.json({
      success: true,
      message: "Product removed from wishlist successfully",
      data: { wishlist },
    });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove product from wishlist",
    });
  }
};

// Clear entire wishlist
export const clearWishlist = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    wishlist.products = [];
    await wishlist.save();

    res.json({
      success: true,
      message: "Wishlist cleared successfully",
      data: { wishlist },
    });
  } catch (error) {
    console.error("Clear wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear wishlist",
    });
  }
};

// Check if product is in wishlist
export const checkWishlistItem = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.json({
        success: true,
        data: { inWishlist: false },
      });
    }

    const inWishlist = wishlist.products.some(
      (productObjectId) => productObjectId.toString() === productId
    );

    res.json({
      success: true,
      data: { inWishlist },
    });
  } catch (error) {
    console.error("Check wishlist item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check wishlist item",
    });
  }
};

// Get wishlist item count
export const getWishlistCount = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ user: userId });

    const count = wishlist ? wishlist.products.length : 0;

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error("Get wishlist count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get wishlist count",
    });
  }
};

// Move item from wishlist to cart
export const moveToCart = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;
    const { quantity = 1, variant } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Check if product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    // Check stock
    if ((product as any).stock < quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock",
      });
    }

    // Import Cart model here to avoid circular dependency
    const { Cart } = require("../models");

    // Add to cart
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
      });
    }

    // Check if item already in cart
    const existingItemIndex = cart.items.findIndex((item: any) => {
      if (item.product.toString() !== productId) return false;

      // Check variant match
      if (variant && item.variant) {
        return JSON.stringify(item.variant) === JSON.stringify(variant);
      }

      return !variant && !item.variant;
    });

    const itemPrice = (product as any).discountPrice || (product as any).price;

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].price = itemPrice;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        variant,
        price: itemPrice,
      });
    }

    await cart.save();

    // Remove from wishlist
    const wishlist = await Wishlist.findOne({ user: userId });
    if (wishlist) {
      const productIndex = wishlist.products.findIndex(
        (productObjectId) => productObjectId.toString() === productId
      );

      if (productIndex > -1) {
        wishlist.products.splice(productIndex, 1);
        await wishlist.save();
      }
    }

    res.json({
      success: true,
      message: "Product moved to cart successfully",
    });
  } catch (error) {
    console.error("Move to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move product to cart",
    });
  }
};

// Get wishlist with pagination (for large wishlists)
export const getWishlistPaginated = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.json({
        success: true,
        data: {
          products: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      });
    }

    const totalItems = wishlist.products.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // Get paginated product IDs
    const paginatedProductIds = wishlist.products.slice(startIndex, endIndex);

    // Populate only the paginated products
    const products = await Product.find({
      _id: { $in: paginatedProductIds },
      isActive: true,
    })
      .populate("category", "name slug")
      .select("name slug price discountPrice images stock isActive category");

    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get wishlist paginated error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get wishlist",
    });
  }
};
