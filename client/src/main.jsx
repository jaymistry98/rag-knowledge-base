// =============================================================================
// main.jsx — React Application Entry Point
// =============================================================================
// This file mounts the React app into the DOM.
// Vite uses this as the entry point (referenced in index.html).
// =============================================================================

// StrictMode activates extra development checks and warnings.
// It renders components twice in development to catch side effects.
// It does NOT affect production builds.
import { StrictMode } from "react";

// createRoot is the React 18+ API for mounting the app.
// It replaces the older ReactDOM.render() method.
import { createRoot } from "react-dom/client";

// Import the main App component
import App from "./App.jsx";

// Mount the React app into the DOM element with id="root".
// This element exists in index.html (created by Vite's scaffold).
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);