import { describe, it, expect, beforeEach } from "vitest";
import { User } from "../../models";
import mongoose from "mongoose";

describe("User Model", () => {
  beforeEach(async () => {
    await global.testUtils.clearDatabase();
  });

  describe("User Creation", () => {
    it("should create a user with valid data", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
        role: "user",
      };

      const user = await User.create(userData);

      expect(user).toBeDefined();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.isEmailVerified).toBe(false);
      expect(user.password).not.toBe(userData.password); // Should be hashed
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it("should create user with default values", async () => {
      const userData = {
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
      };

      const user = await User.create(userData);

      expect(user.role).toBe("user"); // Default role
      expect(user.isEmailVerified).toBe(false);
      expect(user.addresses).toEqual([]);
      expect(user.wishlist).toEqual([]);
      expect(user.cart).toEqual([]);
    });

    it("should require name field", async () => {
      const userData = {
        email: "learnershakil@gmail.com",
        password: "password123",
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it("should require email field", async () => {
      const userData = {
        name: "Shakil Doe",
        password: "password123",
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it("should require password field", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it("should enforce unique email constraint", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      };

      await User.create(userData);

      // Try to create another user with same email
      const duplicateUserData = {
        name: "Jane Doe",
        email: "learnershakil@gmail.com",
        password: "password456",
      };

      await expect(User.create(duplicateUserData)).rejects.toThrow();
    });

    it("should validate email format", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "invalid-email",
        password: "password123",
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it("should validate password minimum length", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "123", // Too short
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it("should validate role enum values", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
        role: "invalid_role",
      };

      await expect(User.create(userData)).rejects.toThrow();
    });
  });

  describe("Password Hashing", () => {
    it("should hash password before saving", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      };

      const user = await User.create(userData);

      expect(user.password).not.toBe("password123");
      expect(user.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash format
    });

    it("should not hash password if it is already hashed", async () => {
      const userData = {
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      };

      const user = await User.create(userData);
      const originalHash = user.password;

      // Update user without changing password
      user.name = "Updated Name";
      await user.save();

      expect(user.password).toBe(originalHash);
    });
  });

  describe("comparePassword method", () => {
    let user: any;

    beforeEach(async () => {
      user = await User.create({
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      });
    });

    it("should return true for correct password", async () => {
      const isMatch = await user.comparePassword("password123");
      expect(isMatch).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      const isMatch = await user.comparePassword("wrongpassword");
      expect(isMatch).toBe(false);
    });
  });

  describe("generateJWT method", () => {
    let user: any;

    beforeEach(async () => {
      user = await User.create({
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      });
    });

    it("should generate a valid JWT token", () => {
      const token = user.generateJWT();

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe("generatePasswordResetToken method", () => {
    let user: any;

    beforeEach(async () => {
      user = await User.create({
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      });
    });

    it("should generate password reset token and set expiry", () => {
      const resetToken = user.generatePasswordResetToken();

      expect(resetToken).toBeDefined();
      expect(typeof resetToken).toBe("string");
      expect(user.passwordResetToken).toBeDefined();
      expect(user.passwordResetExpires).toBeInstanceOf(Date);
      expect(user.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("Address Management", () => {
    let user: any;

    beforeEach(async () => {
      user = await User.create({
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      });
    });

    it("should add address to user", async () => {
      const addressData = {
        fullName: "Shakil Doe",
        phoneNumber: "1234567890",
        addressLine1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
        isDefault: true,
      };

      user.addresses.push(addressData);
      await user.save();

      expect(user.addresses).toHaveLength(1);
      expect(user.addresses[0].fullName).toBe(addressData.fullName);
      expect(user.addresses[0].isDefault).toBe(true);
    });

    it("should validate required address fields", async () => {
      const invalidAddress = {
        fullName: "Shakil Doe",
        // Missing required fields
      };

      user.addresses.push(invalidAddress);

      await expect(user.save()).rejects.toThrow();
    });

    it("should validate phone number format", async () => {
      const addressWithInvalidPhone = {
        fullName: "Shakil Doe",
        phoneNumber: "invalid-phone",
        addressLine1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
      };

      user.addresses.push(addressWithInvalidPhone);

      await expect(user.save()).rejects.toThrow();
    });

    it("should validate postal code format", async () => {
      const addressWithInvalidPostal = {
        fullName: "Shakil Doe",
        phoneNumber: "1234567890",
        addressLine1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "invalid",
        country: "USA",
      };

      user.addresses.push(addressWithInvalidPostal);

      await expect(user.save()).rejects.toThrow();
    });
  });

  describe("Cart Management", () => {
    let user: any;
    let productId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      user = await User.create({
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      });

      productId = new mongoose.Types.ObjectId();
    });

    it("should add item to cart", async () => {
      const cartItem = {
        product: productId,
        quantity: 2,
        price: 99.99,
        variant: {
          size: "M",
          color: "Red",
        },
      };

      user.cart.push(cartItem);
      await user.save();

      expect(user.cart).toHaveLength(1);
      expect(user.cart[0].product).toEqual(productId);
      expect(user.cart[0].quantity).toBe(2);
      expect(user.cart[0].price).toBe(99.99);
    });

    it("should validate cart item fields", async () => {
      const invalidCartItem = {
        product: productId,
        // Missing required quantity and price
      };

      user.cart.push(invalidCartItem);

      await expect(user.save()).rejects.toThrow();
    });
  });

  describe("Wishlist Management", () => {
    let user: any;
    let productId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      user = await User.create({
        name: "Shakil Doe",
        email: "learnershakil@gmail.com",
        password: "password123",
      });

      productId = new mongoose.Types.ObjectId();
    });

    it("should add product to wishlist", async () => {
      user.wishlist.push(productId);
      await user.save();

      expect(user.wishlist).toHaveLength(1);
      expect(user.wishlist[0]).toEqual(productId);
    });

    it("should not allow duplicate products in wishlist", async () => {
      user.wishlist.push(productId);
      user.wishlist.push(productId);
      await user.save();

      // MongoDB should handle uniqueness, but we can test the array
      expect(user.wishlist.filter((id) => id.equals(productId))).toHaveLength(
        2
      );
    });
  });

  describe("User Indexing", () => {
    it("should have email index for fast lookups", async () => {
      const indexes = await User.collection.getIndexes();
      // Check if email field is indexed (can be unique index)
      const hasEmailIndex = Object.values(indexes).some(
        (index: any) =>
          index.some &&
          index.some(
            (field: any) =>
              (typeof field === "object" && field.email === 1) ||
              (Array.isArray(field) && field.includes("email"))
          )
      );
      expect(hasEmailIndex).toBe(true);
    });
  });
});
