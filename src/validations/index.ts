// Export all validation schemas
export * from "./schemas";

// Export commonly used schemas with aliases
export {
  RegisterUserSchema as RegisterSchema,
  LoginUserSchema as LoginSchema,
  ProductSchema as CreateProductSchema,
  CategorySchema as CreateCategorySchema,
  CouponSchema as CreateCouponSchema,
  BannerSchema as CreateBannerSchema,
  AddressSchema as CreateAddressSchema,
  CreateOrderSchema as OrderSchema,
  CreateReviewSchema as ReviewSchema,
  PaginationSchema,
  SearchSchema,
  ContactSchema,
} from "./schemas";
