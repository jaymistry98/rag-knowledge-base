// =============================================================================
// server.js — Fastify API Server for the RAG Knowledge Base App
// =============================================================================
// This is the entry point for the backend. It:
//   1. Creates the Fastify instance
//   2. Registers plugins (CORS, multipart file uploads)
//   3. Registers route modules (upload, query, history)
//   4. Initializes the database tables
//   5. Starts the HTTP server
//
// Run with: node server/server.js
// =============================================================================

// Fastify — the web framework
import Fastify from "fastify";

// @fastify/cors — handles Cross-Origin Resource Sharing.
// Without this, the React frontend (localhost:5173) can't call our API (localhost:3001).
import cors from "@fastify/cors";

// @fastify/multipart — enables multipart/form-data parsing for file uploads.
// Without this, Fastify can't handle file upload requests.
import multipart from "@fastify/multipart";

// Configuration and validation
import { validateConfig, SERVER_PORT, MAX_FILE_SIZE } from "./config.js";

// Database initialization
import { initializeDatabase, closePool } from "./db.js";

// Route modules — each handles a group of related endpoints
import uploadRoutes from "./routes/upload.js";
import queryRoutes from "./routes/query.js";
import historyRoutes from "./routes/history.js";

// =============================================================================
// Create and Configure the Fastify Instance
// =============================================================================

// Create Fastify with logging enabled
const fastify = Fastify({
  logger: true, // Structured JSON logging for every request
});

// =============================================================================
// Register Plugins
// =============================================================================

// CORS plugin — allows the React frontend to make API requests.
// origin: true allows all origins in development.
// In production, you'd restrict this to your frontend's domain.
await fastify.register(cors, {
  origin: true, // Allow all origins (development mode)
});

// Multipart plugin — enables file upload handling.
// limits.fileSize sets the maximum file size the server will accept.
await fastify.register(multipart, {
  limits: {
    fileSize: MAX_FILE_SIZE, // From config (default 10MB)
  },
});

// =============================================================================
// Register Routes
// =============================================================================
// Each route module adds its endpoints to the Fastify instance.
// This keeps routes organized in separate files instead of one giant file.

await fastify.register(uploadRoutes);   // POST /api/upload
await fastify.register(queryRoutes);    // POST /api/query
await fastify.register(historyRoutes);  // GET /api/history/:id, POST /api/feedback, GET /api/documents/:id

// =============================================================================
// Health Check Endpoint
// =============================================================================
// Simple endpoint for monitoring. Returns server status.

fastify.get("/health", async () => {
  return {
    status: "healthy",
    service: "rag-knowledge-base",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
});

// =============================================================================
// Start the Server
// =============================================================================

const start = async () => {
  try {
    // Step 1: Validate configuration (checks .env variables)
    validateConfig();

    // Step 2: Initialize database tables (creates if they don't exist)
    await initializeDatabase();

    // Step 3: Start the HTTP server
    await fastify.listen({
      port: SERVER_PORT, // From config (default 3001)
      host: "0.0.0.0",  // Listen on all interfaces (needed for Docker)
    });

    // Step 4: Log success with endpoint details
    console.log("\n" + "=".repeat(60));
    console.log("🚀 RAG Knowledge Base API Server is running!");
    console.log("=".repeat(60));
    console.log(`   Local:   http://localhost:${SERVER_PORT}`);
    console.log(`   Health:  http://localhost:${SERVER_PORT}/health`);
    console.log(`\n   Endpoints:`);
    console.log(`   POST   /api/upload              — Upload a document`);
    console.log(`   POST   /api/query               — Ask a question (RAG)`);
    console.log(`   GET    /api/history/:sessionId   — Query history`);
    console.log(`   GET    /api/documents/:sessionId — Uploaded documents`);
    console.log(`   POST   /api/feedback             — Rate an answer`);
    console.log(`   GET    /health                   — Health check`);
    console.log("=".repeat(60) + "\n");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// =============================================================================
// Graceful Shutdown
// =============================================================================
// When the server receives a shutdown signal (Ctrl+C, Docker stop, etc.),
// we close the database pool cleanly to release connections.
// Without this, connections might "leak" and eventually exhaust the pool.

// SIGINT is sent when you press Ctrl+C in the terminal
process.on("SIGINT", async () => {
  console.log("\n⏹️  Shutting down gracefully...");
  await fastify.close();  // Stop accepting new requests
  await closePool();      // Close PostgreSQL connections
  process.exit(0);        // Exit cleanly
});

// SIGTERM is sent by Docker when stopping a container
process.on("SIGTERM", async () => {
  console.log("\n⏹️  Received SIGTERM, shutting down...");
  await fastify.close();
  await closePool();
  process.exit(0);
});

// Start the server
start();