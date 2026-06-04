// =============================================================================
// ChatView.jsx — RAG Q&A Chat Interface
// =============================================================================
// Provides a chat-like interface where users ask questions about
// their uploaded documents and receive AI-powered answers.
// =============================================================================

import { useState, useRef, useEffect } from "react";

// API function for RAG queries
import { queryRAG } from "../api";

function ChatView({ sessionId, docCount }) {
  // --- State ---

  // messages: Array of chat messages displayed in the UI
  // Each message: { role: "user"|"assistant", content: string, meta?: object }
  const [messages, setMessages] = useState([]);

  // input: The current text in the question input field
  const [input, setInput] = useState("");

  // loading: Whether the AI is processing a query
  const [loading, setLoading] = useState(false);

  // messagesEndRef: Reference to an empty div at the bottom of the chat.
  // Used to auto-scroll to the latest message.
  const messagesEndRef = useRef(null);

  // --- Auto-scroll to bottom when new messages arrive ---
  useEffect(() => {
    // scrollIntoView smoothly scrolls the referenced element into view
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]); // Runs whenever the messages array changes

  // --- Handle sending a question ---
  const handleSend = async () => {
    // Don't send empty messages or while loading
    const question = input.trim();
    if (!question || loading) return;

    // Add the user's message to the chat
    const userMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);

    // Clear the input field immediately (better UX)
    setInput("");

    // Show loading state
    setLoading(true);

    try {
      // Call the RAG API — this sends the question to the backend,
      // which retrieves document context and generates an answer via Claude
      const result = await queryRAG(sessionId, question);

      // Add the AI's response to the chat
      const assistantMessage = {
        role: "assistant",
        content: result.answer,
        meta: {
          queryId: result.queryId,
          documentsUsed: result.documentsUsed || [],
          tokenUsage: result.tokenUsage || {},
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Show the error as an assistant message so it appears in the chat flow
      const errorMsg =
        error.response?.data?.message || error.message || "Something went wrong";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I encountered an error: ${errorMsg}`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key press in the input field
  const handleKeyDown = (e) => {
    // Send on Enter, but NOT on Shift+Enter (which inserts a newline)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevent the default newline insertion
      handleSend();
    }
  };

  return (
    <div className="view-container chat-view">
      <h2 className="view-title">💬 Ask Questions</h2>

      {/* Warning if no documents uploaded */}
      {docCount === 0 && (
        <div className="message warning">
          ⚠️ No documents uploaded yet. Go to the Upload tab first to add documents, then come back here to ask questions.
        </div>
      )}

      {/* ---- Chat Messages Area ---- */}
      <div className="chat-messages">
        {/* Welcome message if no messages yet */}
        {messages.length === 0 && docCount > 0 && (
          <div className="welcome-message">
            <span className="welcome-icon">🧠</span>
            <p><strong>Ready to answer your questions!</strong></p>
            <p>
              You have {docCount} document(s) uploaded. Ask me anything about their content.
            </p>
            <div className="suggestion-chips">
              {[
                "What are the main topics in my documents?",
                "Summarize the key points",
                "What policies are mentioned?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="suggestion-chip"
                  onClick={() => {
                    setInput(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Render each message */}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`chat-bubble ${msg.role} ${msg.isError ? "error" : ""}`}
          >
            {/* Role icon */}
            <div className="bubble-icon">
              {msg.role === "user" ? "👤" : "🤖"}
            </div>

            {/* Message content */}
            <div className="bubble-content">
              <p className="bubble-text">{msg.content}</p>

              {/* Metadata for assistant messages (documents used, tokens) */}
              {msg.meta && (
                <div className="bubble-meta">
                  {msg.meta.documentsUsed?.length > 0 && (
                    <span className="meta-docs">
                      📚 Sources: {msg.meta.documentsUsed.join(", ")}
                    </span>
                  )}
                  {msg.meta.tokenUsage?.inputTokens && (
                    <span className="meta-tokens">
                      ⚡ {msg.meta.tokenUsage.inputTokens} in / {msg.meta.tokenUsage.outputTokens} out tokens
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="chat-bubble assistant loading">
            <div className="bubble-icon">🤖</div>
            <div className="bubble-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p className="loading-text">Searching documents and generating answer...</p>
            </div>
          </div>
        )}

        {/* Invisible element for auto-scroll targeting */}
        <div ref={messagesEndRef} />
      </div>

      {/* ---- Input Area ---- */}
      <div className="chat-input-area">
        <input
          type="text"
          className="chat-input"
          placeholder={
            docCount === 0
              ? "Upload documents first..."
              : "Ask a question about your documents..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || docCount === 0}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim() || docCount === 0}
        >
          {loading ? "⏳" : "Send"}
        </button>
      </div>
    </div>
  );
}

export default ChatView;