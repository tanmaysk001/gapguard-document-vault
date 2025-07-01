-- This migration adds custom functions to validate Clerk JWTs and extract the user ID.
-- It now uses the standard `pgjwt` extension.

-- 1. Function to extract a claim from a JWT.
-- This is a generic helper that uses the `pgjwt` extension.
create or replace function get_jwt_claim(token text, claim text)
returns jsonb
language sql
immutable
as $$
  select extensions.pgjwt.payload->claim from extensions.pgjwt.verify(token, current_setting('app.jwt_secret')) as a;
$$;


-- 2. Function to get the user ID from the Clerk session.
-- This function is specific to Clerk's JWT structure.
create or replace function public.clerk_user_id()
returns text
language sql
stable
as $$
  select sub from extensions.pgjwt.verify(
    ((current_setting('request.headers', true))::json->>'Authorization')::text,
    current_setting('app.jwt_secret')
  ) as a;
$$;

-- Grant execute permissions for the new function to the 'authenticated' role
grant execute on function public.clerk_user_id() to authenticated; 