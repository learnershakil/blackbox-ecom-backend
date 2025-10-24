import swaggerUi from "swagger-ui-express";
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
      paths: {
        "/health": {
          get: {
            tags: ["System"],
            summary: "Health check endpoint",
            description: "Check the health status of the API",
            responses: {
              "200": {
                description: "API is healthy",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        status: { type: "string", example: "OK" },
                        timestamp: { type: "string", format: "date-time" },
                        uptime: { type: "number" },
                        environment: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
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
    .swagger-ui .info .title { color: #3b82f6; }
  `,
  customSiteTitle: "BlackBox Commerce API Documentation",
  swaggerOptions: {
    displayRequestDuration: true,
    docExpansion: "list",
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    supportedSubmitMethods: ["get", "post", "put", "delete", "patch"],
  },
};

/**
 * Setup API documentation routes
 * @param app Express application instance
 */
export const setupDocs = (app: Application): void => {
  // Swagger UI documentation at /docs
  app.use("/docs", swaggerUi.serve);
  app.get("/docs", swaggerUi.setup(openApiSpec, swaggerOptions));

  // Serve OpenAPI spec as JSON
  app.get("/docs/openapi.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(openApiSpec);
  });

  // API info endpoint
  app.get("/docs/info", (req, res) => {
    res.json({
      title: openApiSpec.info.title,
      version: openApiSpec.info.version,
      description: openApiSpec.info.description,
      endpoints: {
        swagger: "/docs",
        openapi: "/docs/openapi.json",
        postman: "/docs/postman",
      },
      servers: openApiSpec.servers || [],
    });
  });

  // Postman collection endpoint
  app.get("/docs/postman", (req, res) => {
    const baseUrl = req.protocol + "://" + req.get("host");

    const postmanCollection = {
      info: {
        name: openApiSpec.info.title,
        description: openApiSpec.info.description,
        version: openApiSpec.info.version,
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: [
        {
          name: "System",
          item: [
            {
              name: "Health Check",
              request: {
                method: "GET",
                header: [],
                url: {
                  raw: `${baseUrl}/health`,
                  protocol: req.protocol,
                  host: [req.get("host")],
                  path: ["health"],
                },
                description: "Check the health status of the API",
              },
            },
          ],
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
                      password: "Password123!",
                      confirmPassword: "Password123!",
                    },
                    null,
                    2
                  ),
                },
                url: {
                  raw: `${baseUrl}/api/auth/register`,
                  protocol: req.protocol,
                  host: [req.get("host")],
                  path: ["api", "auth", "register"],
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
                      password: "Password123!",
                    },
                    null,
                    2
                  ),
                },
                url: {
                  raw: `${baseUrl}/api/auth/login`,
                  protocol: req.protocol,
                  host: [req.get("host")],
                  path: ["api", "auth", "login"],
                },
              },
            },
          ],
        },
      ],
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="blackbox-commerce-api.postman_collection.json"'
    );
    res.json(postmanCollection);
  });

  console.log("📚 API Documentation configured:");
  console.log("   Swagger UI: /docs");
  console.log("   OpenAPI Spec: /docs/openapi.json");
  console.log("   API Info: /docs/info");
  console.log("   Postman Collection: /docs/postman");
};
