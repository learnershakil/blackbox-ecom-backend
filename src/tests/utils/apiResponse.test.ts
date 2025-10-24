import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiResponseHelper, PaginationParams } from "../../utils/apiResponse";
import { Response } from "express";

describe("ApiResponseHelper", () => {
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe("success", () => {
    it("should send success response with data", () => {
      const testData = { id: 1, name: "Test" };
      const message = "Success message";

      ApiResponseHelper.success(mockRes as Response, testData, message, 200);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message,
        data: testData,
        statusCode: 200,
        timestamp: expect.any(String),
      });
    });

    it("should send success response without data", () => {
      const message = "Success message";

      ApiResponseHelper.success(mockRes as Response, null, message);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message,
        data: null,
        statusCode: 200,
        timestamp: expect.any(String),
      });
    });
  });

  describe("error", () => {
    it("should send error response", () => {
      const errorMessage = "Error occurred";

      ApiResponseHelper.error(mockRes as Response, errorMessage, 400);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: errorMessage,
        error: undefined,
        statusCode: 400,
        timestamp: expect.any(String),
      });
    });

    it("should use default status code 500", () => {
      const errorMessage = "Internal error";

      ApiResponseHelper.error(mockRes as Response, errorMessage);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("paginated", () => {
    it("should send paginated success response", () => {
      const testData = [{ id: 1 }, { id: 2 }];
      const paginationParams: PaginationParams = {
        page: 1,
        limit: 10,
        total: 50,
      };

      ApiResponseHelper.paginated(
        mockRes as Response,
        testData,
        paginationParams,
        "Paginated data"
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Paginated data",
        data: testData,
        statusCode: 200,
        timestamp: expect.any(String),
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
          totalPages: 5,
          hasNext: true,
          hasPrev: false,
        },
      });
    });

    it("should calculate pagination correctly for last page", () => {
      const testData = [{ id: 1 }];
      const paginationParams: PaginationParams = {
        page: 5,
        limit: 10,
        total: 50,
      };

      ApiResponseHelper.paginated(
        mockRes as Response,
        testData,
        paginationParams
      );

      const callArgs = (mockRes.json as any).mock.calls[0][0];
      expect(callArgs.pagination).toEqual({
        page: 5,
        limit: 10,
        total: 50,
        totalPages: 5,
        hasNext: false,
        hasPrev: true,
      });
    });
  });

  describe("validation error", () => {
    it("should send validation error response", () => {
      const errors = [
        { field: "email", message: "Email is required" },
        { field: "password", message: "Password too short" },
      ];

      ApiResponseHelper.validationError(mockRes as Response, errors);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Validation failed",
        error: JSON.stringify(errors),
        statusCode: 400,
        timestamp: expect.any(String),
      });
    });
  });

  describe("unauthorized", () => {
    it("should send unauthorized response", () => {
      const message = "Access denied";

      ApiResponseHelper.unauthorized(mockRes as Response, message);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: message,
        error: undefined,
        statusCode: 401,
        timestamp: expect.any(String),
      });
    });
  });

  describe("forbidden", () => {
    it("should send forbidden response", () => {
      const message = "Permission denied";

      ApiResponseHelper.forbidden(mockRes as Response, message);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: message,
        error: undefined,
        statusCode: 403,
        timestamp: expect.any(String),
      });
    });
  });

  describe("notFound", () => {
    it("should send not found response", () => {
      const message = "Resource not found";

      ApiResponseHelper.notFound(mockRes as Response, message);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: message,
        error: undefined,
        statusCode: 404,
        timestamp: expect.any(String),
      });
    });
  });
});
