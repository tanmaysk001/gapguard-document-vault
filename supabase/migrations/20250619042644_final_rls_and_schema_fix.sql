-- This is a consolidated migration to fix all outstanding RLS and schema issues.

-- Step 1: Ensure user_id columns are TEXT, not UUID, to match Clerk user IDs.
-- It's safer to drop and recreate constraints/policies than to alter types on columns they depend on.
DROP POLICY IF EXISTS "Users can manage their own rules" ON public.document_rules;
ALTER TABLE public.document_rules ALTER COLUMN user_id TYPE text;

-- Step 1.1: Re-enable RLS and create the correct policy for document_rules.
ALTER TABLE public.document_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own document rules"
ON public.document_rules
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Step 2: Ensure Row Level Security is enabled on the documents table.
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop all potentially conflicting old policies on the documents table.
DROP POLICY IF EXISTS "Enable all access for users based on user_id" ON public.documents;
DROP POLICY IF EXISTS "Enable read access for own documents" ON public.documents;
DROP POLICY IF EXISTS "Enable insert for own documents" ON public.documents;
DROP POLICY IF EXISTS "Enable update for own documents" ON public.documents;
DROP POLICY IF EXISTS "Enable delete for own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

-- Step 4: Create the final, correct set of policies for the 'documents' table.
-- These policies use the Clerk JWT's 'sub' claim for authentication.

CREATE POLICY "Users can view their own documents"
ON public.documents
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own documents"
ON public.documents
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own documents"
ON public.documents
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own documents"
ON public.documents
FOR DELETE
USING (user_id = auth.uid());
