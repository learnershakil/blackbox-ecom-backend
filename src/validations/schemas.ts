import { z } from "zod";

// Common validation schemas
export const ObjectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format");

export const EmailSchema = z.string().email("Invalid email format");

export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

export const PhoneSchema = z
  .string()
  .regex(/^(\+91|0)?[6-9]\d{9}$/, "Invalid Indian phone number format");

export const PinCodeSchema = z
  .string()
  .regex(/^[1-9][0-9]{5}$/, "Invalid pincode format");

// Pagination schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// User validation schemas
export const RegisterUserSchema = z
  .object({
    firstName: z
      .string()
      .min(2, "First name must be at least 2 characters")
      .max(50),
    lastName: z
      .string()
      .min(2, "Last name must be at least 2 characters")
      .max(50),
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const LoginUserSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Password is required"),
});

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phoneNumber: PhoneSchema.optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: PasswordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords don't match",
    path: ["confirmNewPassword"],
  });

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Address validation schemas
export const AddressSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100),
  phoneNumber: PhoneSchema,
  addressLine1: z
    .string()
    .min(5, "Address line 1 must be at least 5 characters")
    .max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2, "City must be at least 2 characters").max(50),
  state: z.string().min(2, "State must be at least 2 characters").max(50),
  postalCode: PinCodeSchema,
  country: z
    .string()
    .min(2, "Country must be at least 2 characters")
    .max(50)
    .default("India"),
  isDefault: z.boolean().default(false),
});

export const UpdateAddressSchema = AddressSchema.partial();

// Product validation schemas
export const ProductSchema = z.object({
  name: z
    .string()
    .min(2, "Product name must be at least 2 characters")
    .max(200),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000),
  shortDescription: z.string().max(500).optional(),
  price: z.number().min(0, "Price cannot be negative"),
  discountPrice: z.number().min(0).optional(),
  sku: z.string().min(1, "SKU is required").max(50),
  category: ObjectIdSchema,
  subcategory: ObjectIdSchema.optional(),
  brand: z.string().max(100).optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  images: z
    .array(z.string().url())
    .min(1, "At least one image is required")
    .max(10),
  variants: z
    .array(
      z.object({
        name: z.string().max(50),
        value: z.string().max(100),
        price: z.number().min(0).optional(),
        stock: z.number().min(0).default(0),
      })
    )
    .optional(),
  specifications: z.record(z.string().max(500)).optional(),
  stock: z.number().min(0, "Stock cannot be negative").default(0),
  minOrderQuantity: z.number().min(1).default(1),
  maxOrderQuantity: z.number().min(1).optional(),
  weight: z.number().min(0).optional(),
  dimensions: z
    .object({
      length: z.number().min(0),
      width: z.number().min(0),
      height: z.number().min(0),
    })
    .optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  metaKeywords: z.array(z.string().max(30)).max(10).optional(),
});

export const UpdateProductSchema = ProductSchema.partial();

export const ProductQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(12),
  sort: z
    .enum(["name", "price", "createdAt", "rating", "popularity"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  category: ObjectIdSchema.optional(),
  subcategory: ObjectIdSchema.optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  tags: z.string().optional(), // Comma-separated tags
});

// Category validation schemas
export const CategorySchema = z.object({
  name: z
    .string()
    .min(2, "Category name must be at least 2 characters")
    .max(100),
  description: z.string().max(500).optional(),
  slug: z.string().min(2).max(100).optional(),
  parent: ObjectIdSchema.optional(),
  image: z.string().url().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().min(0).default(0),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
});

export const UpdateCategorySchema = CategorySchema.partial();

// Cart validation schemas
export const AddToCartSchema = z.object({
  productId: ObjectIdSchema,
  quantity: z
    .number()
    .min(1, "Quantity must be at least 1")
    .max(10, "Maximum 10 items allowed"),
  variantId: ObjectIdSchema.optional(),
});

export const UpdateCartItemSchema = z.object({
  quantity: z
    .number()
    .min(1, "Quantity must be at least 1")
    .max(10, "Maximum 10 items allowed"),
});

// Order validation schemas
export const CreateOrderSchema = z.object({
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema.optional(),
  paymentMethod: z.enum(["razorpay", "cod", "wallet"]).default("razorpay"),
  couponCode: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
  ]),
  notes: z.string().max(500).optional(),
  trackingNumber: z.string().max(50).optional(),
});

// Review validation schemas
export const CreateReviewSchema = z.object({
  productId: ObjectIdSchema,
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot exceed 5"),
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters")
    .max(1000),
  images: z
    .array(z.string().url())
    .max(5, "Maximum 5 images allowed")
    .optional(),
  pros: z.array(z.string().max(100)).max(5).optional(),
  cons: z.array(z.string().max(100)).max(5).optional(),
});

export const UpdateReviewSchema = CreateReviewSchema.omit({
  productId: true,
}).partial();

// Coupon validation schemas
export const BaseCouponSchema = z.object({
  code: z
    .string()
    .min(3, "Coupon code must be at least 3 characters")
    .max(20)
    .regex(
      /^[A-Z0-9]+$/,
      "Coupon code must contain only uppercase letters and numbers"
    ),
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().min(0, "Discount value cannot be negative"),
  minOrderAmount: z.number().min(0).default(0),
  maxDiscountAmount: z.number().min(0).optional(),
  usageLimit: z.number().min(1).optional(),
  usagePerUser: z.number().min(1).default(1),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  applicableCategories: z.array(ObjectIdSchema).optional(),
  applicableProducts: z.array(ObjectIdSchema).optional(),
  isActive: z.boolean().default(true),
});

export const CouponSchema = BaseCouponSchema.refine(
  (data) => {
    const validFrom = new Date(data.validFrom);
    const validTo = new Date(data.validTo);
    return validFrom < validTo;
  },
  {
    message: "Valid from date must be before valid to date",
    path: ["validTo"],
  }
);

export const UpdateCouponSchema = BaseCouponSchema.partial();

export const ValidateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  cartTotal: z.number().min(0, "Cart total cannot be negative"),
});

// Banner validation schemas
export const BaseBannerSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(500).optional(),
  image: z.string().url("Invalid image URL"),
  mobileImage: z.string().url("Invalid mobile image URL").optional(),
  link: z.string().url("Invalid link URL").optional(),
  buttonText: z.string().max(30).optional(),
  position: z.enum(["hero", "secondary", "sidebar", "footer"]).default("hero"),
  sortOrder: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
});

export const BannerSchema = BaseBannerSchema.refine(
  (data) => {
    if (data.validFrom && data.validTo) {
      const validFrom = new Date(data.validFrom);
      const validTo = new Date(data.validTo);
      return validFrom < validTo;
    }
    return true;
  },
  {
    message: "Valid from date must be before valid to date",
    path: ["validTo"],
  }
);

export const UpdateBannerSchema = BaseBannerSchema.partial();

// Wishlist validation schemas
export const AddToWishlistSchema = z.object({
  productId: ObjectIdSchema,
});

// Contact/Support schemas
export const ContactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: EmailSchema,
  subject: z.string().min(5, "Subject must be at least 5 characters").max(200),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000),
  category: z
    .enum(["general", "order", "product", "account", "technical", "complaint"])
    .default("general"),
});

// Newsletter subscription schema
export const NewsletterSchema = z.object({
  email: EmailSchema,
  categories: z.array(z.string()).optional(),
});

// Search schemas
export const SearchSchema = z.object({
  q: z.string().min(1, "Search query is required").max(100),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(12),
  category: ObjectIdSchema.optional(),
  sort: z
    .enum(["relevance", "price_low", "price_high", "rating", "newest"])
    .default("relevance"),
});

// File upload schemas
export const FileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.string().refine((mime) => {
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    return allowedMimes.includes(mime);
  }, "Invalid file type. Only JPEG, PNG, WebP and GIF are allowed"),
  size: z.number().max(5 * 1024 * 1024, "File size cannot exceed 5MB"),
});

// Type exports for TypeScript
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
export type LoginUserInput = z.infer<typeof LoginUserSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;
export type ProductInput = z.infer<typeof ProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ProductQueryInput = z.infer<typeof ProductQuerySchema>;
export type CategoryInput = z.infer<typeof CategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
export type CouponInput = z.infer<typeof CouponSchema>;
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>;
export type ValidateCouponInput = z.infer<typeof ValidateCouponSchema>;
export type BannerInput = z.infer<typeof BannerSchema>;
export type UpdateBannerInput = z.infer<typeof UpdateBannerSchema>;
export type AddToWishlistInput = z.infer<typeof AddToWishlistSchema>;
export type ContactInput = z.infer<typeof ContactSchema>;
export type NewsletterInput = z.infer<typeof NewsletterSchema>;
export type SearchInput = z.infer<typeof SearchSchema>;
export type FileUploadInput = z.infer<typeof FileUploadSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
