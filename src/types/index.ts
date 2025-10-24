import { Document } from "mongoose";

export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  avatar?: {
    public_id: string;
    url: string;
  };
  role: "user" | "admin" | "super_admin";
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  addresses: IAddress[];
  wishlist: string[];
  cart: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateJWT(): string;
  generatePasswordResetToken(): string;
}

export interface IAddress {
  _id?: string;
  fullName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface ICartItem {
  product: string;
  quantity: number;
  variant?: {
    size?: string;
    color?: string;
  };
  price: number;
}

export interface ICategory extends Document {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: {
    public_id: string;
    url: string;
  };
  parentCategory?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductVariant {
  size?: string;
  color?: string;
  sku: string;
  price: number;
  stock: number;
  images?: {
    public_id: string;
    url: string;
  }[];
}

export interface IProduct extends Document {
  _id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  images: {
    public_id: string;
    url: string;
  }[];
  videos?: {
    public_id: string;
    url: string;
  }[];
  variants: IProductVariant[];
  basePrice: number;
  discountPrice?: number;
  totalStock: number;
  specifications?: { [key: string]: string };
  tags: string[];
  isFeatured: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  averageRating: number;
  totalReviews: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrder extends Document {
  _id: string;
  orderNumber: string;
  user: string;
  items: IOrderItem[];
  shippingAddress: IAddress;
  billingAddress?: IAddress;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  couponCode?: string;
  paymentMethod: "razorpay" | "cod";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentDetails?: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  };
  orderStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  trackingNumber?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderItem {
  product: string;
  name: string;
  image: string;
  variant?: {
    size?: string;
    color?: string;
  };
  price: number;
  quantity: number;
  subtotal: number;
}

export interface IReview extends Document {
  _id: string;
  user: string;
  product: string;
  order: string;
  rating: number;
  title?: string;
  comment: string;
  images?: {
    public_id: string;
    url: string;
  }[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  helpfulBy: string[];
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICoupon extends Document {
  _id: string;
  code: string;
  name: string;
  description?: string;
  type: "percentage" | "fixed";
  value: number;
  minimumOrderValue?: number;
  maximumDiscountAmount?: number;
  usageLimit?: number;
  usedCount: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  isActive: boolean;
  validFrom: Date;
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBanner extends Document {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image: {
    public_id: string;
    url: string;
  };
  link?: string;
  buttonText?: string;
  position: "hero" | "featured" | "category" | "promotional";
  order: number;
  isActive: boolean;
  validFrom?: Date;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICart extends Document {
  _id: string;
  user: string;
  items: ICartItem[];
  totalItems: number;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWishlist extends Document {
  _id: string;
  user: string;
  products: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification extends Document {
  _id: string;
  user: string;
  type: "order" | "promotion" | "system" | "review";
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISettings extends Document {
  _id: string;
  siteName: string;
  siteDescription?: string;
  siteLogo?: {
    public_id: string;
    url: string;
  };
  favicon?: {
    public_id: string;
    url: string;
  };
  contactEmail: string;
  supportEmail: string;
  phoneNumber?: string;
  address?: string;
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  paymentSettings: {
    razorpayEnabled: boolean;
    codEnabled: boolean;
    freeShippingThreshold?: number;
    shippingCost?: number;
  };
  emailSettings: {
    fromName: string;
    fromEmail: string;
    replyToEmail: string;
  };
  seoSettings: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
