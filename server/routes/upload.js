// =============================================================================
// upload.js — File Upload Route
// =============================================================================
// POST /api/upload — Accepts file uploads via multipart/form-data
//
// The upload flow:
//   1. Receive the file from the client (multipart form data)
//   2. Extract text from the file content
//   3. Upload the raw file to S3 (permanent storage)
//   4. Save metadata + extracted text to PostgreSQL
//   5. Return success with document details
//
// Multipart form data is how browsers send file uploads.
// It's different from JSON — the body contains both file bytes AND text fields.
// Fastify needs the @fastify/multipart plugin to handle this.
// =============================================================================

// Import database functions for storing document metadata
import { createSession, saveDocument, touchSession } from "../db.js";

// Import S3 functions for file storage
import { uploadDocument, extractText } from "../s3Client.js";

// Import config for file size limits
import { MAX_FILE_SIZE } from "../config.js";

/**
 * Register the upload route on the Fastify instance.
 *
 * Fastify uses a plugin pattern — routes are registered as functions
 * that receive the fastify instance and add routes to it.
 * This keeps routes modular and organized in separate files.
 *
 * @param {Object} fastify — The Fastify instance to register routes on
 */
export default async function uploadRoutes(fastify) {
  // POST /api/upload — Upload a document
  fastify.post("/api/upload", async (request, reply) => {
    try {
      // --- Step 1: Parse the multipart form data ---
      // request.file() reads the uploaded file from the multipart body.
      // It returns an object with: filename, mimetype, file (readable stream)
      // The @fastify/multipart plugin makes this available.
      const data = await request.file();

      // Check if a file was actually provided
      if (!data) {
        return reply.code(400).send({
          error: "No file uploaded",
          message: "Please include a file in your upload request.",
        });
      }

      // --- Step 2: Read the file content into a Buffer ---
      // data.file is a readable stream — we need to collect all chunks
      // into a single Buffer (array of bytes) for processing.
      const chunks = [];

      // 'for await' reads the stream chunk by chunk asynchronously.
      // Each chunk is a piece of the file. We collect them all.
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }

      // Buffer.concat combines all chunks into one continuous Buffer
      const fileBuffer = Buffer.concat(chunks);

      // --- Step 3: Validate the file ---
      // Check file size against our limit
      if (fileBuffer.length > MAX_FILE_SIZE) {
        return reply.code(400).send({
          error: "File too large",
          message: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB. Your file is ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB.`,
        });
      }

      // Check for supported file types
      const supportedTypes = [
        "text/plain",
        "text/markdown",
        "text/csv",
        "text/html",
        "application/json",
        "application/pdf",
      ];

      const contentType = data.mimetype || "text/plain";
      const fileName = data.filename || "unknown.txt";

      // Warn but don't reject — we'll try to extract text anyway
      if (!supportedTypes.includes(contentType)) {
        console.warn(`   ⚠️ Uncommon file type: ${contentType} for ${fileName}`);
      }

      // --- Step 4: Get or create the session ---
      // The sessionId comes from the form fields (not the file).
      // data.fields contains non-file form fields.
      const sessionId = data.fields?.sessionId?.value || `session_${Date.now()}`;

      // Try to create the session — if it already exists, just touch it
      try {
        await createSession(sessionId);
      } catch {
        // Session already exists (PRIMARY KEY conflict) — that's fine
        await touchSession(sessionId);
      }

      // --- Step 5: Extract text from the file ---
      // We need the raw text for the RAG pipeline to work.
      // The text gets stored in PostgreSQL alongside the metadata.
      const textContent = extractText(fileBuffer, contentType, fileName);

      console.log(
        `   📄 Extracted ${textContent.length} chars from ${fileName}`
      );

      // --- Step 6: Upload the raw file to S3 ---
      // S3 stores the original file for reference/download.
      // PostgreSQL stores the extracted text for RAG queries.
      const s3Result = await uploadDocument({
        sessionId,
        fileName,
        fileBuffer,
        contentType,
      });

      // --- Step 7: Save metadata to PostgreSQL ---
      const doc = await saveDocument({
        sessionId,
        originalName: fileName,
        s3Key: s3Result.s3Key,
        fileSize: fileBuffer.length,
        contentType,
        textContent,
      });

      // --- Step 8: Return success response ---
      return {
        success: true,
        document: {
          id: doc.id,
          sessionId,
          fileName: doc.original_name,
          fileSize: fileBuffer.length,
          contentType,
          textLength: textContent.length, // How much text was extracted
          s3Key: s3Result.s3Key,
          uploadedAt: doc.uploaded_at,
        },
        message: `Document "${fileName}" uploaded and processed successfully.`,
      };
    } catch (error) {
      console.error(`❌ Upload failed: ${error.message}`);

      return reply.code(500).send({
        error: "Upload failed",
        message: error.message || "An error occurred during file upload.",
      });
    }
  });
}