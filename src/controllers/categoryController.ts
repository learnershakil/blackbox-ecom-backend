import { Request, Response, NextFunction } from "express";
import { Category } from "../models";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { Types } from "mongoose";

// Get all categories
export const getAllCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter: any = {};

    if (req.query.status) {
      filter.isActive = req.query.status === "active";
    }

    if (req.query.parent === "null") {
      filter.parentCategory = null; // Root categories only
    } else if (req.query.parent) {
      filter.parentCategory = req.query.parent;
    }

    const categories = await Category.find(filter)
      .populate("parentCategory", "name slug")
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Category.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        categories,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCategories: total,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get category tree (hierarchical structure)
export const getCategoryTree = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await Category.find({ isActive: true })
      .populate("parentCategory", "name slug")
      .sort({ order: 1, name: 1 })
      .lean();

    // Build tree structure
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    // First pass: create map of all categories
    categories.forEach((category) => {
      categoryMap.set(category._id.toString(), {
        ...category,
        children: [],
      });
    });

    // Second pass: build tree structure
    categories.forEach((category) => {
      if (category.parentCategory) {
        const parent = categoryMap.get(category.parentCategory._id?.toString());
        if (parent) {
          parent.children.push(categoryMap.get(category._id.toString()));
        }
      } else {
        rootCategories.push(categoryMap.get(category._id.toString()));
      }
    });

    res.status(200).json({
      success: true,
      data: rootCategories,
    });
  } catch (error) {
    next(error);
  }
};

// Get single category by ID or slug
export const getCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // Check if it's a valid ObjectId or treat as slug
    let category;
    if (Types.ObjectId.isValid(id)) {
      category = await Category.findById(id).populate(
        "parentCategory",
        "name slug"
      );
    } else {
      category = await Category.findOne({ slug: id }).populate(
        "parentCategory",
        "name slug"
      );
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Get subcategories
    const subcategories = await Category.find({
      parentCategory: category._id,
      isActive: true,
    })
      .sort({ order: 1, name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        subcategories,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create new category (Admin only)
export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      name,
      slug,
      description,
      parent,
      parentCategory,
      order,
      metaTitle,
      metaDescription,
      isActive,
    } = req.body;

    // Use parentCategory if provided, otherwise fall back to parent
    const parentId = parentCategory || parent;

    // Check if parent category exists
    if (parentId) {
      const parentCategoryDoc = await Category.findById(parentId);
      if (!parentCategoryDoc) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    // Handle image upload
    let image: { public_id: string; url: string } | undefined;
    if (req.file) {
      image = await uploadToCloudinary(
        req.file,
        "blackbox-commerce/categories"
      );
    }

    const category = new Category({
      name,
      slug,
      description,
      parentCategory: parentId || null,
      image,
      order: order || 0,
      metaTitle,
      metaDescription,
      isActive: isActive !== false, // Default to true
    });

    await category.save();

    const populatedCategory = await Category.findById(category._id).populate(
      "parentCategory",
      "name slug"
    );

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: populatedCategory,
    });
  } catch (error) {
    next(error);
  }
};

// Update category (Admin only)
export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if trying to set itself as parent
    if (updateData.parent && updateData.parent === id) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be its own parent",
      });
    }

    // Check if parent exists
    if (updateData.parent) {
      const parentCategory = await Category.findById(updateData.parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }

      // Check for circular dependency
      const isCircular = await checkCircularDependency(updateData.parent, id);
      if (isCircular) {
        return res.status(400).json({
          success: false,
          message: "Circular dependency detected. Cannot set this parent.",
        });
      }
    }

    // Handle new image upload
    if (req.file) {
      // Delete old image if exists
      if (category.image?.public_id) {
        await deleteFromCloudinary(category.image.public_id);
      }

      updateData.image = await uploadToCloudinary(
        req.file,
        "blackbox-commerce/categories"
      );
    }

    // Map parent to parentCategory for the database
    if (updateData.parent !== undefined) {
      updateData.parentCategory = updateData.parent;
      delete updateData.parent;
    }

    const updatedCategory = await Category.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("parentCategory", "name slug");

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    next(error);
  }
};

// Delete category (Admin only)
export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category has subcategories
    const subcategories = await Category.countDocuments({ parentCategory: id });
    if (subcategories > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with subcategories. Delete subcategories first.",
      });
    }

    // Check if category has products
    const { Product } = await import("../models");
    const products = await Product.countDocuments({ category: id });
    if (products > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with products. Move products to another category first.",
      });
    }

    // Delete image from Cloudinary
    if (category.image?.public_id) {
      await deleteFromCloudinary(category.image.public_id);
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get categories with product count
export const getCategoriesWithProductCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await Category.aggregate([
      {
        $match: { isActive: true },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products",
        },
      },
      {
        $addFields: {
          productCount: { $size: "$products" },
        },
      },
      {
        $project: {
          products: 0, // Remove the products array, keep only the count
        },
      },
      {
        $sort: { order: 1, name: 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

// Reorder categories (Admin only)
export const reorderCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { categoryOrders } = req.body; // Array of { id, order }

    if (!Array.isArray(categoryOrders)) {
      return res.status(400).json({
        success: false,
        message: "categoryOrders must be an array",
      });
    }

    const updatePromises = categoryOrders.map(({ id, order }) =>
      Category.findByIdAndUpdate(id, { order })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Categories reordered successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to check circular dependency
async function checkCircularDependency(
  parentId: string,
  childId: string
): Promise<boolean> {
  let currentParent = parentId;

  while (currentParent) {
    if (currentParent === childId) {
      return true; // Circular dependency found
    }

    const parent = await Category.findById(currentParent);
    currentParent = parent?.parentCategory?.toString();
  }

  return false; // No circular dependency
}
