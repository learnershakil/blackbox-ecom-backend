import swaggerUi from "swagger-ui-express";
import redocExpress from "redoc-express";
import { Application } from "express";
import * as path from "path";
import * as fs from "fs";

// Load OpenAPI specification
const openApiPath = path.join(__dirname, "../../docs/openapi.json");
let openApiSpec: any = {};

try {
  if (fs.existsSync(openApiPath)) {
    const rawData = fs.readFileSync(openApiPath, "utf8");
    openApiSpec = JSON.parse(rawData);
  } else {
    console.warn("⚠️  OpenAPI specification file not found at:", openApiPath);
    // Fallback minimal spec
    openApiSpec = {
      openapi: "3.0.3",
      info: {
        title: "BlackBox Commerce API",
        version: "1.0.0",
        description: "E-commerce backend API",
      },
      servers: [
        {
          url: "http://localhost:5000/api",
          description: "Development server",
        },
      ],
      paths: {},
    };
  }
} catch (error) {
  console.error("❌ Error loading OpenAPI specification:", error);
  openApiSpec = {
    openapi: "3.0.3",
    info: {
      title: "BlackBox Commerce API",
      version: "1.0.0",
      description: "E-commerce backend API",
    },
    paths: {},
  };
}

// Swagger UI options
const swaggerOptions = {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .info .title { color: #3b82f6 }
  `,
  customSiteTitle: "BlackBox Commerce API Documentation",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

// ReDoc options
const redocOptions = {
  title: "BlackBox Commerce API Documentation",
  theme: {
    colors: {
      primary: {
        main: "#3b82f6",
      },
    },
    typography: {
      fontSize: "14px",
      lineHeight: "1.5em",
      code: {
        fontSize: "13px",
      },
      headings: {
        fontFamily: "Montserrat, sans-serif",
        fontWeight: "600",
      },
    },
    sidebar: {
      width: "260px",
    },
  },
  hideHostname: false,
  expandResponses: "200,201",
  requiredPropsFirst: true,
  noAutoAuth: false,
  pathInMiddlePanel: false,
  hideLoading: false,
  nativeScrollbars: false,
  hideDownloadButton: false,
};

/**
 * Setup API documentation middleware
 */
export const setupDocs = (app: Application): void => {
  // Swagger UI documentation at /docs
  app.use("/docs", swaggerUi.serve);
  app.get("/docs", swaggerUi.setup(openApiSpec, swaggerOptions));

  // ReDoc documentation at /redoc
  app.get(
    "/redoc",
    redocExpress({
      title: redocOptions.title,
      specUrl: "/docs/openapi.json",
      redocOptions: redocOptions,
    })
  );

  // Serve OpenAPI spec as JSON
  app.get("/docs/openapi.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(openApiSpec);
  });

  // API info endpoint
  app.get("/docs/info", (req, res) => {
    res.json({
      title: openApiSpec.info?.title || "BlackBox Commerce API",
      version: openApiSpec.info?.version || "1.0.0",
      description: openApiSpec.info?.description || "E-commerce backend API",
      docsUrl: "/docs",
      redocUrl: "/redoc",
      specUrl: "/docs/openapi.json",
      endpoints: {
        swagger: "/docs",
        redoc: "/redoc",
        openapi: "/docs/openapi.json",
        postman: "/docs/postman",
      },
    });
  });

  // Generate Postman collection endpoint
  app.get("/docs/postman", (req, res) => {
    const postmanCollection = generatePostmanCollection(openApiSpec);
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="blackbox-commerce-api.postman_collection.json"'
    );
    res.json(postmanCollection);
  });

  console.log("📚 API Documentation setup complete:");
  console.log(
    "   📖 Swagger UI: http://localhost:" + (process.env.PORT || 5000) + "/docs"
  );
  console.log(
    "   📖 ReDoc: http://localhost:" + (process.env.PORT || 5000) + "/redoc"
  );
  console.log(
    "   📄 OpenAPI Spec: http://localhost:" +
      (process.env.PORT || 5000) +
      "/docs/openapi.json"
  );
  console.log(
    "   📮 Postman Collection: http://localhost:" +
      (process.env.PORT || 5000) +
      "/docs/postman"
  );
};

/**
 * Generate Postman collection from OpenAPI spec
 */
const generatePostmanCollection = (spec: any) => {
  const collection = {
    info: {
      name: spec.info?.title || "BlackBox Commerce API",
      description: spec.info?.description || "E-commerce backend API",
      version: spec.info?.version || "1.0.0",
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: {
      type: "bearer",
      bearer: [
        {
          key: "token",
          value: "{{jwt_token}}",
          type: "string",
        },
      ],
    },
    variable: [
      {
        key: "base_url",
        value: spec.servers?.[0]?.url || "http://localhost:5000/api",
        type: "string",
      },
      {
        key: "jwt_token",
        value: "your_jwt_token_here",
        type: "string",
      },
    ],
    item: [
      {
        name: "Health Check",
        request: {
          method: "GET",
          header: [],
          url: {
            raw: "{{base_url}}/health",
            host: ["{{base_url}}"],
            path: ["health"],
          },
        },
      },
      {
        name: "Authentication",
        item: [
          {
            name: "Register User",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json",
                },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify(
                  {
                    firstName: "Shakil",
                    lastName: "Ahmad",
                    email: "Shakil.Ahmad@example.com",
                    password: "SecurePassword123!",
                    confirmPassword: "SecurePassword123!",
                  },
                  null,
                  2
                ),
              },
              url: {
                raw: "{{base_url}}/auth/register",
                host: ["{{base_url}}"],
                path: ["auth", "register"],
              },
            },
          },
          {
            name: "Login User",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json",
                },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify(
                  {
                    email: "Shakil.Ahmad@example.com",
                    password: "SecurePassword123!",
                  },
                  null,
                  2
                ),
              },
              url: {
                raw: "{{base_url}}/auth/login",
                host: ["{{base_url}}"],
                path: ["auth", "login"],
              },
            },
          },
        ],
      },
      {
        name: "Products",
        item: [
          {
            name: "Get All Products",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{base_url}}/products?page=1&limit=10",
                host: ["{{base_url}}"],
                path: ["products"],
                query: [
                  {
                    key: "page",
                    value: "1",
                  },
                  {
                    key: "limit",
                    value: "10",
                  },
                ],
              },
            },
          },
          {
            name: "Create Product (Admin)",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json",
                },
                {
                  key: "Authorization",
                  value: "Bearer {{jwt_token}}",
                },
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify(
                  {
                    name: "Premium Headphones",
                    description:
                      "High-quality wireless headphones with noise cancellation",
                    price: 299.99,
                    category: "60d0fe4f5311236168a109cc",
                    stock: 50,
                    tags: ["wireless", "noise-cancellation", "premium"],
                  },
                  null,
                  2
                ),
              },
              url: {
                raw: "{{base_url}}/products",
                host: ["{{base_url}}"],
                path: ["products"],
              },
            },
          },
        ],
      },
    ],
  };

  return collection;
};

export { openApiSpec };
