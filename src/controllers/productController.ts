import { Request, Response, NextFunction } from "express";
import { Product, Category } from "../models";
import { v2 as cloudinary } from "cloudinary";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { Types } from "mongoose";

// Get all products with filtering, sorting, and pagination
export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter: any = {};

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.minPrice || req.query.maxPrice) {
      filter.basePrice = {};
      if (req.query.minPrice)
        filter.basePrice.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice)
        filter.basePrice.$lte = Number(req.query.maxPrice);
    }

    if (req.query.inStock === "true") {
      filter.totalStock = { $gt: 0 };
    }

    if (req.query.featured === "true") {
      filter.isFeatured = true;
    }

    if (req.query.bestseller === "true") {
      filter.isBestSeller = true;
    }

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
        { tags: { $in: [new RegExp(req.query.search as string, "i")] } },
      ];
    }

    // Build sort object
    let sort: any = {};
    if (req.query.sort) {
      const sortField = req.query.sort as string;
      if (sortField.startsWith("-")) {
        // Descending sort (e.g., "-price")
        const field = sortField.substring(1);
        sort[field === "price" ? "basePrice" : field] = -1;
      } else {
        // Ascending sort (e.g., "price")
        sort[sortField === "price" ? "basePrice" : sortField] = 1;
      }
    } else if (req.query.sortBy) {
      const sortBy = req.query.sortBy as string;
      const order = req.query.order === "desc" ? -1 : 1;
      sort[sortBy] = order;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalProducts: total,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single product by ID or slug
export const getProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, slug } = req.params;
    const identifier = slug || id;

    // If we're in the ID route (not slug route), validate ObjectId format
    if (id && !slug && !Types.ObjectId.isValid(identifier)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    // Check if it's a valid ObjectId or treat as slug
    let product;
    if (Types.ObjectId.isValid(identifier)) {
      product = await Product.findById(identifier)
        .populate("category", "name slug")
        .populate("reviews", "rating comment user createdAt", null, {
          sort: { createdAt: -1 },
          limit: 10,
        });
    } else {
      product = await Product.findOne({ slug: identifier })
        .populate("category", "name slug")
        .populate("reviews", "rating comment user createdAt", null, {
          sort: { createdAt: -1 },
          limit: 10,
        });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Increment view count
    await Product.findByIdAndUpdate(product._id, { $inc: { views: 1 } });

    res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create new product (Admin only)
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      name,
      slug,
      description,
      shortDescription,
      basePrice,
      discountPrice,
      category,
      subcategory,
      brand,
      tags,
      variants,
      specifications,
      isFeatured,
      isBestSeller,
      isActive,
      seoTitle,
      seoDescription,
      // Legacy fields for backward compatibility
      price,
      comparePrice,
      featured,
      status,
    } = req.body;

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Category not found",
      });
    }

    // Handle image uploads from files or JSON body
    let images: { public_id: string; url: string }[] = [];

    // If images are uploaded as files
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(
          file,
          "blackbox-commerce/products"
        );
        images.push(result);
      }
    }
    // If images are provided in JSON body
    else if (req.body.images && Array.isArray(req.body.images)) {
      images = req.body.images;
    }

    const product = new Product({
      name,
      slug,
      description,
      shortDescription,
      category,
      subcategory,
      brand,
      images,
      variants: variants || [],
      basePrice: basePrice || price, // Support both field names
      discountPrice: discountPrice || comparePrice, // Support both field names
      specifications: specifications || {},
      tags: tags
        ? Array.isArray(tags)
          ? tags
          : tags.split(",").map((tag: string) => tag.trim())
        : [],
      isFeatured:
        isFeatured !== undefined
          ? isFeatured
          : featured === "true" || featured === true,
      isBestSeller: isBestSeller || false,
      isActive: isActive !== undefined ? isActive : status !== "inactive",
      seoTitle,
      seoDescription,
    });

    await product.save();

    const populatedProduct = await Product.findById(product._id).populate(
      "category",
      "name slug"
    );

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        product: populatedProduct,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update product (Admin only)
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Handle category update
    if (updateData.category) {
      const categoryExists = await Category.findById(updateData.category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Handle new image uploads
    if (req.files && Array.isArray(req.files)) {
      const newImages: { public_id: string; url: string }[] = [];
      for (const file of req.files) {
        const result = await uploadToCloudinary(
          file,
          "blackbox-commerce/products"
        );
        newImages.push(result);
      }
      updateData.images = [...(product.images || []), ...newImages];
    }

    // Parse JSON fields if they exist
    if (updateData.tags && typeof updateData.tags === "string") {
      updateData.tags = updateData.tags
        .split(",")
        .map((tag: string) => tag.trim());
    }
    // If tags is already an array, keep it as is
    if (updateData.variants && typeof updateData.variants === "string") {
      updateData.variants = JSON.parse(updateData.variants);
    }
    if (
      updateData.specifications &&
      typeof updateData.specifications === "string"
    ) {
      updateData.specifications = JSON.parse(updateData.specifications);
    }
    if (updateData.dimensions && typeof updateData.dimensions === "string") {
      updateData.dimensions = JSON.parse(updateData.dimensions);
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("category", "name slug");

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: {
        product: updatedProduct,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete product (Admin only)
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        await deleteFromCloudinary(image.public_id);
      }
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Delete product image (Admin only)
export const deleteProductImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { imageId } = req.body; // public_id of the image

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const imageIndex = product.images?.findIndex(
      (img) => img.public_id === imageId
    );
    if (imageIndex === -1 || imageIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "Image not found in product",
      });
    }

    // Remove image from Cloudinary
    await deleteFromCloudinary(imageId);

    // Remove image from product
    product.images = product.images.filter((img) => img.public_id !== imageId);
    await product.save();

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Get featured products
export const getFeaturedProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const limit = parseInt(req.query.limit as string) || 8;

    const products = await Product.find({ isFeatured: true, isActive: true })
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// Get related products
export const getRelatedProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 6;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const relatedProducts = await Product.find({
      _id: { $ne: id },
      $or: [{ category: product.category }, { tags: { $in: product.tags } }],
      isActive: true,
    })
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: relatedProducts,
    });
  } catch (error) {
    next(error);
  }
};

// Search products
export const searchProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const searchRegex = new RegExp(q as string, "i");

    const products = await Product.find({
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } },
      ],
      isActive: true,
    })
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments({
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } },
      ],
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalProducts: total,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update product stock (Admin only)
export const updateProductStock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { stock, operation = "set", variantId } = req.body; // Default operation to "set"

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // If variantId is provided, update specific variant stock
    if (variantId) {
      const variantIndex = product.variants.findIndex(
        (variant: any) => variant._id?.toString() === variantId
      );

      if (variantIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Variant not found",
        });
      }

      let newVariantStock = product.variants[variantIndex].stock;

      switch (operation) {
        case "set":
          newVariantStock = stock;
          break;
        case "add":
          newVariantStock = product.variants[variantIndex].stock + stock;
          break;
        case "subtract":
          newVariantStock = Math.max(
            0,
            product.variants[variantIndex].stock - stock
          );
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid operation. Use "set", "add", or "subtract"',
          });
      }

      // Update the variant stock
      product.variants[variantIndex].stock = newVariantStock;

      // Recalculate total stock from all variants
      product.totalStock = product.variants.reduce(
        (total, variant) => total + variant.stock,
        0
      );

      await product.save();

      return res.status(200).json({
        success: true,
        message: "Variant stock updated successfully",
        data: {
          variantId,
          variantStock: newVariantStock,
          totalStock: product.totalStock,
        },
      });
    }

    // Update total product stock if no variantId provided
    let newStock = product.totalStock;

    switch (operation) {
      case "set":
        newStock = stock;
        break;
      case "add":
        newStock = product.totalStock + stock;
        break;
      case "subtract":
        newStock = Math.max(0, product.totalStock - stock);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid operation. Use "set", "add", or "subtract"',
        });
    }

    product.totalStock = newStock;
    await product.save();

    res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      data: { totalStock: newStock },
    });
  } catch (error) {
    next(error);
  }
};
