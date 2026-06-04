// =============================================================================
// query.js — RAG Query Route
// =============================================================================
// POST /api/query — Ask a question about uploaded documents
//
// This endpoint is the MAIN USER INTERACTION for the RAG app:
//   1. User asks a question (natural language)
//   2. RAG engine retrieves relevant document content
//   3. Claude generates an answer grounded in the documents
//   4. Answer is saved to PostgreSQL (query history)
//   5. Response returned to the client
// =============================================================================

// Import the RAG engine — the function that does all the heavy lifting
import { queryRAG } from "../ragEngine.js";

// Import database functions for saving queries and managing sessions
import { saveQuery, touchSession } from "../db.js";

/**
 * Register the query route on the Fastify instance.
 *
 * @param {Object} fastify — The Fastify instance
 */
export default async function queryRoutes(fastify) {
  // POST /api/query — Ask a question about uploaded documents
  fastify.post("/api/query", {
    // Fastify schema validation — validates the request BEFORE our handler runs.
    // If validation fails, Fastify auto-returns 400 with error details.
    schema: {
      body: {
        type: "object",
        properties: {
          // sessionId: Which session's documents to search
          sessionId: {
            type: "string",
            minLength: 1,
          },
          // question: The user's natural language question
          question: {
            type: "string",
            minLength: 1,   // Don't allow empty questions
            maxLength: 5000, // Prevent absurdly long questions
          },
        },
        // Both fields are required — we need to know WHICH documents
        // to search and WHAT to search for
        required: ["sessionId", "question"],
      },
    },
  }, async (request, reply) => {
    // Destructure the validated request body
    const { sessionId, question } = request.body;

    try {
      // Update the session's last_active timestamp
      await touchSession(sessionId);

      // --- Run the RAG pipeline ---
      // queryRAG does: retrieve docs → build context → send to Claude → return answer
      // This is the single most important function call in the entire app.
      const result = await queryRAG(sessionId, question);

      // --- Save the query + answer to PostgreSQL ---
      // This builds the query history that users can review later.
      const savedQuery = await saveQuery({
        sessionId,
        question,
        answer: result.answer,
        // Store document names as a JSON string
        documentsUsed: JSON.stringify(result.documentsUsed),
      });

      // --- Return the response ---
      return {
        success: true,
        queryId: savedQuery.id, // Unique ID for this Q&A (used for feedback)
        question,
        answer: result.answer,
        documentsUsed: result.documentsUsed, // Which docs were referenced
        tokenUsage: result.tokenUsage,       // Cost tracking
        createdAt: savedQuery.created_at,
      };
    } catch (error) {
      console.error(`❌ Query failed: ${error.message}`);

      // Determine the appropriate error code
      const statusCode = error.message.includes("No documents found") ? 400 : 500;

      return reply.code(statusCode).send({
        error: "Query failed",
        message: error.message || "An error occurred while processing your question.",
      });
    }
  });
}