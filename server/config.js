// =============================================================================
// config.js — Central Configuration for the RAG Knowledge Base App
// =============================================================================
// Loads environment variables and exports all settings for:
//   - AWS (Bedrock + S3)
//   - PostgreSQL database
//   - Server settings
// =============================================================================

// Load .env file into process.env
import dotenv from "dotenv";
dotenv.config();

// =============================================================================
// AWS Configuration
// =============================================================================

// AWS region — must match where your S3 bucket and Bedrock are available
export const AWS_REGION = process.env.AWS_REGION || "us-east-1";

// AWS credentials for SDK authentication
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "";
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";

// The Claude model to use for RAG answer generation
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ||
  "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

// S3 bucket name for storing uploaded documents
// You'll create this bucket in the AWS Console or via CLI
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "rag-knowledge-base-docs";

// =============================================================================
// PostgreSQL Configuration
// =============================================================================

// Connection settings for the PostgreSQL database
// These match what we set when starting the Docker container:
//   docker run -e POSTGRES_PASSWORD=password -e POSTGRES_DB=ragapp -p 5432:5432
export const PG_HOST = process.env.PG_HOST || "localhost";
export const PG_PORT = parseInt(process.env.PG_PORT || "5432", 10); // parseInt converts string to number
export const PG_DATABASE = process.env.PG_DATABASE || "ragapp";
export const PG_USER = process.env.PG_USER || "postgres";
export const PG_PASSWORD = process.env.PG_PASSWORD || "password";

// =============================================================================
// Server Configuration
// =============================================================================

// Port the Fastify server listens on
export const SERVER_PORT = parseInt(process.env.SERVER_PORT || "3001", 10);

// Max file upload size in bytes (10MB default)
// Prevents users from uploading extremely large files
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760", 10);

// =============================================================================
// RAG Configuration
// =============================================================================

// Maximum number of tokens for Claude's response when answering queries
export const RAG_MAX_TOKENS = 2048;

// Temperature for RAG responses — 0.0 for factual, grounded answers
export const RAG_TEMPERATURE = 0.0;

// System prompt that instructs Claude how to answer RAG queries
// This is critical — it tells Claude to ONLY use the provided document context
export const RAG_SYSTEM_PROMPT = `You are a knowledgeable assistant that answers questions based on provided document context.

Rules:
1. ONLY answer based on the document context provided. Do not use knowledge from your training data.
2. If the document context does not contain enough information to answer, say "I couldn't find enough information in the uploaded documents to answer this question."
3. Always cite which document your answer is based on when possible.
4. Be concise but thorough in your answers.
5. If the question is ambiguous, ask for clarification.
6. Format your response clearly with relevant details from the documents.`;

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate that all required configuration values are set.
 * Called at server startup to fail fast if something is missing.
 *
 * @throws {Error} If any required value is missing
 */
export const validateConfig = () => {
  // Check AWS credentials
  if (!AWS_ACCESS_KEY_ID) {
    throw new Error("AWS_ACCESS_KEY_ID is not set. Add it to your .env file.");
  }
  if (!AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS_SECRET_ACCESS_KEY is not set. Add it to your .env file.");
  }

  console.log("✅ Configuration loaded:");
  console.log(`   AWS Region:    ${AWS_REGION}`);
  console.log(`   Bedrock Model: ${BEDROCK_MODEL_ID}`);
  console.log(`   S3 Bucket:     ${S3_BUCKET_NAME}`);
  console.log(`   PostgreSQL:    ${PG_HOST}:${PG_PORT}/${PG_DATABASE}`);
  console.log(`   Server Port:   ${SERVER_PORT}`);
};