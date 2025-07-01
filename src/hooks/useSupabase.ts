import { useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config';

// This hook creates a Supabase client that automatically refreshes the
// Clerk token for every request. This is the modern and correct way to
// handle short-lived JWTs with Supabase.
export const useSupabase = (): SupabaseClient<Database> | null => {
  const { getToken } = useAuth();
  // Memoize the client so it's not recreated on every render.
  const supabase = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Supabase URL or Anon Key is missing from environment variables.");
      return null;
    }
    // The key is to provide a custom `fetch` implementation.
    // This function will be called for every request made by the client.
    return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        fetch: async (input, init) => {
          // Get a fresh token before every request.
          const token = await getToken({ template: 'supabase' });
          // Add the token to the Authorization header.
          const headers = new Headers(init?.headers);
          headers.set('Authorization', `Bearer ${token}`);
          // Proceed with the original fetch request.
          return fetch(input, { ...init, headers });
        },
      },
    });
  }, [getToken]);
  return supabase;
}; 