// =============================================================================
// App.jsx — Main Application Component
// =============================================================================
// The root component that manages:
//   - Session ID (shared across all views)
//   - Tab navigation between Upload, Chat, and History views
//   - Backend connection status
// =============================================================================

import { useState, useEffect } from "react";

// Import the three view components
import UploadView from "./components/UploadView";
import ChatView from "./components/ChatView";
import HistoryView from "./components/HistoryView";

// Import API client for health check
import { healthCheck } from "./api";

// Import styles
import "./App.css";

function App() {
  // --- State ---

  // activeTab: Which view is currently displayed ("upload", "chat", "history")
  // Default to "upload" since users need to upload docs first
  const [activeTab, setActiveTab] = useState("upload");

  // sessionId: Unique identifier for this conversation session.
  // All views share the same session so uploaded docs are available for queries.
  // Generated once on first load and persisted in state.
  const [sessionId] = useState(
    () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  );

  // backendStatus: Whether the backend API is reachable
  // "checking" = initial state, "connected" = healthy, "disconnected" = error
  const [backendStatus, setBackendStatus] = useState("checking");

  // docCount: Number of uploaded documents (updated by UploadView)
  // Shown in the Chat tab to indicate readiness
  const [docCount, setDocCount] = useState(0);

  // --- Check backend connection on mount ---
  useEffect(() => {
    // Define an async function inside useEffect (can't make useEffect itself async)
    const checkBackend = async () => {
      try {
        await healthCheck();
        setBackendStatus("connected");
      } catch {
        setBackendStatus("disconnected");
      }
    };

    checkBackend();
  }, []); // Empty dependency array = run once on component mount

  // --- Tab configuration ---
  // Each tab has a key, label, icon, and optional badge
  const tabs = [
    { key: "upload", label: "Upload", icon: "📄" },
    { key: "chat", label: "Chat", icon: "💬" },
    { key: "history", label: "History", icon: "📜" },
  ];

  return (
    <div className="app">
      {/* ---- Header ---- */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">🧠 RAG Knowledge Base</h1>
          <p className="app-subtitle">
            Upload documents and ask AI-powered questions about them
          </p>
        </div>

        {/* Connection status indicator */}
        <div className={`status-badge ${backendStatus}`}>
          <span className="status-dot"></span>
          {backendStatus === "connected" && "Backend Connected"}
          {backendStatus === "disconnected" && "Backend Disconnected"}
          {backendStatus === "checking" && "Connecting..."}
        </div>
      </header>

      {/* ---- Tab Navigation ---- */}
      <nav className="tab-nav">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {/* Show doc count badge on Upload tab */}
            {tab.key === "upload" && docCount > 0 && (
              <span className="tab-badge">{docCount}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ---- View Content ---- */}
      <main className="app-content">
        {/* Session info bar */}
        <div className="session-bar">
          <span>Session: {sessionId.substring(0, 20)}...</span>
          <span>{docCount} document(s) uploaded</span>
        </div>

        {/* Conditionally render the active view.
            We pass sessionId to all views so they share the same session.
            We also pass setDocCount to UploadView so it can update the count. */}
        {activeTab === "upload" && (
          <UploadView
            sessionId={sessionId}
            onDocCountChange={setDocCount}
          />
        )}

        {activeTab === "chat" && (
          <ChatView
            sessionId={sessionId}
            docCount={docCount}
          />
        )}

        {activeTab === "history" && (
          <HistoryView sessionId={sessionId} />
        )}
      </main>

      {/* ---- Footer ---- */}
      <footer className="app-footer">
        Built with React, Fastify, AWS Bedrock, S3, and PostgreSQL
      </footer>
    </div>
  );
}

export default App;