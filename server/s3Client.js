// =============================================================================
// s3Client.js — AWS S3 Client for Document Storage
// =============================================================================
// Handles uploading and downloading documents to/from AWS S3.
//
// S3 (Simple Storage Service) is AWS's object storage.
// Think of it like a cloud file system:
//   Bucket = top-level folder (like a drive)
//   Key = file path within the bucket (e.g., "sessions/abc/doc.pdf")
//   Object = the actual file + metadata
//
// We store uploaded documents in S3 because:
//   1. Durable — 99.999999999% durability (11 nines)
//   2. Scalable — handles any file size or number
//   3. Cheap — $0.023/GB per month
//   4. The job posting specifically asks for S3 experience
// =============================================================================

// AWS SDK v3 — modular S3 client imports
// Same pattern as Bedrock: create client → create command → send
import {
  S3Client,          // The main client for S3 operations
  PutObjectCommand,  // Command to upload (PUT) a file
  GetObjectCommand,  // Command to download (GET) a file
  DeleteObjectCommand, // Command to delete a file
} from "@aws-sdk/client-s3";

// Import configuration values
import {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  S3_BUCKET_NAME,
} from "./config.js";

// =============================================================================
// Create the S3 Client
// =============================================================================

// Same pattern as BedrockRuntimeClient from Project 1:
// Create once, reuse for all operations.
const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

console.log(`☁️  S3 client initialized for bucket: ${S3_BUCKET_NAME}`);

// =============================================================================
// Upload a Document to S3
// =============================================================================

/**
 * Upload a file to S3 and return the key (path).
 *
 * We organize files by session ID so each user's documents are grouped:
 *   s3://bucket-name/sessions/{sessionId}/{timestamp}_{filename}
 *
 * @param {Object} params
 * @param {string} params.sessionId — The session uploading this file
 * @param {string} params.fileName — Original filename (e.g., "manual.pdf")
 * @param {Buffer} params.fileBuffer — The file content as a Buffer
 * @param {string} params.contentType — MIME type (e.g., "application/pdf")
 * @returns {Object} Upload result: { s3Key, bucket, size }
 * @throws {Error} If the upload fails
 */
export const uploadDocument = async ({ sessionId, fileName, fileBuffer, contentType }) => {
  // Build the S3 key (path) for this file.
  // Using timestamp prefix prevents name collisions if the same file
  // is uploaded twice. Example: "sessions/abc123/1679000000_report.pdf"
  const timestamp = Date.now();
  const s3Key = `sessions/${sessionId}/${timestamp}_${fileName}`;

  // Create the PutObject command — tells S3 what to store and where
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,   // Which bucket to upload to
    Key: s3Key,               // Path within the bucket
    Body: fileBuffer,         // The actual file content (as bytes)
    ContentType: contentType, // MIME type — helps S3 serve the file correctly
    // Metadata: Custom key-value pairs stored alongside the file
    Metadata: {
      "session-id": sessionId,         // Track which session uploaded this
      "original-name": fileName,       // Preserve the original filename
      "upload-timestamp": String(timestamp), // When it was uploaded
    },
  });

  try {
    // Send the upload command to S3
    await s3.send(command);

    console.log(`   📤 Uploaded to S3: ${s3Key} (${fileBuffer.length} bytes)`);

    // Return the key and metadata — we'll store this in PostgreSQL
    return {
      s3Key,                        // The path in S3 (needed for retrieval)
      bucket: S3_BUCKET_NAME,       // Which bucket it's in
      size: fileBuffer.length,      // File size in bytes
    };
  } catch (error) {
    console.error(`❌ S3 upload failed: ${error.message}`);
    throw new Error(`Failed to upload document to S3: ${error.message}`);
  }
};

// =============================================================================
// Download a Document from S3
// =============================================================================

/**
 * Download a file from S3 and return its content.
 *
 * @param {string} s3Key — The key (path) of the file in S3
 * @returns {Object} { content: string, contentType: string }
 * @throws {Error} If the download fails
 */
export const downloadDocument = async (s3Key) => {
  // Create the GetObject command
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
  });

  try {
    // Send the download command
    const response = await s3.send(command);

    // The response Body is a readable stream.
    // We need to convert it to a string for text processing.
    // transformToString() reads the entire stream into a string.
    const content = await response.Body.transformToString();

    return {
      content,
      contentType: response.ContentType,
    };
  } catch (error) {
    console.error(`❌ S3 download failed for key ${s3Key}: ${error.message}`);
    throw new Error(`Failed to download document from S3: ${error.message}`);
  }
};

// =============================================================================
// Delete a Document from S3
// =============================================================================

/**
 * Delete a file from S3.
 *
 * @param {string} s3Key — The key (path) of the file to delete
 * @returns {boolean} True if deletion was successful
 */
export const deleteDocument = async (s3Key) => {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
  });

  try {
    await s3.send(command);
    console.log(`   🗑️  Deleted from S3: ${s3Key}`);
    return true;
  } catch (error) {
    console.error(`❌ S3 delete failed for key ${s3Key}: ${error.message}`);
    throw new Error(`Failed to delete document from S3: ${error.message}`);
  }
};

// =============================================================================
// Extract Text from Uploaded Files
// =============================================================================

/**
 * Extract readable text from an uploaded file buffer.
 *
 * For this portfolio project, we handle plain text files directly.
 * For PDFs, we extract what we can from the raw buffer.
 *
 * In production, you'd use a library like pdf-parse or send to
 * AWS Textract for advanced PDF/image text extraction.
 *
 * @param {Buffer} fileBuffer — The raw file content
 * @param {string} contentType — MIME type of the file
 * @param {string} fileName — Original filename (for fallback type detection)
 * @returns {string} Extracted text content
 */
export const extractText = (fileBuffer, contentType, fileName) => {
  // Plain text files — decode the buffer directly to a string
  // Handles: .txt, .md, .csv, .json, .html, .xml
  const textTypes = [
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/html",
    "application/json",
    "application/xml",
  ];

  if (textTypes.includes(contentType) || fileName.endsWith(".txt") || fileName.endsWith(".md")) {
    // Buffer.toString("utf-8") converts raw bytes to a UTF-8 string
    return fileBuffer.toString("utf-8");
  }

  // For PDF files — attempt basic text extraction
  // This is a simplified approach. In production, use pdf-parse package.
  if (contentType === "application/pdf" || fileName.endsWith(".pdf")) {
    // Try to extract readable text from PDF bytes.
    // PDFs have text embedded in streams — we do a basic extraction.
    const rawText = fileBuffer.toString("utf-8");

    // Look for text between BT (Begin Text) and ET (End Text) markers
    // This is a simplified PDF text extraction — won't work for all PDFs
    const textChunks = [];
    const pdfString = fileBuffer.toString("latin1"); // PDFs use latin1 encoding

    // Extract strings that look like readable text (basic heuristic)
    // Match sequences of printable ASCII characters
    const matches = pdfString.match(/[\x20-\x7E]{4,}/g);
    if (matches) {
      // Filter out PDF commands and keep only human-readable text
      const filtered = matches.filter(
        (m) =>
          !m.startsWith("/") &&       // Not a PDF command
          !m.includes("obj") &&       // Not a PDF object reference
          !m.includes("stream") &&    // Not a stream marker
          !m.includes("endobj") &&    // Not an end marker
          m.length > 5                // Must be meaningful length
      );
      textChunks.push(...filtered);
    }

    const extractedText = textChunks.join(" ").trim();

    if (extractedText.length > 50) {
      return extractedText;
    }

    // If basic extraction fails, return a message
    return `[PDF document: ${fileName} — For full text extraction, consider using a PDF parsing library like pdf-parse]`;
  }

  // Unknown file type — return what we can
  return `[Unsupported file type: ${contentType}. File: ${fileName}]`;
};