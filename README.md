# 🧠 RAG Knowledge Base App

A **full-stack Retrieval-Augmented Generation (RAG)** application that lets you upload documents and ask AI-powered questions about their content. Claude answers using **only** the information in your uploaded documents — no hallucination.

Built with **React**, **Fastify**, **AWS Bedrock (Claude)**, **AWS S3**, **PostgreSQL**, and **Docker**.

---

## ✨ Key Features

- **Document Upload** — Drag-and-drop files (TXT, PDF, MD, CSV) stored in AWS S3 with automatic text extraction
- **RAG-Powered Q&A** — Ask natural language questions answered exclusively from your document content
- **Source Attribution** — Every answer references which documents were used
- **Query History** — Browse past questions and answers with timestamps
- **Feedback System** — Thumbs up/down on answers for quality tracking
- **Session Management** — Independent sessions with separate document sets
- **Fully Dockerized** — One command starts React, Fastify, and PostgreSQL together

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     React Frontend                        │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  Upload   │    │   Chat Q&A   │    │    History     │  │
│  │  View     │    │   View       │    │    View        │  │
│  └────┬─────┘    └──────┬───────┘    └───────┬────────┘  │
│       │                 │                     │           │
│       └─────────────────┼─────────────────────┘           │
│                         │ axios                           │
├─────────────────────────┼────────────────────────────────┤
│                   Nginx (proxy)                           │
│              /api/* → backend:3001                        │
├─────────────────────────┼────────────────────────────────┤
│                  Fastify Backend                          │
│                         │                                 │
│  ┌──────────┐  ┌───────┴────────┐  ┌──────────────────┐  │
│  │ POST     │  │ POST           │  │ GET              │  │
│  │ /upload  │  │ /query (RAG)   │  │ /history         │  │
│  └────┬─────┘  └───────┬────────┘  └────────┬─────────┘  │
│       │                │                     │            │
│  ┌────┴──┐     ┌───────┴────────┐    ┌───────┴────────┐  │
│  │ AWS   │     │  RAG Engine    │    │  PostgreSQL    │  │
│  │ S3    │     │  Retrieve →    │    │  Sessions,     │  │
│  │ Store │     │  Augment →     │    │  Documents,    │  │
│  │       │     │  Generate      │    │  Queries       │  │
│  └───────┘     │  (Claude)      │    └────────────────┘  │
│                └────────────────┘                         │
└──────────────────────────────────────────────────────────┘
```

---

## 🔄 The RAG Pipeline

```
User: "What is the return policy for electronics?"
  │
  ▼
1. RETRIEVE — Fetch all document texts from PostgreSQL for this session
  │
  ▼
2. AUGMENT — Build a prompt with document content as context:
  │  "Here are the documents: [full text]... Question: What is the return policy?"
  │
  ▼
3. GENERATE — Send to Claude via AWS Bedrock (temperature=0.0 for factual answers)
  │  Claude reads the documents and generates a grounded answer
  │
  ▼
4. RETURN — "According to the Company Policy Document, electronics have a
             15-day return window. Items must be in original packaging..."
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker Desktop
- AWS Account (Bedrock + S3 access)

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/jaymistry98/rag-knowledge-base.git
cd rag-knowledge-base

# Create .env with your AWS credentials
cp .env.example .env
# Edit .env with your values

# Start everything (React + Fastify + PostgreSQL)
docker compose up --build

# Open http://localhost:3000
```

### Option 2: Development Mode

```bash
# Terminal 1 — PostgreSQL
docker run --name postgres-rag -e POSTGRES_PASSWORD=password -e POSTGRES_DB=ragapp -p 5432:5432 -d postgres:16

# Terminal 2 — Backend
node server/server.js

# Terminal 3 — Frontend
cd client && npm run dev

# Open http://localhost:5173
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload a document (multipart form-data) |
| POST | `/api/query` | Ask a question (RAG pipeline) |
| GET | `/api/history/:sessionId` | Get query history |
| GET | `/api/documents/:sessionId` | List uploaded documents |
| POST | `/api/feedback` | Submit thumbs up/down |
| GET | `/health` | Health check |

### Example: Ask a Question

**Request:**
```json
POST /api/query
{
  "sessionId": "session_123",
  "question": "What is the shipping policy?"
}
```

**Response:**
```json
{
  "success": true,
  "queryId": 1,
  "answer": "According to the Company Policy Document, all orders ship within 2 business days...",
  "documentsUsed": ["company-policy.txt"],
  "tokenUsage": { "inputTokens": 850, "outputTokens": 120 }
}
```

---

## 📁 Project Structure

```
rag-knowledge-base/
├── server/
│   ├── config.js          # Environment configuration
│   ├── db.js              # PostgreSQL connection & queries
│   ├── s3Client.js        # AWS S3 upload/download/text extraction
│   ├── ragEngine.js       # RAG pipeline (retrieve → augment → generate)
│   ├── server.js          # Fastify entry point
│   ├── routes/
│   │   ├── upload.js      # File upload endpoint
│   │   ├── query.js       # RAG query endpoint
│   │   └── history.js     # History & feedback endpoints
│   ├── Dockerfile         # Backend container
│   └── package.json       # Backend dependencies
├── client/
│   ├── src/
│   │   ├── App.jsx        # Main app with tab navigation
│   │   ├── App.css        # Styles
│   │   ├── api.js         # Centralized API client
│   │   ├── main.jsx       # React entry point
│   │   └── components/
│   │       ├── UploadView.jsx   # Document upload with drag-and-drop
│   │       ├── ChatView.jsx     # Q&A chat interface
│   │       └── HistoryView.jsx  # Query history with feedback
│   ├── nginx.conf         # Nginx reverse proxy config
│   ├── Dockerfile         # Frontend multi-stage build
│   └── package.json       # Frontend dependencies
├── docker-compose.yml     # 3-service orchestration
├── .env                   # Environment variables (not committed)
└── README.md
```

---

## 🛠️ Technologies

| Technology | Purpose |
|------------|---------|
| **React** | Frontend UI (upload, chat, history views) |
| **Vite** | Frontend build tool |
| **Fastify** | Backend REST API framework |
| **AWS Bedrock (Claude)** | AI answer generation |
| **AWS S3** | Document storage |
| **PostgreSQL** | Session, document metadata, query history storage |
| **Nginx** | Static file serving + API reverse proxy |
| **Docker Compose** | Multi-container orchestration |
| **Axios** | HTTP client for frontend-backend communication |

---

## 🧪 Database Schema

```sql
-- Sessions: Track user conversations
sessions (id, created_at, last_active)

-- Documents: Metadata for uploaded files (content stored in S3)
documents (id, session_id, original_name, s3_key, file_size, content_type, text_content, uploaded_at)

-- Queries: Question/answer history with feedback
queries (id, session_id, question, answer, documents_used, feedback, created_at)
```

---

## 📝 What I Learned

- **RAG Pattern**: Building the retrieve → augment → generate pipeline from scratch, understanding why grounded answers matter for enterprise AI
- **Full-Stack AI Architecture**: Connecting a React frontend to an AI-powered backend with persistent storage
- **AWS S3 Integration**: Programmatic file upload/download with the AWS SDK v3
- **PostgreSQL**: Relational database design, parameterized queries, and connection pooling
- **Docker Multi-Stage Builds**: Optimizing container images from ~500MB to ~25MB
- **Nginx Reverse Proxy**: Routing API traffic and serving static files in production
- **Multi-Container Orchestration**: Docker Compose with health checks and service dependencies