import app from "./app";
import connectDB from "./config/database";
import {
  logStartup,
  logShutdown,
  handleUnhandledRejection,
  handleUncaughtException,
} from "./middlewares";

// Handle uncaught exceptions
handleUncaughtException();

// Handle unhandled promise rejections
handleUnhandledRejection();

// Get port from environment or default to 5000
const PORT = process.env.PORT || 5000;

// Database connection
let server: any;

const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // Start the server
    server = app.listen(PORT, () => {
      logStartup(Number(PORT));
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    });

    // Handle server errors
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      switch (error.code) {
        case "EACCES":
          console.error(`❌ Port ${PORT} requires elevated privileges`);
          process.exit(1);
        case "EADDRINUSE":
          console.error(`❌ Port ${PORT} is already in use`);
          process.exit(1);
        default:
          throw error;
      }
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  return () => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    logShutdown(signal);

    if (server) {
      server.close(() => {
        console.log("📴 HTTP server closed");

        // Close database connection
        // Note: Mongoose connection will be closed automatically when process exits

        console.log("✅ Graceful shutdown completed");
        process.exit(0);
      });
    } else {
      console.log("✅ Graceful shutdown completed");
      process.exit(0);
    }
  };
};

// Listen for termination signals
process.on("SIGTERM", gracefulShutdown("SIGTERM"));
process.on("SIGINT", gracefulShutdown("SIGINT"));

// Handle specific Windows signals
if (process.platform === "win32") {
  const rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on("SIGINT", () => {
    process.emit("SIGINT" as any);
  });
}

// Start the server
startServer();

export default app;
