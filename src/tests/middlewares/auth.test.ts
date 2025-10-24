import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { authenticate, adminOnly } from "../../middlewares/auth";
import { JWTUtil } from "../../utils/jwt";

// Create a test app for middleware testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Test route that requires authentication
  app.get("/protected", authenticate, (req, res) => {
    res.json({ success: true, user: req.user });
  });

  // Test route that requires admin access
  app.get("/admin-only", authenticate, adminOnly, (req, res) => {
    res.json({ success: true, message: "Admin access granted" });
  });

  return app;
};

describe("Auth Middleware", () => {
  let app: express.Application;
  let validToken: string;
  let adminToken: string;

  beforeEach(async () => {
    // Set consistent JWT secrets for this test (same as jwt.test.ts)
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    app = createTestApp();
    await global.testUtils.clearDatabase();

    // Create test user and generate token
    const user = await global.testUtils.createTestUser();
    validToken = JWTUtil.generateAccessToken(user);

    // Create admin user and generate token
    const admin = await global.testUtils.createTestAdmin();
    adminToken = JWTUtil.generateAccessToken(admin);
  });

  describe("authenticate middleware", () => {
    it("should allow access with valid token", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty("_id");
      expect(response.body.user).toHaveProperty("email");
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("should deny access without token", async () => {
      const response = await request(app).get("/protected").expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("token");
    });

    it("should deny access with invalid token", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid");
    });

    it("should deny access with malformed Authorization header", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", "InvalidFormat token")
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should deny access with expired token", async () => {
      const expiredToken = JWTUtil.generateAccessToken({
        _id: "507f1f77bcf86cd799439011",
        email: "learnershakil@gmail.com",
        role: "user",
      } as any);

      // Mock JWTUtil to simulate expired token
      const originalVerify = JWTUtil.verifyAccessToken;
      JWTUtil.verifyAccessToken = vi.fn().mockImplementation(() => {
        throw new Error("Access token expired");
      });

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Token expired");

      // Restore original method
      JWTUtil.verifyAccessToken = originalVerify;
    });

    it("should handle user not found in database", async () => {
      // Create token for non-existent user
      const fakeToken = JWTUtil.generateAccessToken({
        _id: "507f1f77bcf86cd799439011",
        email: "nonexistent@example.com",
        role: "user",
      } as any);

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${fakeToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("User not found");
    });
  });

  describe("adminOnly middleware", () => {
    it("should allow access for admin users", async () => {
      const response = await request(app)
        .get("/admin-only")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Admin access granted");
    });

    it("should deny access for regular users", async () => {
      const response = await request(app)
        .get("/admin-only")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Insufficient permissions");
    });

    it("should deny access without authentication", async () => {
      const response = await request(app).get("/admin-only").expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
