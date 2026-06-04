// =============================================================================
// HistoryView.jsx — Query History with Feedback
// =============================================================================
// Displays past questions and answers for the current session.
// Users can give thumbs up/down feedback on each answer.
// This data is valuable for evaluating RAG quality.
// =============================================================================

import { useState, useEffect } from "react";

// API functions for fetching history and submitting feedback
import { getHistory, submitFeedback } from "../api";

function HistoryView({ sessionId }) {
  // --- State ---

  // history: Array of past Q&A objects from the backend
  const [history, setHistory] = useState([]);

  // loading: Whether history is being fetched
  const [loading, setLoading] = useState(true);

  // error: Error message if fetch fails
  const [error, setError] = useState(null);

  // --- Fetch history on mount and when sessionId changes ---
  useEffect(() => {
    fetchHistory();
  }, [sessionId]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getHistory(sessionId);
      setHistory(result.history || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load history");
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Handle feedback submission ---
  const handleFeedback = async (queryId, feedback) => {
    try {
      await submitFeedback(queryId, feedback);

      // Update the local state to reflect the feedback immediately.
      // This avoids a full refetch just to update one field.
      // map() creates a new array with the updated item.
      setHistory((prev) =>
        prev.map((item) =>
          item.id === queryId ? { ...item, feedback } : item
        )
      );
    } catch (err) {
      console.error("Feedback failed:", err);
    }
  };

  // Format the timestamp for display
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString(); // Uses the browser's locale for formatting
  };

  return (
    <div className="view-container">
      <div className="history-header">
        <h2 className="view-title">📜 Query History</h2>
        <button className="refresh-btn" onClick={fetchHistory} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="empty-state">Loading history...</div>
      )}

      {/* Error state */}
      {error && (
        <div className="message error">❌ {error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && history.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p>No queries yet. Go to the Chat tab to ask questions about your documents!</p>
        </div>
      )}

      {/* History list */}
      {!loading && history.length > 0 && (
        <div className="history-list">
          {history.map((item) => (
            <div key={item.id} className="history-card">
              {/* Question */}
              <div className="history-question">
                <span className="q-icon">❓</span>
                <p>{item.question}</p>
              </div>

              {/* Answer */}
              <div className="history-answer">
                <span className="a-icon">🤖</span>
                <p>{item.answer}</p>
              </div>

              {/* Metadata footer */}
              <div className="history-footer">
                {/* Documents used */}
                {item.documentsUsed?.length > 0 && (
                  <span className="history-docs">
                    📚 {item.documentsUsed.join(", ")}
                  </span>
                )}

                {/* Timestamp */}
                <span className="history-time">
                  🕐 {formatTime(item.createdAt)}
                </span>

                {/* Feedback buttons */}
                <div className="feedback-btns">
                  <button
                    className={`fb-btn ${item.feedback === "up" ? "active-up" : ""}`}
                    onClick={() => handleFeedback(item.id, "up")}
                    title="Good answer"
                  >
                    👍
                  </button>
                  <button
                    className={`fb-btn ${item.feedback === "down" ? "active-down" : ""}`}
                    onClick={() => handleFeedback(item.id, "down")}
                    title="Bad answer"
                  >
                    👎
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoryView;