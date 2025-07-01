-- This migration corrects the RLS policies for `documents` and `document_rules`
-- to use the standard `auth.uid()` function, which correctly resolves the user's
-- ID from the Clerk JWT after it has been verified by the Supabase backend.
-- This replaces the previous, incorrect usage of a custom `clerk_user_id()` function.

-- 1. Drop the old, incorrect policies.
drop policy if exists "Users can manage their own documents" on public.documents;
drop policy if exists "Users can manage their own rules" on public.document_rules;

-- 2. Recreate the policy for the 'documents' table using auth.uid().
create policy "Users can manage their own documents"
on public.documents for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 3. Recreate the policy for the 'document_rules' table using auth.uid().
create policy "Users can manage their own rules"
on public.document_rules for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id); 