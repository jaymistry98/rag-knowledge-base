// =============================================================================
// history.js — Query History and Feedback Routes
// =============================================================================
// GET  /api/history/:sessionId — Get past questions and answers
// POST /api/feedback — Submit thumbs up/down for a specific answer
// GET  /api/documents/:sessionId — Get uploaded documents for a session
//
// These endpoints support the React UI (Day 9):
//   - History page shows past Q&A pairs
//   - Thumbs up/down lets users rate answer quality
//   - Document list shows what's been uploaded
// =============================================================================

// Import database functions
import {
  getQueryHistory,
  updateQueryFeedback,
  getDocumentsBySession,
} from "../db.js";

/**
 * Register history and feedback routes on the Fastify instance.
 *
 * @param {Object} fastify — The Fastify instance
 */
export default async function historyRoutes(fastify) {
  // =========================================================================
  // GET /api/history/:sessionId — Get query history
  // =========================================================================
  // Returns all past questions and answers for a session.
  // Used by the React frontend to display the history page.
  //
  // :sessionId is a URL parameter — extracted from request.params
  // Example: GET /api/history/session_abc → request.params.sessionId = "session_abc"
  //
  // Optional query parameter: ?limit=20 (defaults to 50)
  // Example: GET /api/history/session_abc?limit=10
  // =========================================================================

  fastify.get("/api/history/:sessionId", async (request, reply) => {
    // Extract the session ID from the URL path
    const { sessionId } = request.params;

    // Extract the optional limit from query parameters.
    // request.query contains URL query params (?key=value).
    // parseInt converts the string to a number.
    // Default to 50 if not provided or invalid.
    const limit = parseInt(request.query.limit) || 50;

    try {
      // Fetch query history from PostgreSQL
      const history = await getQueryHistory(sessionId, limit);

      // Format the history for the response.
      // Parse the documentsUsed JSON string back to an array.
      const formattedHistory = history.map((entry) => ({
        id: entry.id,
        question: entry.question,
        answer: entry.answer,
        // JSON.parse converts the stored JSON string back to an array.
        // Wrap in try/catch because the stored value might not be valid JSON.
        documentsUsed: safeJsonParse(entry.documents_used, []),
        feedback: entry.feedback, // "up", "down", or null
        createdAt: entry.created_at,
      }));

      return {
        success: true,
        sessionId,
        count: formattedHistory.length,
        history: formattedHistory,
      };
    } catch (error) {
      console.error(`❌ History fetch failed: ${error.message}`);

      return reply.code(500).send({
        error: "History fetch failed",
        message: error.message || "Could not retrieve query history.",
      });
    }
  });

  // =========================================================================
  // POST /api/feedback — Submit feedback for an answer
  // =========================================================================
  // Lets users rate answer quality with thumbs up/down.
  // This is valuable data for evaluating RAG performance.
  //
  // In production, you'd use this feedback to:
  //   - Identify questions where the RAG pipeline struggles
  //   - Fine-tune retrieval settings
  //   - Measure user satisfaction metrics
  // =========================================================================

  fastify.post("/api/feedback", {
    // Validate the request body
    schema: {
      body: {
        type: "object",
        properties: {
          // queryId: Which Q&A pair to rate (from the query response)
          queryId: { type: "integer" },
          // feedback: "up" (good answer) or "down" (bad answer)
          feedback: {
            type: "string",
            enum: ["up", "down"], // Only these two values are allowed
          },
        },
        required: ["queryId", "feedback"],
      },
    },
  }, async (request, reply) => {
    const { queryId, feedback } = request.body;

    try {
      // Update the feedback column in the queries table
      const updated = await updateQueryFeedback(queryId, feedback);

      // If no row was updated, the queryId doesn't exist
      if (!updated) {
        return reply.code(404).send({
          error: "Query not found",
          message: `No query found with ID ${queryId}.`,
        });
      }

      return {
        success: true,
        message: `Feedback "${feedback}" recorded for query ${queryId}.`,
        queryId,
        feedback,
      };
    } catch (error) {
      console.error(`❌ Feedback update failed: ${error.message}`);

      return reply.code(500).send({
        error: "Feedback update failed",
        message: error.message || "Could not save feedback.",
      });
    }
  });

  // =========================================================================
  // GET /api/documents/:sessionId — Get uploaded documents for a session
  // =========================================================================
  // Returns metadata about all documents uploaded in a session.
  // Used by the React frontend to show the document list.
  // =========================================================================

  fastify.get("/api/documents/:sessionId", async (request, reply) => {
    const { sessionId } = request.params;

    try {
      // Fetch documents from PostgreSQL
      const documents = await getDocumentsBySession(sessionId);

      // Format for response (exclude the full text_content for brevity)
      const formattedDocs = documents.map((doc) => ({
        id: doc.id,
        fileName: doc.original_name,
        fileSize: doc.file_size,
        contentType: doc.content_type,
        textLength: doc.text_content?.length || 0, // How much text was extracted
        uploadedAt: doc.uploaded_at,
      }));

      return {
        success: true,
        sessionId,
        count: formattedDocs.length,
        documents: formattedDocs,
      };
    } catch (error) {
      console.error(`❌ Document fetch failed: ${error.message}`);

      return reply.code(500).send({
        error: "Document fetch failed",
        message: error.message || "Could not retrieve documents.",
      });
    }
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely parse a JSON string, returning a default value if parsing fails.
 *
 * @param {string} jsonString — The string to parse
 * @param {*} defaultValue — Value to return if parsing fails
 * @returns {*} Parsed value or default
 */
function safeJsonParse(jsonString, defaultValue) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
}