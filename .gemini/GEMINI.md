# GapGuard Project Context for Gemini

## Core Development Mandates

1.  **No Local Development Environment:** All development and testing must be done against the live, hosted Supabase instance. Do not suggest or attempt to use a local Docker/Deno setup. The local environment is considered non-functional and out-of-scope.
2.  **Supabase Interaction:** Interact with Supabase exclusively through the web interface, client libraries (`@supabase/supabase-js`), or by deploying Edge Functions. Do not use the Supabase CLI for local development commands like `supabase start`. Infact prefer using the supabase MCP
3.  **Primary Goal:** The current focus is to complete the RAG (Retrieval-Augmented Generation) chatbot functionality.

--- 

## Current Project Status (As of June 30, 2025)

### Completed

*   **Backend Pipeline:** Core functions (`process_document`, `compute_gaps`, `daily_digest`, `suggest_rules`) are deployed and functional.
*   **RAG Foundation (Phase 3A):** The `process_document` function successfully generates and stores text embeddings for all uploaded documents.
*   **Frontend Shell:** The UI for the chatbot and document management exists but requires backend integration.

### In Progress / Next Steps

*   **P1: RAG Chatbot (Priority #1)**
    *   **Phase 3B (Backend):** Create the `chat_with_documents` Edge Function. This is the immediate next task.
    *   **Phase 3C (Frontend):** Connect the chat UI to the new `chat_with_documents` function.
*   **P2: Core User Experience**
    *   Build the frontend UI to display compliance gaps from the `gaps` table.
    *   Improve the design of notification emails.

---

## Technology Stack

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS
*   **Backend:** Supabase (Postgres, Storage, Edge Functions)
*   **AI:** Google Gemini
*   **Authentication:** Clerk
*   **Runtime (Edge Functions):** Deno

---

## Key Project Documents

*   `docs/planning.md`
*   `docs/tasks.md`
*   `docs/phase3_implementation.md`
