import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { Product, Category } from "../../models";
import { testHelpers } from "../setup";

describe("Product Controller", () => {
  let userToken: string;
  let adminToken: string;
  let testCategoryId: string;
  let testProductId: string;

  beforeEach(async () => {
    await global.testUtils.clearDatabase();

    // Create test user and get token
    await global.testUtils.createTestUser();
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

    // Create test category
    const category = await Category.create({
      name: "Test Category",
      slug: "test-category",
      description: "Test category description",
    });
    testCategoryId = category._id.toString();

    // Create test product
    const product = await testHelpers.createTestProduct({
      category: testCategoryId,
    });
    testProductId = product._id.toString();
  });

  describe("GET /api/products", () => {
    beforeEach(async () => {
      // Create additional products for testing
      await testHelpers.createTestProduct({
        name: "Featured Product",
        slug: "featured-product",
        description: "Featured product description",
        category: testCategoryId,
        basePrice: 149.99,
        variants: [{ sku: "FEAT-001", price: 149.99, stock: 5 }],
        totalStock: 5,
        tags: ["featured"],
        isFeatured: true,
        isBestSeller: false,
        isActive: true,
        averageRating: 4.5,
        totalReviews: 10,
      });

      await testHelpers.createTestProduct({
        name: "Bestseller Product",
        slug: "bestseller-product",
        description: "Bestseller product description",
        category: testCategoryId,
        basePrice: 79.99,
        variants: [{ sku: "BEST-001", price: 79.99, stock: 20 }],
        totalStock: 20,
        tags: ["bestseller"],
        isFeatured: false,
        isBestSeller: true,
        isActive: true,
        averageRating: 4.8,
        totalReviews: 25,
      });
    });

    it("should get all active products", async () => {
      const response = await request(app).get("/api/products").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toBeInstanceOf(Array);
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data).toHaveProperty("pagination");

      // All returned products should be active
      response.body.data.products.forEach((product: any) => {
        expect(product.isActive).toBe(true);
      });
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/products?page=1&limit=2")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    it("should filter by category", async () => {
      const response = await request(app)
        .get(`/api/products?category=${testCategoryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.products.forEach((product: any) => {
        expect(product.category._id || product.category).toBe(testCategoryId);
      });
    });

    it("should filter by featured products", async () => {
      const response = await request(app)
        .get("/api/products?featured=true")
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.products.forEach((product: any) => {
        expect(product.isFeatured).toBe(true);
      });
    });

    it("should filter by bestseller products", async () => {
      const response = await request(app)
        .get("/api/products?bestseller=true")
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.products.forEach((product: any) => {
        expect(product.isBestSeller).toBe(true);
      });
    });

    it("should search products by name", async () => {
      const response = await request(app)
        .get("/api/products?search=Test")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products.length).toBeGreaterThan(0);
      response.body.data.products.forEach((product: any) => {
        expect(product.name.toLowerCase()).toContain("test");
      });
    });

    it("should sort products by price ascending", async () => {
      const response = await request(app)
        .get("/api/products?sort=price")
        .expect(200);

      expect(response.body.success).toBe(true);
      const products = response.body.data.products;
      for (let i = 1; i < products.length; i++) {
        expect(products[i].basePrice).toBeGreaterThanOrEqual(
          products[i - 1].basePrice
        );
      }
    });

    it("should sort products by price descending", async () => {
      const response = await request(app)
        .get("/api/products?sort=-price")
        .expect(200);

      expect(response.body.success).toBe(true);
      const products = response.body.data.products;
      for (let i = 1; i < products.length; i++) {
        expect(products[i].basePrice).toBeLessThanOrEqual(
          products[i - 1].basePrice
        );
      }
    });

    it("should filter by price range", async () => {
      const response = await request(app)
        .get("/api/products?minPrice=50&maxPrice=100")
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.products.forEach((product: any) => {
        expect(product.basePrice).toBeGreaterThanOrEqual(50);
        expect(product.basePrice).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("GET /api/products/:id", () => {
    it("should get product by ID", async () => {
      const response = await request(app)
        .get(`/api/products/${testProductId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product).toHaveProperty("_id", testProductId);
      expect(response.body.data.product).toHaveProperty("name", "Test Product");
      expect(response.body.data.product).toHaveProperty("category");
    });

    it("should return 404 for non-existent product", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const response = await request(app)
        .get(`/api/products/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");
    });

    it("should validate ObjectId format", async () => {
      const response = await request(app)
        .get("/api/products/invalid-id")
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/products/slug/:slug", () => {
    it("should get product by slug", async () => {
      const response = await request(app)
        .get("/api/products/slug/test-product")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product).toHaveProperty("slug", "test-product");
      expect(response.body.data.product).toHaveProperty("name", "Test Product");
    });

    it("should return 404 for non-existent slug", async () => {
      const response = await request(app)
        .get("/api/products/slug/non-existent-slug")
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Admin Product Routes", () => {
    describe("POST /api/products (Admin only)", () => {
      it("should create new product for admin", async () => {
        const productData = {
          name: "New Product",
          slug: "new-product",
          description: "New product description",
          category: testCategoryId,
          basePrice: 199.99,
          variants: [
            {
              sku: "NEW-001",
              price: 199.99,
              stock: 15,
            },
          ],
          totalStock: 15,
          tags: ["new", "product"],
          isFeatured: true,
          isBestSeller: false,
          isActive: true,
          images: [
            {
              public_id: "test-image-1",
              url: "https://test-cloudinary.com/image1.jpg",
            },
          ],
        };

        const response = await request(app)
          .post("/api/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(productData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.product).toHaveProperty(
          "name",
          productData.name
        );
        expect(response.body.data.product).toHaveProperty(
          "slug",
          productData.slug
        );

        // Verify in database
        const productInDb = await Product.findOne({ slug: productData.slug });
        expect(productInDb).toBeDefined();
        expect(productInDb?.name).toBe(productData.name);
      });

      it("should not create product with duplicate slug", async () => {
        const productData = {
          name: "Another Product",
          slug: "test-product", // Duplicate slug
          description: "Another product description",
          category: testCategoryId,
          basePrice: 299.99,
          variants: [{ sku: "ANOTHER-001", price: 299.99, stock: 5 }],
          totalStock: 5,
          tags: ["another"],
          isActive: true,
          images: [
            {
              public_id: "test-image-2",
              url: "https://test-cloudinary.com/image2.jpg",
            },
          ],
        };

        const response = await request(app)
          .post("/api/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(productData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("already exists");
      });

      it("should validate required fields", async () => {
        const response = await request(app)
          .post("/api/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it("should deny access to regular users", async () => {
        const productData = {
          name: "Unauthorized Product",
          slug: "unauthorized-product",
          description: "Product description",
          category: testCategoryId,
          basePrice: 99.99,
          variants: [{ sku: "UNAUTH-001", price: 99.99, stock: 1 }],
          totalStock: 1,
          tags: ["unauthorized"],
          isActive: true,
        };

        const response = await request(app)
          .post("/api/products")
          .set("Authorization", `Bearer ${userToken}`)
          .send(productData)
          .expect(403);

        expect(response.body.success).toBe(false);
      });

      it("should require authentication", async () => {
        const response = await request(app)
          .post("/api/products")
          .send({
            name: "Test Product",
            slug: "test-product-2",
          })
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe("PUT /api/products/:id (Admin only)", () => {
      it("should update product for admin", async () => {
        const updateData = {
          name: "Updated Product Name",
          basePrice: 149.99,
          isFeatured: true,
        };

        const response = await request(app)
          .put(`/api/products/${testProductId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.product.name).toBe(updateData.name);
        expect(response.body.data.product.basePrice).toBe(updateData.basePrice);
        expect(response.body.data.product.isFeatured).toBe(
          updateData.isFeatured
        );

        // Verify in database
        const updatedProduct = await Product.findById(testProductId);
        expect(updatedProduct?.name).toBe(updateData.name);
        expect(updatedProduct?.basePrice).toBe(updateData.basePrice);
      });

      it("should return 404 for non-existent product", async () => {
        const fakeId = "507f1f77bcf86cd799439011";
        const response = await request(app)
          .put(`/api/products/${fakeId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ name: "Updated Name" })
          .expect(404);

        expect(response.body.success).toBe(false);
      });

      it("should deny access to regular users", async () => {
        const response = await request(app)
          .put(`/api/products/${testProductId}`)
          .set("Authorization", `Bearer ${userToken}`)
          .send({ name: "Unauthorized Update" })
          .expect(403);

        expect(response.body.success).toBe(false);
      });
    });

    describe("DELETE /api/products/:id (Admin only)", () => {
      it("should delete product for admin", async () => {
        const response = await request(app)
          .delete(`/api/products/${testProductId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain("deleted");

        // Verify product is deleted from database
        const deletedProduct = await Product.findById(testProductId);
        expect(deletedProduct).toBeNull();
      });

      it("should return 404 for non-existent product", async () => {
        const fakeId = "507f1f77bcf86cd799439011";
        const response = await request(app)
          .delete(`/api/products/${fakeId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });

      it("should deny access to regular users", async () => {
        const response = await request(app)
          .delete(`/api/products/${testProductId}`)
          .set("Authorization", `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
      });
    });
  });
});
