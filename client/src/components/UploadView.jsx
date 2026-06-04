// =============================================================================
// UploadView.jsx — Document Upload Interface
// =============================================================================
// Provides drag-and-drop and click-to-upload file functionality.
// After upload, shows a list of all uploaded documents for the session.
// =============================================================================

import { useState, useEffect, useRef } from "react";

// API functions for uploading files and fetching document list
import { uploadDocument, getDocuments } from "../api";

function UploadView({ sessionId, onDocCountChange }) {
  // --- State ---

  // documents: Array of uploaded document metadata from the backend
  const [documents, setDocuments] = useState([]);

  // uploading: Whether a file upload is currently in progress
  const [uploading, setUploading] = useState(false);

  // dragOver: Whether a file is being dragged over the drop zone
  // Used for visual feedback (highlighting the drop area)
  const [dragOver, setDragOver] = useState(false);

  // message: Success or error message to display after upload
  const [message, setMessage] = useState(null);

  // fileInputRef: Reference to the hidden file input element.
  // We use a ref so we can programmatically trigger the file picker
  // when the user clicks the drop zone (instead of a plain file input).
  const fileInputRef = useRef(null);

  // --- Load existing documents on mount ---
  useEffect(() => {
    fetchDocuments();
  }, [sessionId]);

  // Fetch the list of uploaded documents from the backend
  const fetchDocuments = async () => {
    try {
      const result = await getDocuments(sessionId);
      setDocuments(result.documents || []);
      // Notify parent (App.jsx) of the document count
      onDocCountChange(result.documents?.length || 0);
    } catch {
      // Session might not exist yet — that's fine on first load
      setDocuments([]);
    }
  };

  // --- Handle file upload ---
  const handleUpload = async (file) => {
    // Validate file exists
    if (!file) return;

    // Show uploading state
    setUploading(true);
    setMessage(null);

    try {
      // Call the backend upload API
      const result = await uploadDocument(sessionId, file);

      // Show success message
      setMessage({
        type: "success",
        text: `"${file.name}" uploaded successfully! (${result.document.textLength} characters extracted)`,
      });

      // Refresh the document list
      await fetchDocuments();
    } catch (error) {
      // Show error message
      const errorMsg =
        error.response?.data?.message || error.message || "Upload failed";
      setMessage({ type: "error", text: errorMsg });
    } finally {
      // Always reset uploading state, even if there was an error
      setUploading(false);
    }
  };

  // --- Drag and Drop Handlers ---

  // Called when a file is dragged over the drop zone
  const handleDragOver = (e) => {
    // preventDefault is REQUIRED for drag-and-drop to work in browsers.
    // Without it, the browser would try to open/navigate to the file.
    e.preventDefault();
    setDragOver(true);
  };

  // Called when the dragged file leaves the drop zone
  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  // Called when the file is dropped on the drop zone
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);

    // e.dataTransfer.files contains the dropped file(s)
    // We take only the first file (single file upload)
    const file = e.dataTransfer.files[0];
    if (file) {
      handleUpload(file);
    }
  };

  // Called when a file is selected via the file input (click to upload)
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleUpload(file);
    }
    // Reset the input so the same file can be uploaded again
    e.target.value = "";
  };

  // Format file size for display (bytes → KB or MB)
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="view-container">
      <h2 className="view-title">📄 Upload Documents</h2>
      <p className="view-desc">
        Upload text files, PDFs, or markdown documents. The AI will use these to answer your questions.
      </p>

      {/* ---- Drop Zone ---- */}
      <div
        className={`drop-zone ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="drop-zone-content">
            <span className="drop-icon">⏳</span>
            <p>Uploading and processing...</p>
          </div>
        ) : (
          <div className="drop-zone-content">
            <span className="drop-icon">📁</span>
            <p><strong>Drag & drop a file here</strong></p>
            <p className="drop-hint">or click to browse</p>
            <p className="drop-types">Supports: .txt, .md, .csv, .pdf, .json, .html</p>
          </div>
        )}

        {/* Hidden file input — triggered programmatically by clicking the drop zone */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".txt,.md,.csv,.pdf,.json,.html,.xml"
          style={{ display: "none" }}
        />
      </div>

      {/* ---- Status Message ---- */}
      {message && (
        <div className={`message ${message.type}`}>
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}

      {/* ---- Document List ---- */}
      <div className="doc-list">
        <h3>Uploaded Documents ({documents.length})</h3>

        {documents.length === 0 ? (
          <p className="empty-state">No documents uploaded yet. Upload a file to get started!</p>
        ) : (
          <div className="doc-grid">
            {documents.map((doc) => (
              <div key={doc.id} className="doc-card">
                <div className="doc-card-icon">
                  {doc.contentType?.includes("pdf") ? "📕" : "📄"}
                </div>
                <div className="doc-card-info">
                  <p className="doc-name">{doc.fileName}</p>
                  <p className="doc-meta">
                    {formatSize(doc.fileSize)} • {doc.textLength.toLocaleString()} chars extracted
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadView;