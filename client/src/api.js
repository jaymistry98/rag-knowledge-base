// =============================================================================
// api.js — Centralized API Client for the RAG Knowledge Base
// =============================================================================
// Day 10 Update: Now works in both development and Docker modes.
//
// Development (npm run dev):
//   React on localhost:5173 → calls backend on localhost:3001 directly
//
// Docker (docker compose up):
//   React served by Nginx on port 3000
//   Nginx proxies /api/ to the backend container
//   So we just use relative URLs like "/api/query" (no hostname needed)
//
// The trick: If no VITE_API_URL is set, we use relative paths (Docker mode).
// In development, we set VITE_API_URL=http://localhost:3001
// =============================================================================

import axios from "axios";

// Determine the API base URL.
// In Vite, environment variables must start with VITE_ to be exposed to the client.
//
// Development: VITE_API_URL=http://localhost:3001 (in client/.env or terminal)
// Docker/Production: No VITE_API_URL → uses "" (relative paths → goes through Nginx)
//
// import.meta.env is Vite's way of accessing environment variables.
const API_BASE = import.meta.env.VITE_API_URL || "";

// Create a reusable axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// =============================================================================
// Upload a Document
// =============================================================================

/**
 * Upload a file to the backend.
 *
 * @param {string} sessionId — The session to upload into
 * @param {File} file — The File object from input or drag-and-drop
 * @returns {Object} Upload result from the backend
 */
export const uploadDocument = async (sessionId, file) => {
  const formData = new FormData();
  formData.append("sessionId", sessionId);
  formData.append("file", file);

  const response = await api.post("/api/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

// =============================================================================
// Ask a RAG Question
// =============================================================================

/**
 * Send a question to the RAG pipeline.
 *
 * @param {string} sessionId — Which docs to search
 * @param {string} question — The user's question
 * @returns {Object} { answer, documentsUsed, queryId, tokenUsage }
 */
export const queryRAG = async (sessionId, question) => {
  const response = await api.post("/api/query", {
    sessionId,
    question,
  });

  return response.data;
};

// =============================================================================
// Get Query History
// =============================================================================

/**
 * Fetch past questions and answers for a session.
 *
 * @param {string} sessionId
 * @returns {Object} { history: Array }
 */
export const getHistory = async (sessionId) => {
  const response = await api.get(`/api/history/${sessionId}`);
  return response.data;
};

// =============================================================================
// Get Uploaded Documents
// =============================================================================

/**
 * Fetch the list of uploaded documents for a session.
 *
 * @param {string} sessionId
 * @returns {Object} { documents: Array }
 */
export const getDocuments = async (sessionId) => {
  const response = await api.get(`/api/documents/${sessionId}`);
  return response.data;
};

// =============================================================================
// Submit Feedback
// =============================================================================

/**
 * Send thumbs up/down feedback for a specific answer.
 *
 * @param {number} queryId
 * @param {string} feedback — "up" or "down"
 * @returns {Object} Confirmation
 */
export const submitFeedback = async (queryId, feedback) => {
  const response = await api.post("/api/feedback", {
    queryId,
    feedback,
  });
  return response.data;
};

// =============================================================================
// Health Check
// =============================================================================

/**
 * Check if the backend is running.
 *
 * @returns {Object} { status: "healthy", ... }
 */
export const healthCheck = async () => {
  const response = await api.get("/health");
  return response.data;
};