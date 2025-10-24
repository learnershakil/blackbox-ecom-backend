import { Response } from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  statusCode: number;
  timestamp: string;
  pagination?: PaginationData;
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  total: number;
}

export class ApiResponseHelper {
  /**
   * Send success response
   */
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: number = 200,
    pagination?: PaginationData
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      message: message || "Operation successful",
      data,
      statusCode,
      timestamp: new Date().toISOString(),
      pagination,
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    error?: string
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(
    res: Response,
    errors: any[],
    message: string = "Validation failed"
  ): Response {
    return this.error(res, message, 400, JSON.stringify(errors));
  }

  /**
   * Send unauthorized response
   */
  static unauthorized(
    res: Response,
    message: string = "Unauthorized access"
  ): Response {
    return this.error(res, message, 401);
  }

  /**
   * Send forbidden response
   */
  static forbidden(
    res: Response,
    message: string = "Access forbidden"
  ): Response {
    return this.error(res, message, 403);
  }

  /**
   * Send not found response
   */
  static notFound(
    res: Response,
    message: string = "Resource not found"
  ): Response {
    return this.error(res, message, 404);
  }

  /**
   * Send conflict response
   */
  static conflict(
    res: Response,
    message: string = "Resource conflict"
  ): Response {
    return this.error(res, message, 409);
  }

  /**
   * Send internal server error response
   */
  static internalError(
    res: Response,
    message: string = "Internal server error",
    error?: string
  ): Response {
    return this.error(res, message, 500, error);
  }

  /**
   * Send paginated response
   */
  static paginated<T>(
    res: Response,
    data: T[],
    paginationParams: PaginationParams,
    message?: string
  ): Response {
    const { page = 1, limit = 10, total } = paginationParams;
    const totalPages = Math.ceil(total / limit);

    const pagination: PaginationData = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return this.success(res, data, message, 200, pagination);
  }

  /**
   * Send created response
   */
  static created<T>(
    res: Response,
    data?: T,
    message: string = "Resource created successfully"
  ): Response {
    return this.success(res, data, message, 201);
  }

  /**
   * Send updated response
   */
  static updated<T>(
    res: Response,
    data?: T,
    message: string = "Resource updated successfully"
  ): Response {
    return this.success(res, data, message, 200);
  }

  /**
   * Send deleted response
   */
  static deleted(
    res: Response,
    message: string = "Resource deleted successfully"
  ): Response {
    return this.success(res, null, message, 200);
  }

  /**
   * Send no content response
   */
  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  /**
   * Handle async controller errors
   */
  static async handleAsync(
    res: Response,
    asyncFn: () => Promise<Response | void>
  ): Promise<Response | void> {
    try {
      return await asyncFn();
    } catch (error: any) {
      console.error("Async handler error:", error);

      if (error.name === "ValidationError") {
        return this.validationError(res, [error.message]);
      }

      if (error.name === "CastError") {
        return this.notFound(res, "Invalid resource ID");
      }

      if (error.code === 11000) {
        return this.conflict(res, "Resource already exists");
      }

      return this.internalError(res, error.message || "Internal server error");
    }
  }
}

export default ApiResponseHelper;
