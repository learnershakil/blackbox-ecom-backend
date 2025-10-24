import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../../app";
import { User } from "../../models";

describe("Auth Controller", () => {
  beforeEach(async () => {
    // Set JWT secret for tests
    process.env.JWT_SECRET = "test-secret";
    await global.testUtils.clearDatabase();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("User registered successfully");
      expect(response.body.data.user).toHaveProperty("name", userData.name);
      expect(response.body.data.user).toHaveProperty("email", userData.email);
      expect(response.body.data.user).not.toHaveProperty("password");
      expect(response.body.data).toHaveProperty("token");

      // Verify user was created in database
      const userInDb = await User.findOne({ email: userData.email });
      expect(userInDb).toBeDefined();
      expect(userInDb?.name).toBe(userData.name);
    });

    it("should not register user with existing email", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      };

      // Create user first
      await User.create(userData);

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("User already exists");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should validate email format", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "invalid-email",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should validate password strength", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "123", // Too short
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create a test user
      await global.testUtils.createTestUser({
        email: "learnershakil@gmail.com",
        password: "password123",
      });
    });

    it("should login user with valid credentials", async () => {
      const loginData = {
        email: "learnershakil@gmail.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Login successful");
      expect(response.body.data.user).toHaveProperty("email", loginData.email);
      expect(response.body.data.user).not.toHaveProperty("password");
      expect(response.body.data).toHaveProperty("token");
    });

    it("should not login with invalid email", async () => {
      const loginData = {
        email: "nonexistent@example.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid email or password");
    });

    it("should not login with invalid password", async () => {
      const loginData = {
        email: "learnershakil@gmail.com",
        password: "wrongpassword",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid email or password");
    });

    it("should validate required fields for login", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/logout", () => {
    let authToken: string;

    beforeEach(async () => {
      // Create and login user
      const user = await global.testUtils.createTestUser();
      const loginResponse = await request(app).post("/api/auth/login").send({
        email: "learnershakil@gmail.com",
        password: "password123",
      });

      authToken = loginResponse.body.data.token;
    });

    it("should logout user successfully", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Logout successful");
    });

    it("should require authentication for logout", async () => {
      const response = await request(app).post("/api/auth/logout").expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    beforeEach(async () => {
      await global.testUtils.createTestUser({
        email: "learnershakil@gmail.com",
      });
    });

    it("should send password reset email for valid email", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "learnershakil@gmail.com" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain(
        "Password reset email sent successfully"
      );

      // Verify reset token was created
      const user = await User.findOne({
        email: "learnershakil@gmail.com",
      }).select("+passwordResetToken +passwordResetExpires");
      expect(user?.passwordResetToken).toBeDefined();
      expect(user?.passwordResetExpires).toBeDefined();
    });

    it("should return success even for non-existent email (security)", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@example.com" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain(
        "Password reset email sent successfully"
      );
    });

    it("should validate email format", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "invalid-email" })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/auth/me", () => {
    let authToken: string;

    beforeEach(async () => {
      const user = await global.testUtils.createTestUser();
      const loginResponse = await request(app).post("/api/auth/login").send({
        email: "learnershakil@gmail.com",
        password: "password123",
      });

      authToken = loginResponse.body.data.token;
    });

    it("should get current user profile", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty(
        "email",
        "learnershakil@gmail.com"
      );
      expect(response.body.data.user).not.toHaveProperty("password");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/auth/me").expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should handle invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
