-- This migration updates the RLS policies to use the new Clerk-aware function.

-- 1. Revoke any old policies on the tables to ensure a clean slate.
revoke all on public.documents from authenticated;
revoke all on public.document_rules from authenticated;
revoke all on storage.objects from authenticated;

-- 2. Create the single, correct policy for the 'documents' table.
create policy "Users can manage their own documents"
on public.documents for all
to authenticated
using (public.clerk_user_id() = user_id)
with check (public.clerk_user_id() = user_id);

-- 3. Create the single, correct policy for the 'document_rules' table.
create policy "Users can manage their own rules"
on public.document_rules for all
to authenticated
using (public.clerk_user_id() = user_id)
with check (public.clerk_user_id() = user_id);

-- 4. Create the necessary policies for Supabase Storage.
create policy "Users can upload their own files"
on storage.objects for insert
to authenticated
with check ( auth.uid() = owner );

create policy "Users can view their own files"
on storage.objects for select
to authenticated
using ( auth.uid() = owner );

create policy "Users can update their own files"
on storage.objects for update
to authenticated
using ( auth.uid() = owner );

create policy "Users can delete their own files"
on storage.objects for delete
to authenticated
using ( auth.uid() = owner );

-- 5. Grant execute permissions for the new function
grant execute on function public.clerk_user_id to authenticated; 