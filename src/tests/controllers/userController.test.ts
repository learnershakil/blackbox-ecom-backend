import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { User } from "../../models";

describe("User Controller", () => {
  let userToken: string;
  let adminToken: string;
  let testUserId: string;

  beforeEach(async () => {
    // Set consistent JWT secrets for this test (same as jwt.test.ts and auth.test.ts)
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    await global.testUtils.clearDatabase();

    // Create test user and get token
    const user = await global.testUtils.createTestUser();
    testUserId = user._id.toString();
    const userLoginResponse = await request(app).post("/api/auth/login").send({
      email: "learnershakil@gmail.com",
      password: "password123",
    });
    userToken = userLoginResponse.body.data.token;

    // Create admin user and get token
    await global.testUtils.createTestAdmin();
    const adminLoginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@example.com",
      password: "password123",
    });
    adminToken = adminLoginResponse.body.data.token;
  });

  describe("GET /api/users/profile", () => {
    it("should get user profile successfully", async () => {
      const response = await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty(
        "email",
        "learnershakil@gmail.com"
      );
      expect(response.body.data.user).not.toHaveProperty("password");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/users/profile").expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/users/profile", () => {
    it("should update user profile successfully", async () => {
      const updateData = {
        name: "Updated Name",
        email: "updated@example.com",
      };

      const response = await request(app)
        .put("/api/users/profile")
        .set("Authorization", `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.name).toBe(updateData.name);
      expect(response.body.data.user.email).toBe(updateData.email);

      // Verify in database
      const updatedUser = await User.findById(testUserId);
      expect(updatedUser?.name).toBe(updateData.name);
      expect(updatedUser?.email).toBe(updateData.email);
    });

    it("should not allow duplicate email", async () => {
      // Create another user with different email
      await User.create({
        name: "Another User",
        email: "another@example.com",
        password: "password123",
      });

      const updateData = {
        email: "another@example.com",
      };

      const response = await request(app)
        .put("/api/users/profile")
        .set("Authorization", `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("already exists");
    });

    it("should validate email format", async () => {
      const updateData = {
        email: "invalid-email",
      };

      const response = await request(app)
        .put("/api/users/profile")
        .set("Authorization", `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .put("/api/users/profile")
        .send({ name: "New Name" })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/users/change-password", () => {
    it("should change password successfully", async () => {
      const passwordData = {
        currentPassword: "password123",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      };

      const response = await request(app)
        .put("/api/users/change-password")
        .set("Authorization", `Bearer ${userToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("changed successfully");

      // Verify can login with new password
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: "learnershakil@gmail.com",
          password: "newpassword123",
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it("should not change password with wrong current password", async () => {
      const passwordData = {
        currentPassword: "wrongpassword",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      };

      const response = await request(app)
        .put("/api/users/change-password")
        .set("Authorization", `Bearer ${userToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("current password");
    });

    it("should validate password confirmation", async () => {
      const passwordData = {
        currentPassword: "password123",
        newPassword: "newpassword123",
        confirmPassword: "differentpassword",
      };

      const response = await request(app)
        .put("/api/users/change-password")
        .set("Authorization", `Bearer ${userToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .put("/api/users/change-password")
        .send({
          currentPassword: "password123",
          newPassword: "newpassword123",
          confirmPassword: "newpassword123",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/users/addresses", () => {
    it("should add new address successfully", async () => {
      const addressData = {
        fullName: "Shakil Doe",
        phoneNumber: "+1234567890",
        addressLine1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
        isDefault: true,
      };

      const response = await request(app)
        .post("/api/users/addresses")
        .set("Authorization", `Bearer ${userToken}`)
        .send(addressData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.address).toHaveProperty(
        "fullName",
        addressData.fullName
      );
      expect(response.body.data.address).toHaveProperty("isDefault", true);

      // Verify in database
      const user = await User.findById(testUserId);
      expect(user?.addresses).toHaveLength(1);
      expect(user?.addresses[0].fullName).toBe(addressData.fullName);
    });

    it("should validate required address fields", async () => {
      const response = await request(app)
        .post("/api/users/addresses")
        .set("Authorization", `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/users/addresses")
        .send({
          fullName: "Shakil Doe",
          phoneNumber: "+1234567890",
          addressLine1: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "USA",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Admin Routes", () => {
    describe("GET /api/users (Admin only)", () => {
      beforeEach(async () => {
        // Create additional users for testing
        await User.create({
          name: "User 1",
          email: "user1@example.com",
          password: "password123",
        });
        await User.create({
          name: "User 2",
          email: "user2@example.com",
          password: "password123",
        });
      });

      it("should get all users for admin", async () => {
        const response = await request(app)
          .get("/api/users")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.users).toBeInstanceOf(Array);
        expect(response.body.data.users.length).toBeGreaterThan(0);
        expect(response.body.data).toHaveProperty("pagination");
      });

      it("should support pagination", async () => {
        const response = await request(app)
          .get("/api/users?page=1&limit=2")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.users.length).toBeLessThanOrEqual(2);
        expect(response.body.data.pagination.page).toBe(1);
        expect(response.body.data.pagination.limit).toBe(2);
      });

      it("should support search", async () => {
        const response = await request(app)
          .get("/api/users?search=User 1")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.users.length).toBeGreaterThan(0);
      });

      it("should deny access to regular users", async () => {
        const response = await request(app)
          .get("/api/users")
          .set("Authorization", `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
      });

      it("should require authentication", async () => {
        const response = await request(app).get("/api/users").expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe("GET /api/users/:id (Admin only)", () => {
      it("should get user by ID for admin", async () => {
        const response = await request(app)
          .get(`/api/users/${testUserId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toHaveProperty("_id", testUserId);
        expect(response.body.data.user).not.toHaveProperty("password");
      });

      it("should return 404 for non-existent user", async () => {
        const fakeId = "507f1f77bcf86cd799439011";
        const response = await request(app)
          .get(`/api/users/${fakeId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });

      it("should validate ObjectId format", async () => {
        const response = await request(app)
          .get("/api/users/invalid-id")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it("should deny access to regular users", async () => {
        const response = await request(app)
          .get(`/api/users/${testUserId}`)
          .set("Authorization", `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
      });
    });
  });
});
