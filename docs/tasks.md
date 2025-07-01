# GapGuard - Task Checklist

This document tracks the implementation status of all features for the GapGuard AI Backend. It is based on a direct review of the codebase.

---

### ✅ Completed Tasks (Current Version)

-   **[Architect]** Defined and implemented a serverless architecture using Supabase Edge Functions.
-   **[Architect]** Configured the AI engine to use the **Google Gemini 2.5 Flash** API via a shared library.
-   **[Backend]** Built the `process_document` function for core AI analysis.
-   **[Backend]** Built the `compute_gaps` function for automated compliance analysis.
-   **[Backend]** Built the `daily_digest` function to send summary emails via Resend.
-   **[Backend]** Built the `suggest_rules` function for AI-powered rule suggestions.
-   **[Security]** Implemented and repaired Row Level Security (RLS) across all tables using Clerk JWTs.
-   **[Security]** Hardened all Edge Functions with environment validation and secure CORS policies.
-   **[Database]** Repaired and consolidated database migration files for a clean, repeatable setup.
-   **[Frontend]** Implemented the client-side upload-then-invoke workflow in `DocumentUpload.tsx`.
-   **[Frontend]** Built the UI for displaying, approving, and rejecting AI-suggested rules.
-   **[Frontend]** Built the UI for the RAG-powered chatbot.
-   **[Frontend]** Fixed critical rendering bugs causing infinite request loops on the dashboard.
-   **[Testing]** Created a test runner script (`supabase/tests/run_tests.ts`).
-   **[RAG]** **Phase 3A - Embeddings:** Modified `process_document` to generate and store text embeddings for all uploaded documents.
-   **[RAG]** **Phase 3B - RAG Backend:** Created and deployed the `chat_with_documents` Edge Function with vector search and AI-powered responses.
-   **[RAG]** **Phase 3C - Frontend Integration:** Connected the chat UI to the `chat_with_documents` function with session management.
-   **[Production]** **Phase 3D - Production Hardening:** Implemented production safeguards for document processing including rate limiting, file size validation, empty file handling, Gemini error handling, and file type conflict prevention.

---

## Task Checklist

### P0: Critical Fixes & Unblocking
- [ ] **Local Environment:** Resolve Deno `PATH` issue. *(Note: This may be an issue on the local machine outside my control).*
- [ ] **Database Types:** Run `npx supabase gen types typescript --local > src/integrations/supabase/types.ts` after `supabase start` is working.
- [ ] **Cron Job:** Add `[functions.daily_digest]` section to `supabase/config.toml` and set the `cron` schedule.

### P1: Current Focus - RAG Chatbot (Phase 3) ✅ **COMPLETE**
- [✅] **Phase 3A - Embeddings:**
    - [✅] **Backend:** Modified `process_document` to generate and store text embeddings.
    - [✅] **Verification:** Confirmed embeddings are being generated correctly on the live project.
- [✅] **Phase 3B - RAG Backend:**
    - [✅] Created the `chat_with_documents` Edge Function.
    - [✅] Implemented vector search using `match_documents` database function.
    - [✅] Added intelligent context retrieval and AI response generation with Gemini 2.5 Flash.
- [✅] **Phase 3C - Frontend Connection:**
    - [✅] Updated the `useChatSession.ts` hook to call the `chat_with_documents` function.
    - [✅] Implemented session management and message history persistence.
- [✅] **Phase 3D - Production Hardening:**
    - [✅] **Rate Limiting:** Implement per-user rate limiting (100 requests/24h) to prevent abuse.
    - [✅] **File Size Limits:** Add validation for maximum file sizes (10MB DOCX, 20MB PDF/images).
    - [✅] **Empty File Handling:** Gracefully handle files with no extractable text.
    - [✅] **Gemini Error Handling:** Add retry logic and graceful fallbacks for Gemini API failures.
    - [✅] **File Type Conflict Prevention:** Prevent re-uploads with conflicting file types for same filename.

### P2: Core User Experience
- [ ] **UI - Real-time Status:**
    - [✅] On file upload, optimistically set document status to "Processing" in the UI.
    - [✅] Use Supabase Realtime to listen for changes to the document's status.
    - [ ] **UI - Gaps View:**
        - [ ] Create a new component to display the contents of the `gaps` table.
        - [ ] Design a clear and actionable way to show users which documents are missing or expired.
- [ ] **Emails - Template Design:**
    - [ ] Refactor the HTML in the `daily_digest` function to be more professional and user-friendly.

### P3: Advanced Features & Optimization
- [ ] **Calendar Integration (Google & Outlook):**
    - [ ] Implement OAuth2 flow to connect user calendars.
    - [ ] Create an Edge Function to automatically create calendar events for document expiry dates.
    - [ ] Build the frontend "Settings" page for users to connect their calendars.
- [ ] **Admin UI - Rules Management:**
    - [ ] Create a new protected route and page for admins.
    - [ ] Build a table/form interface to perform CRUD operations on the `document_rules` table.
- [ ] **Cost & Performance Optimization:**
    - [ ] Research and implement Gemini's batch processing endpoints in the `process_document` function.
    - [ ] Create a new page to visualize data from `processing_logs`, showing cost per document, average processing time, etc.

---
*End of document.*

