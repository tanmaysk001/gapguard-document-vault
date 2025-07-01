# End-to-End System Debug & Verification Plan

This document outlines the steps to perform a full system review of the GapGuard application, from the local development environment up to the frontend code. Our goal is to stabilize the system, eliminate hidden issues, and adhere to modern best practices.

---

## Phase 1: Environment & Database Reset (Complete Eradication)

**Objective:** Destroy the corrupted local Docker environment and rebuild it from scratch using the corrected migration files. This is the mandatory first step.

**Instructions (For User):**
1.  **Stop Supabase & Delete Backup:**
    ```bash
    npx supabase stop --no-backup
    ```
2.  **Prune Docker System:** (Warning: This will remove all unused Docker data on your system).
    ```bash
    docker system prune -a --volumes
    ```
    *(Confirm with 'y' when prompted)*
3.  **Start Supabase Cleanly:**
    ```bash
    npx supabase start
    ```

**Verification:**
- [ ] **Action:** The `npx supabase start` command completes successfully without any errors.
- [ ] **Action:** All migrations are applied in order.
- [ ] **Action:** The application loads locally at `http://localhost:5173`.
- [ ] **Action:** Supabase Studio is accessible and shows the correct tables.

---

## Phase 2: Database & Authentication Integrity Review

**Objective:** Verify that the database schema, authentication mechanism, and security policies are correct, modern, and robust.

**Checklist:**
- [ ] **Migrations Review:**
    - [ ] Read through `20250617034159_initial_schema.sql`: Confirm it sets up the base tables correctly.
    - [ ] Read through `20250619042644_final_rls_and_schema_fix.sql`: Confirm the RLS policies make sense.
    - [ ] Read through `20250620044417_enhance_rules_with_status.sql`: Confirm the `status` and `reason` columns are added correctly.
    - [ ] Read through `20250621000002_add_clerk_auth_functions.sql`: Confirm it uses `pgjwt` and the `clerk_user_id()` function is correct.
    - [ ] Read through `20250621000003_update_rls_policies_for_clerk.sql`: Confirm the policies correctly use `clerk_user_id() = user_id`.
- [ ] **RLS Policy Verification:**
    - [ ] In Supabase Studio's SQL Editor, run tests to confirm a user can ONLY see their own data in `documents` and `document_rules`.
- [ ] **Configuration (`supabase/config.toml`):**
    - [ ] Review the file to ensure all settings are correct, especially the `[functions.suggest_rules]` block.

---

## Phase 3: Backend (Edge Functions) Review

**Objective:** Ensure all backend functions are bug-free, use modern libraries, and have consistent error handling.

**Checklist:**
- [ ] **`suggest_rules` Function:**
    - [ ] Read the code in `supabase/functions/suggest_rules/index.ts`.
    - [ ] Verify the call to the Gemini API is correct.
    - [ ] Verify the database insertion logic is correct and returns the newly created rules.
- [ ] **Shared Libraries:**
    - [ ] Review `supabase/functions/lib/ai.ts` to ensure the `suggestRules` logic is sound.
- [ ] **Dependencies (`import_map.json`):**
    - [ ] Check for any outdated or unnecessary Deno modules.

---

## Phase 4: Frontend Review

**Objective:** Confirm the frontend correctly communicates with the backend, manages state, and provides a bug-free user experience.

**Checklist:**
- [ ] **Supabase Client:**
    - [ ] Review `src/hooks/useSupabase.ts` to ensure the client is initialized correctly as a singleton.
- [ ] **Function Calls:**
    - [ ] Review the `handleSuggestRules` function in `src/pages/Rules.tsx`. Confirm it correctly calls the `suggest_rules` function and handles the response.
    - [ ] Verify that the UI correctly updates based on the data returned from the function, not an arbitrary success message.
- [ ] **Type Safety:**
    - [ ] Regenerate Supabase types to ensure they are in sync with the new database schema: `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`.
    - [ ] Check for any type errors in the frontend codebase.

--- 