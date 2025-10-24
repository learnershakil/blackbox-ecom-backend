import { describe, it, expect, beforeEach, vi } from "vitest";
import { JWTUtil, JWTPayload } from "../../utils/jwt";
import jwt from "jsonwebtoken";

describe("JWTUtil", () => {
  const mockUser = {
    _id: "507f1f77bcf86cd799439011",
    email: "learnershakil@gmail.com",
    role: "user",
  } as any;

  beforeEach(() => {
    // Set test environment variables
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  });

  describe("generateAccessToken", () => {
    it("should generate a valid access token", () => {
      const token = JWTUtil.generateAccessToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Verify the token can be decoded
      const decoded = jwt.decode(token) as any;
      expect(decoded.id).toBe(mockUser._id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.iss).toBe("blackbox-commerce");
      expect(decoded.aud).toBe("blackbox-commerce-users");
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a valid refresh token", () => {
      const token = JWTUtil.generateRefreshToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Verify the token can be decoded
      const decoded = jwt.decode(token) as any;
      expect(decoded.id).toBe(mockUser._id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });
  });

  describe("generateTokenPair", () => {
    it("should generate both access and refresh tokens", () => {
      const { accessToken, refreshToken } = JWTUtil.generateTokenPair(mockUser);

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(typeof accessToken).toBe("string");
      expect(typeof refreshToken).toBe("string");
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify a valid access token", () => {
      const token = JWTUtil.generateAccessToken(mockUser);
      const payload = JWTUtil.verifyAccessToken(token);

      expect(payload.id).toBe(mockUser._id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.role).toBe(mockUser.role);
    });

    it("should throw error for invalid token", () => {
      expect(() => {
        JWTUtil.verifyAccessToken("invalid-token");
      }).toThrow("Invalid access token");
    });

    it("should throw error for expired token", () => {
      const expiredToken = jwt.sign(
        { id: mockUser._id, email: mockUser.email, role: mockUser.role },
        "test-jwt-secret-key-for-testing-purposes-only", // Use the actual secret from the utility
        {
          expiresIn: "-1h", // 1 hour ago
          issuer: "blackbox-commerce",
          audience: "blackbox-commerce-users",
        }
      );

      expect(() => {
        JWTUtil.verifyAccessToken(expiredToken);
      }).toThrow("Access token expired");
    });
  });

  describe("verifyRefreshToken", () => {
    it("should verify a valid refresh token", () => {
      const token = JWTUtil.generateRefreshToken(mockUser);
      const payload = JWTUtil.verifyRefreshToken(token);

      expect(payload.id).toBe(mockUser._id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.role).toBe(mockUser.role);
    });

    it("should throw error for invalid refresh token", () => {
      expect(() => {
        JWTUtil.verifyRefreshToken("invalid-refresh-token");
      }).toThrow("Invalid refresh token");
    });
  });

  describe("extractTokenFromHeader", () => {
    it("should extract token from valid Bearer header", () => {
      const token = "valid-jwt-token";
      const authHeader = `Bearer ${token}`;

      const extractedToken = JWTUtil.extractTokenFromHeader(authHeader);

      expect(extractedToken).toBe(token);
    });

    it("should return null for invalid header format", () => {
      expect(JWTUtil.extractTokenFromHeader("InvalidHeader")).toBeNull();
      expect(JWTUtil.extractTokenFromHeader("Bearer")).toBeNull();
      expect(JWTUtil.extractTokenFromHeader("")).toBeNull();
      expect(JWTUtil.extractTokenFromHeader(undefined)).toBeNull();
    });
  });

  describe("decodeToken", () => {
    it("should decode token without verification", () => {
      const token = JWTUtil.generateAccessToken(mockUser);
      const payload = JWTUtil.decodeToken(token);

      expect(payload?.id).toBe(mockUser._id);
      expect(payload?.email).toBe(mockUser.email);
      expect(payload?.role).toBe(mockUser.role);
    });

    it("should return null for invalid token", () => {
      expect(JWTUtil.decodeToken("invalid-token")).toBeNull();
    });
  });

  describe("isTokenExpired", () => {
    it("should return false for valid token", () => {
      const token = JWTUtil.generateAccessToken(mockUser);
      expect(JWTUtil.isTokenExpired(token)).toBe(false);
    });

    it("should return true for expired token", () => {
      const expiredToken = jwt.sign(
        { id: mockUser._id, email: mockUser.email, role: mockUser.role },
        "test-secret",
        { expiresIn: "-1h" } // 1 hour ago
      );

      expect(JWTUtil.isTokenExpired(expiredToken)).toBe(true);
    });

    it("should return true for invalid token", () => {
      expect(JWTUtil.isTokenExpired("invalid-token")).toBe(true);
    });
  });

  describe("getTokenExpiry", () => {
    it("should return expiry date for valid token", () => {
      const token = JWTUtil.generateAccessToken(mockUser);
      const expiry = JWTUtil.getTokenExpiry(token);

      expect(expiry).toBeInstanceOf(Date);
      expect(expiry!.getTime()).toBeGreaterThan(Date.now());
    });

    it("should return null for invalid token", () => {
      expect(JWTUtil.getTokenExpiry("invalid-token")).toBeNull();
    });
  });
});
