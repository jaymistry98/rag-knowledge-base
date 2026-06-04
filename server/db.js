// =============================================================================
// db.js — PostgreSQL Database Client and Query Functions
// =============================================================================
// Manages the PostgreSQL connection and provides functions to:
//   - Initialize database tables (on first run)
//   - Store and retrieve documents metadata
//   - Store and retrieve queries with answers
//   - Manage sessions
//
// Uses the 'pg' package (node-postgres) — the standard PostgreSQL client
// for Node.js. We use a CONNECTION POOL instead of a single connection
// because pools handle multiple concurrent requests efficiently.
//
// Pool vs Single Connection:
//   Single: One connection shared by all requests (bottleneck)
//   Pool: Multiple connections (default 10), assigned to requests as needed
//         When a request finishes, its connection returns to the pool
// =============================================================================

// 'pg' is the standard PostgreSQL client for Node.js.
// We import Pool (not Client) for connection pooling.
import pg from "pg";
const { Pool } = pg;

// Import database connection settings from config
import {
  PG_HOST,
  PG_PORT,
  PG_DATABASE,
  PG_USER,
  PG_PASSWORD,
} from "./config.js";

// =============================================================================
// Create the Connection Pool
// =============================================================================

// Create a pool with our database credentials.
// The pool manages multiple connections automatically.
// max: 10 means up to 10 simultaneous database connections.
const pool = new Pool({
  host: PG_HOST,           // Database server address (localhost for Docker)
  port: PG_PORT,           // PostgreSQL port (default 5432)
  database: PG_DATABASE,   // Database name (ragapp)
  user: PG_USER,           // Username (postgres)
  password: PG_PASSWORD,   // Password (password)
  max: 10,                 // Maximum connections in the pool
});

// Log when a connection is established (helpful for debugging)
pool.on("connect", () => {
  console.log("   🗄️  PostgreSQL pool: new connection established");
});

// Log pool errors (connection drops, authentication failures, etc.)
pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err.message);
});

// =============================================================================
// Initialize Database Tables
// =============================================================================

/**
 * Create the database tables if they don't already exist.
 *
 * Called once at server startup. Uses "IF NOT EXISTS" so it's safe
 * to call multiple times — it won't drop existing data.
 *
 * Tables:
 *   sessions  — Tracks user sessions
 *   documents — Metadata about uploaded files
 *   queries   — Question/answer history with feedback
 */
export const initializeDatabase = async () => {
  // pool.query() gets a connection from the pool, executes the query,
  // and returns the connection to the pool automatically.
  // We use template literals for multi-line SQL (backticks).

  // --- Sessions Table ---
  // Tracks each conversation session (similar to Project 1)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(100) PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      last_active TIMESTAMP DEFAULT NOW()
    )
  `);
  // VARCHAR(100): Variable-length string up to 100 characters
  // PRIMARY KEY: Unique identifier for each row, must be unique & not null
  // DEFAULT NOW(): Automatically sets to current timestamp when row is created

  // --- Documents Table ---
  // Stores metadata about uploaded files (the actual files live in S3)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(100) REFERENCES sessions(id) ON DELETE CASCADE,
      original_name VARCHAR(500) NOT NULL,
      s3_key VARCHAR(500) NOT NULL,
      file_size INTEGER,
      content_type VARCHAR(100),
      text_content TEXT,
      uploaded_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // SERIAL: Auto-incrementing integer (1, 2, 3...)
  // REFERENCES sessions(id): Foreign key — links to the sessions table
  // ON DELETE CASCADE: If a session is deleted, its documents are too
  // TEXT: Unlimited-length string (for storing extracted document text)
  // NOT NULL: This column must have a value (can't be empty)

  // --- Queries Table ---
  // Stores every question asked, the answer given, and user feedback
  await pool.query(`
    CREATE TABLE IF NOT EXISTS queries (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(100) REFERENCES sessions(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer TEXT,
      documents_used TEXT,
      feedback VARCHAR(10),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // documents_used: JSON string listing which docs were used to answer
  // feedback: "up" or "down" (thumbs up/down from the user)

  console.log("✅ Database tables initialized");
};

// =============================================================================
// Session Functions
// =============================================================================

/**
 * Create a new session in the database.
 *
 * @param {string} sessionId — Unique session identifier
 * @returns {Object} The created session row
 */
export const createSession = async (sessionId) => {
  // INSERT INTO adds a new row to the sessions table.
  // $1 is a parameterized query placeholder — prevents SQL injection.
  // NEVER concatenate user input directly into SQL strings!
  // RETURNING * returns the newly created row so we can see what was inserted.
  const result = await pool.query(
    "INSERT INTO sessions (id) VALUES ($1) RETURNING *",
    [sessionId] // $1 gets replaced with sessionId (safely escaped)
  );

  // result.rows is an array of returned rows.
  // Since we inserted one row, result.rows[0] is our new session.
  return result.rows[0];
};

/**
 * Update the last_active timestamp for a session.
 * Called every time the session is used (keeps it "alive").
 *
 * @param {string} sessionId — The session to update
 */
export const touchSession = async (sessionId) => {
  await pool.query(
    "UPDATE sessions SET last_active = NOW() WHERE id = $1",
    [sessionId]
  );
};

// =============================================================================
// Document Functions
// =============================================================================

/**
 * Save document metadata after a successful S3 upload.
 *
 * @param {Object} doc — Document details
 * @param {string} doc.sessionId — Which session uploaded this
 * @param {string} doc.originalName — Original filename from user
 * @param {string} doc.s3Key — The key (path) in the S3 bucket
 * @param {number} doc.fileSize — File size in bytes
 * @param {string} doc.contentType — MIME type (e.g., "application/pdf")
 * @param {string} doc.textContent — Extracted text from the document
 * @returns {Object} The created document row
 */
export const saveDocument = async (doc) => {
  // Insert with multiple parameterized values ($1 through $6)
  const result = await pool.query(
    `INSERT INTO documents (session_id, original_name, s3_key, file_size, content_type, text_content)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      doc.sessionId,
      doc.originalName,
      doc.s3Key,
      doc.fileSize,
      doc.contentType,
      doc.textContent,
    ]
  );
  return result.rows[0];
};

/**
 * Get all documents for a session.
 *
 * @param {string} sessionId — The session to get documents for
 * @returns {Array} Array of document rows
 */
export const getDocumentsBySession = async (sessionId) => {
  // ORDER BY uploaded_at DESC shows newest uploads first
  const result = await pool.query(
    "SELECT * FROM documents WHERE session_id = $1 ORDER BY uploaded_at DESC",
    [sessionId]
  );
  return result.rows;
};

/**
 * Get the text content of all documents for a session.
 * Used by the RAG engine to build context for Claude.
 *
 * @param {string} sessionId — The session to get document text for
 * @returns {Array} Array of { original_name, text_content } objects
 */
export const getDocumentTexts = async (sessionId) => {
  // SELECT only the columns we need (not the full row)
  // This is more efficient than SELECT * when we don't need all columns
  const result = await pool.query(
    "SELECT id, original_name, text_content FROM documents WHERE session_id = $1",
    [sessionId]
  );
  return result.rows;
};

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Save a query (question + answer) to the database.
 *
 * @param {Object} queryData
 * @param {string} queryData.sessionId — Which session asked this
 * @param {string} queryData.question — The user's question
 * @param {string} queryData.answer — Claude's answer
 * @param {string} queryData.documentsUsed — JSON string of document names used
 * @returns {Object} The created query row
 */
export const saveQuery = async (queryData) => {
  const result = await pool.query(
    `INSERT INTO queries (session_id, question, answer, documents_used)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      queryData.sessionId,
      queryData.question,
      queryData.answer,
      queryData.documentsUsed,
    ]
  );
  return result.rows[0];
};

/**
 * Get query history for a session.
 *
 * @param {string} sessionId — The session to get history for
 * @param {number} limit — Maximum number of queries to return (default 50)
 * @returns {Array} Array of query rows, newest first
 */
export const getQueryHistory = async (sessionId, limit = 50) => {
  // LIMIT caps the number of rows returned (prevents huge result sets)
  // $2 is the limit parameter
  const result = await pool.query(
    "SELECT * FROM queries WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2",
    [sessionId, limit]
  );
  return result.rows;
};

/**
 * Update the feedback (thumbs up/down) for a specific query.
 *
 * @param {number} queryId — The query row ID to update
 * @param {string} feedback — "up" or "down"
 * @returns {Object|null} The updated row, or null if not found
 */
export const updateQueryFeedback = async (queryId, feedback) => {
  const result = await pool.query(
    "UPDATE queries SET feedback = $1 WHERE id = $2 RETURNING *",
    [feedback, queryId]
  );
  // If no rows were updated, the queryId didn't exist
  return result.rows[0] || null;
};

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Close the connection pool gracefully.
 * Called when the server shuts down to release database connections.
 */
export const closePool = async () => {
  await pool.end();
  console.log("🗄️  PostgreSQL pool closed");
};

// =============================================================================
// Export the pool for advanced usage (raw queries, transactions, etc.)
// =============================================================================
export { pool };