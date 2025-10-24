import { z } from "zod";
import { Request, Response, NextFunction } from "express";

// Common validation schemas
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format");
const emailSchema = z.string().email("Invalid email format");
const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s-()]+$/, "Invalid phone number format");
const urlSchema = z.string().url("Invalid URL format");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

// User validation schemas
export const registerSchema = z.object({
  body: z
    .object({
      firstName: z
        .string()
        .min(2, "First name must be at least 2 characters")
        .max(50),
      lastName: z
        .string()
        .min(2, "Last name must be at least 2 characters")
        .max(50),
      email: emailSchema,
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, "Password is required"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const resetPasswordSchema = z.object({
  body: z
    .object({
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }),
  params: z.object({
    token: z.string().min(1, "Reset token is required"),
  }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    phone: phoneSchema.optional(),
    dateOfBirth: z.string().optional(),
  }),
});

// Address validation schemas
export const addressSchema = z.object({
  body: z.object({
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(100),
    phoneNumber: phoneSchema,
    addressLine1: z
      .string()
      .min(5, "Address line 1 must be at least 5 characters")
      .max(200),
    addressLine2: z.string().max(200).optional(),
    city: z.string().min(2, "City must be at least 2 characters").max(100),
    state: z.string().min(2, "State must be at least 2 characters").max(100),
    postalCode: z
      .string()
      .min(4, "Postal code must be at least 4 characters")
      .max(20),
    country: z
      .string()
      .min(2, "Country must be at least 2 characters")
      .max(100),
    isDefault: z.boolean().optional(),
  }),
});

// Product validation schemas
export const createProductSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Product name must be at least 2 characters")
      .max(200),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters"),
    shortDescription: z.string().max(500).optional(),
    price: z.number().min(0.01, "Price must be greater than 0"),
    discountPrice: z.number().min(0).optional(),
    sku: z.string().min(1, "SKU is required").max(100),
    stock: z.number().int().min(0, "Stock cannot be negative"),
    category: objectIdSchema,
    brand: z.string().max(100).optional(),
    weight: z.number().min(0).optional(),
    dimensions: z
      .object({
        length: z.number().min(0),
        width: z.number().min(0),
        height: z.number().min(0),
      })
      .optional(),
    tags: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    seoTitle: z.string().max(150).optional(),
    seoDescription: z.string().max(300).optional(),
    variants: z
      .array(
        z.object({
          size: z.string().optional(),
          color: z.string().optional(),
          stock: z.number().int().min(0),
          price: z.number().min(0).optional(),
        })
      )
      .optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().min(10).optional(),
    shortDescription: z.string().max(500).optional(),
    price: z.number().min(0.01).optional(),
    discountPrice: z.number().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    category: objectIdSchema.optional(),
    brand: z.string().max(100).optional(),
    weight: z.number().min(0).optional(),
    dimensions: z
      .object({
        length: z.number().min(0),
        width: z.number().min(0),
        height: z.number().min(0),
      })
      .optional(),
    tags: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    seoTitle: z.string().max(150).optional(),
    seoDescription: z.string().max(300).optional(),
  }),
  params: z.object({
    id: objectIdSchema,
  }),
});

// Category validation schemas
export const createCategorySchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Category name must be at least 2 characters")
      .max(100),
    description: z.string().max(500).optional(),
    parent: objectIdSchema.optional(),
    isActive: z.boolean().optional(),
    seoTitle: z.string().max(150).optional(),
    seoDescription: z.string().max(300).optional(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    parent: objectIdSchema.optional(),
    isActive: z.boolean().optional(),
    seoTitle: z.string().max(150).optional(),
    seoDescription: z.string().max(300).optional(),
  }),
  params: z.object({
    id: objectIdSchema,
  }),
});

// Cart validation schemas
export const addToCartSchema = z.object({
  body: z.object({
    productId: objectIdSchema,
    quantity: z.number().int().min(1, "Quantity must be at least 1").max(100),
    variant: z
      .object({
        size: z.string().optional(),
        color: z.string().optional(),
      })
      .optional(),
  }),
});

export const updateCartItemSchema = z.object({
  body: z.object({
    quantity: z.number().int().min(1).max(100),
    variant: z
      .object({
        size: z.string().optional(),
        color: z.string().optional(),
      })
      .optional(),
  }),
  params: z.object({
    productId: objectIdSchema,
  }),
});

// Order validation schemas
export const createOrderSchema = z.object({
  body: z.object({
    shippingAddress: objectIdSchema,
    paymentMethod: z.enum(["razorpay", "cod"]),
    couponCode: z.string().optional(),
    notes: z.string().max(500).optional(),
  }),
});

// Review validation schemas
export const createReviewSchema = z.object({
  body: z.object({
    productId: objectIdSchema,
    rating: z
      .number()
      .int()
      .min(1, "Rating must be at least 1")
      .max(5, "Rating cannot exceed 5"),
    title: z
      .string()
      .min(2, "Review title must be at least 2 characters")
      .max(200),
    comment: z
      .string()
      .min(10, "Review comment must be at least 10 characters")
      .max(2000),
  }),
});

export const updateReviewSchema = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5).optional(),
    title: z.string().min(2).max(200).optional(),
    comment: z.string().min(10).max(2000).optional(),
  }),
  params: z.object({
    id: objectIdSchema,
  }),
});

// Coupon validation schemas
export const createCouponSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(3, "Coupon code must be at least 3 characters")
      .max(50),
    description: z.string().max(500).optional(),
    type: z.enum(["percentage", "fixed"]),
    value: z.number().min(0.01, "Coupon value must be greater than 0"),
    minimumAmount: z.number().min(0).optional(),
    maximumDiscount: z.number().min(0).optional(),
    usageLimit: z.number().int().min(1).optional(),
    userLimit: z.number().int().min(1).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    applicableProducts: z.array(objectIdSchema).optional(),
    applicableCategories: z.array(objectIdSchema).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const validateCouponSchema = z.object({
  body: z.object({
    code: z.string().min(1, "Coupon code is required"),
    orderTotal: z.number().min(0.01, "Order total must be greater than 0"),
  }),
});

// Banner validation schemas
export const createBannerSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(2, "Banner title must be at least 2 characters")
      .max(200),
    subtitle: z.string().max(300).optional(),
    description: z.string().max(1000).optional(),
    buttonText: z.string().max(50).optional(),
    buttonLink: urlSchema.optional(),
    position: z.enum(["hero", "sidebar", "footer", "popup"]),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
    priority: z.number().int().min(0).optional(),
  }),
});

// Query parameter validation schemas
export const paginationQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
  }),
});

export const productQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    category: objectIdSchema.optional(),
    minPrice: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .transform(Number)
      .optional(),
    maxPrice: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .transform(Number)
      .optional(),
    rating: z
      .string()
      .regex(/^[1-5]$/)
      .transform(Number)
      .optional(),
    search: z.string().optional(),
    brand: z.string().optional(),
    inStock: z
      .string()
      .transform((val) => val === "true")
      .optional(),
  }),
});

// Validation middleware factory
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Update request with parsed data
      req.body = result.body || req.body;
      req.query = result.query || req.query;
      req.params = result.params || req.params;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
      }

      next(error);
    }
  };
};

// Common parameter validation
export const validateObjectId = (paramName: string = "id") => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];

    if (!id || !objectIdSchema.safeParse(id).success) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`,
      });
    }

    next();
  };
};
