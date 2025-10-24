import { Request } from "express";
import { IUser } from "../models";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: IUser;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface ProductQuery extends PaginationQuery {
  category?: string;
  subcategory?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
  search?: string;
  featured?: string;
  bestSeller?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  details?: any;
}

export interface SuccessResponse<T = any> {
  success: true;
  message?: string;
  data?: T;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface OrderSummary {
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface CartSummary {
  totalItems: number;
  totalAmount: number;
  itemsCount: number;
  isEmpty: boolean;
}
