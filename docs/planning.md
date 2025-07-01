# GapGuard – AI Backend Architecture & Roadmap

This document outlines the current architecture of the GapGuard AI backend and the strategic roadmap for future development.

---

## 1. Current System Architecture

The backend is a robust, serverless pipeline built entirely on Supabase, using Deno-based Edge Functions for logic and Google's Gemini API for AI-driven document analysis.

### 1.1. Core Pipeline Flow
```mermaid
sequenceDiagram
    participant FE as Frontend App
    participant Storage as Supabase Storage
    participant ProcDoc as Edge Function<br>(process_document)
    participant Gemini as Google Gemini API
    participant DB as Supabase DB
    participant CompGaps as Edge Function<br>(compute_gaps)

    FE->>+Storage: 1. Upload file (PDF, JPG, etc.)
    Storage-->>-FE: Returns file path/URL

    FE->>+ProcDoc: 2. Invoke with file metadata
    ProcDoc->>+Gemini: 3. Analyze file content
    Gemini-->>-ProcDoc: 4. Return structured JSON data
    ProcDoc->>+DB: 5. Upsert document metadata<br>(doc_type, dates, etc.)
    DB-->>-ProcDoc: Confirm write

    ProcDoc->>+CompGaps: 6. Invoke with document ID
    CompGaps->>+DB: 7. Analyze rules vs documents
    DB-->>-CompGaps: Return compliance status
    CompGaps->>DB: 8. Write/update `gaps` table
    DB-->>-CompGaps: Confirm write
```

### 1.2. Key Components & Status

*   **Document Processing (`process_document`):**
    *   **Trigger:** Client-side invocation after successful file upload.
    *   **Engine:** Google Gemini 2.5 Flash.
    *   **Logic:** Fetches file from storage, calls Gemini for analysis, validates the response, writes metadata to the `documents` table, and **generates text embeddings for RAG**.
    *   **Status:** ✅ **Complete & Hardened**

*   **Gap Analysis (`compute_gaps`):**
    *   **Trigger:** Invoked directly by `process_document`.
    *   **Logic:** Compares the new document against user-specific rules in `document_rules` and updates the `gaps` table accordingly.
    *   **Status:** ✅ **Complete**

*   **AI Rule Suggestions (`suggest_rules`):**
    *   **Trigger:** Client-side invocation from the "Rules" page.
    *   **Logic:** Analyzes existing document categories to suggest new, relevant rules for the user to approve or reject.
    *   **Status:** ✅ **Complete**

*   **Email Notifications (`daily_digest`):**
    *   **Trigger:** Scheduled daily via Supabase cron job.
    *   **Logic:** Queries for users with active gaps, formats a summary email, and sends it via Resend.
    *   **Status:** ✅ **Complete & Hardened**

*   **Database & Security:**
    *   **Schema:** Relational schema with tables for documents, rules, gaps, and logs.
    *   **Security:** Row Level Security (RLS) is enabled on all tables, using Clerk JWTs for user identification. Migrations are consistent and repeatable.
    *   **Status:** ✅ **Complete & Repaired**

---

## 2. Development Roadmap

Our development roadmap is structured into prioritized tiers, from critical fixes to long-term enhancements.

### P0: Critical Fixes & Unblocking
*   **[Blocked] Fix Local Environment:** Resolve the Deno `PATH` issue on the development machine to enable local testing and validation. *This is a mandatory prerequisite for all future backend development.*
*   **[Blocked] Regenerate Database Types:** Re-run the type generation command to populate the empty `database.types.ts` file.
*   **Schedule Daily Digest:** Define the cron schedule for the `daily_digest` function in `supabase/config.toml` to enable its daily execution.

### P1: Current Focus - RAG Chatbot (Phase 3) ✅ **COMPLETE**
*   **Concept:** Transform the placeholder chatbot into an intelligent assistant that can answer questions about a user's uploaded documents.
*   **Phase 3A: Embeddings:** ✅ **Complete** - Confirmed that the existing embedding generation in `process_document` is working correctly on the live system.
*   **Phase 3B: RAG Backend:** ✅ **Complete** - Created and deployed the `chat_with_documents` Edge Function to perform vector searches and generate AI responses based on document context.
*   **Phase 3C: Frontend Connection:** ✅ **Complete** - Connected the production-ready chat UI to the new backend function with session management.
*   **Phase 3D: Production Hardening:** ✅ **Complete** - Implemented production-ready safeguards for the document processing pipeline:
    *   Rate limiting to prevent abuse (100 requests per user per 24h)
    *   File size limits to prevent server overload (10MB DOCX, 20MB PDF/images)
    *   Empty file handling with clear error messages
    *   Gemini API error/timeout handling with graceful fallbacks
    *   Prevention of re-uploads with conflicting file types

### P2: Core User Experience (Current Focus)
*   **Gaps & Status UI:** Create the frontend components to display compliance gaps from the `gaps` table. This UI should also poll for and display a document's status in real-time after upload (e.g., "Processing" -> "Valid").
*   **Enhanced Email Templates:** Improve the design and content of the `daily_digest` emails for better user experience.

### P3: Advanced Features & Optimization
*   **Calendar Integration (Google & Outlook):**
    *   **Concept:** Allow users to connect their personal calendars via an OAuth2 flow.
    *   **Workflow:** When a document with an expiry date is processed, the system will automatically create a calendar event (e.g., 30 days before expiry) in the user's connected calendar, creating a seamless and powerful reminder system.
*   **Admin UI for Document Rules:** A secure interface for administrators or power-users to create, update, and delete document requirements (`document_rules`) without needing to write SQL.
*   **Vector Search:** Store embeddings for document content during processing to enable a semantic search feature (e.g., "find all contracts related to Project Alpha").
*   **Cost & Performance Optimization:**
    *   **Batch Processing:** Implement Gemini's batch processing API to reduce costs for bulk uploads.
    *   **Analytics Dashboard:** Build a dashboard on top of the `processing_logs` table to monitor AI costs, processing times, and error rates.

---
*End of document.*

