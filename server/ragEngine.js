// =============================================================================
// ragEngine.js — Retrieval-Augmented Generation Engine
// =============================================================================
// This is the BRAIN of Project 2. It implements the RAG pipeline:
//   1. RETRIEVE — Get document content from PostgreSQL
//   2. BUILD CONTEXT — Format documents into a prompt for Claude
//   3. GENERATE — Send context + question to Claude via Bedrock
//   4. RETURN — Structured answer with source references
//
// WHY RAG instead of just asking Claude?
//   Claude doesn't know about YOUR documents. RAG solves this by
//   injecting document content directly into the prompt, so Claude
//   can answer questions grounded in YOUR specific data.
//
// This is the #1 pattern for enterprise AI applications.
// The job posting asks for: "Bedrock AI models and knowledge base implementations"
// =============================================================================

// AWS SDK — Bedrock client for Claude inference
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

// Database functions — for retrieving document text
import { getDocumentTexts } from "./db.js";

// Configuration values
import {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  BEDROCK_MODEL_ID,
  RAG_MAX_TOKENS,
  RAG_TEMPERATURE,
  RAG_SYSTEM_PROMPT,
} from "./config.js";

// =============================================================================
// Create the Bedrock Client (reused for all RAG queries)
// =============================================================================

const bedrockClient = new BedrockRuntimeClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

console.log("🧠 RAG Engine initialized");

// =============================================================================
// Step 1: RETRIEVE — Get Document Content
// =============================================================================

/**
 * Retrieve all document texts for a session from PostgreSQL.
 *
 * In a production RAG system with thousands of documents, you'd use
 * a vector database (Pinecone, pgvector, etc.) to find only the MOST
 * RELEVANT document chunks. For our portfolio project, we retrieve
 * ALL documents for the session since the volume is manageable.
 *
 * @param {string} sessionId — The session to get documents for
 * @returns {Array} Array of { id, original_name, text_content } objects
 * @throws {Error} If no documents are found
 */
const retrieveDocuments = async (sessionId) => {
  // Query PostgreSQL for all document texts in this session
  const documents = await getDocumentTexts(sessionId);

  // If no documents exist, the user needs to upload something first
  if (!documents || documents.length === 0) {
    throw new Error(
      "No documents found for this session. " +
      "Please upload at least one document before asking questions."
    );
  }

  console.log(`   📚 Retrieved ${documents.length} document(s) for context`);

  return documents;
};

// =============================================================================
// Step 2: BUILD CONTEXT — Format Documents into a Prompt
// =============================================================================

/**
 * Build the context string that gets injected into Claude's prompt.
 *
 * We format each document with clear delimiters so Claude knows where
 * one document ends and another begins. This helps Claude cite sources.
 *
 * The context looks like:
 *   === Document: "policies.txt" ===
 *   ...document content...
 *   === End of Document ===
 *
 * @param {Array} documents — Array of { original_name, text_content }
 * @returns {Object} { contextString, documentNames }
 */
const buildContext = (documents) => {
  // Track document names for the "sources used" metadata in the response
  const documentNames = [];

  // Build the context string by formatting each document with headers
  const contextParts = documents.map((doc, index) => {
    // Store the document name for reference tracking
    documentNames.push(doc.original_name);

    // Truncate very long documents to prevent exceeding Claude's context window.
    // Claude Sonnet has a 200K token context window, but we want to leave room
    // for the system prompt, question, and response.
    // 50,000 characters ≈ ~12,500 tokens per document (rough estimate).
    const maxCharsPerDoc = 50000;
    let text = doc.text_content || "[No text content available]";

    // If the document text is too long, truncate it with a note
    if (text.length > maxCharsPerDoc) {
      text = text.substring(0, maxCharsPerDoc) +
        "\n\n[Document truncated — showing first 50,000 characters]";
    }

    // Format with clear delimiters so Claude can distinguish documents
    return (
      `=== Document ${index + 1}: "${doc.original_name}" ===\n` +
      `${text}\n` +
      `=== End of Document ${index + 1} ===`
    );
  });

  // Join all document contexts with double newlines for separation
  const contextString = contextParts.join("\n\n");

  console.log(
    `   📝 Built context: ${contextString.length} chars from ${documents.length} doc(s)`
  );

  return { contextString, documentNames };
};

// =============================================================================
// Step 3: GENERATE — Send Context + Question to Claude
// =============================================================================

/**
 * Send the document context and user question to Claude via Bedrock.
 *
 * The message structure:
 *   System prompt: "You are a knowledgeable assistant that answers based on documents..."
 *   User message: "Here are the documents: [context]\n\nQuestion: [question]"
 *
 * Claude reads the documents in the prompt and generates a grounded answer.
 *
 * @param {string} contextString — Formatted document content
 * @param {string} question — The user's question
 * @returns {Object} { answer, inputTokens, outputTokens }
 */
const generateAnswer = async (contextString, question) => {
  // Build the user message with document context + question.
  // Clear separation between context and question helps Claude understand
  // what is document content vs. what it needs to answer.
  const userMessage = [
    "Here are the uploaded documents to reference when answering:\n",
    contextString,
    "\n\n---\n",
    `Question: ${question}`,
    "\n\nPlease answer the question based ONLY on the document content provided above. " +
    "If the documents don't contain enough information, say so clearly.",
  ].join("");

  // Build the Bedrock Converse API request
  const command = new ConverseCommand({
    modelId: BEDROCK_MODEL_ID,
    system: [{ text: RAG_SYSTEM_PROMPT }],
    messages: [
      {
        role: "user",
        content: [{ text: userMessage }],
      },
    ],
    inferenceConfig: {
      maxTokens: RAG_MAX_TOKENS,
      temperature: RAG_TEMPERATURE, // 0.0 for factual, grounded answers
    },
  });

  try {
    // Send the request to Claude via Bedrock
    const response = await bedrockClient.send(command);

    // Extract the text response from the nested structure
    const contentBlocks = response?.output?.message?.content ?? [];
    const answer = contentBlocks
      .filter((block) => "text" in block)
      .map((block) => block.text)
      .join("\n");

    // Extract token usage for cost tracking
    const usage = response?.usage ?? {};

    console.log(
      `   🤖 Generated answer: ${answer.length} chars | ` +
      `Tokens: ${usage.inputTokens || 0} in / ${usage.outputTokens || 0} out`
    );

    return {
      answer: answer || "I was unable to generate an answer. Please try rephrasing your question.",
      inputTokens: usage.inputTokens || 0,
      outputTokens: usage.outputTokens || 0,
    };
  } catch (error) {
    console.error(`❌ Bedrock RAG query failed: ${error.message}`);
    throw new Error(`Failed to generate answer: ${error.message}`);
  }
};

// =============================================================================
// Main RAG Function — Ties the Pipeline Together
// =============================================================================

/**
 * Run the complete RAG pipeline: Retrieve → Build Context → Generate Answer.
 *
 * This is the MAIN function called by the query route.
 *
 * @param {string} sessionId — The session asking the question
 * @param {string} question — The user's natural language question
 * @returns {Object} {
 *   answer: string,          — Claude's grounded answer
 *   documentsUsed: string[], — Names of documents referenced
 *   tokenUsage: Object       — { inputTokens, outputTokens }
 * }
 */
export const queryRAG = async (sessionId, question) => {
  console.log(`\n🔍 RAG Query: "${question.substring(0, 80)}..."`);

  // Step 1: RETRIEVE — Get document content from PostgreSQL
  const documents = await retrieveDocuments(sessionId);

  // Step 2: BUILD CONTEXT — Format documents into Claude's prompt
  const { contextString, documentNames } = buildContext(documents);

  // Step 3: GENERATE — Send to Claude and get a grounded answer
  const { answer, inputTokens, outputTokens } = await generateAnswer(
    contextString,
    question
  );

  // Return the complete result
  return {
    answer,
    documentsUsed: documentNames,
    tokenUsage: {
      inputTokens,
      outputTokens,
    },
  };
};